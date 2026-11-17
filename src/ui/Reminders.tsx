import { useEffect, useState } from 'react'
import { useApp, useList } from './context'
import { dateLabel } from './common'
import { formatBRL } from '../domain/money'
import { today } from '../domain/dates'
import { addDays } from '../domain/period'
import { toIcs, upcoming } from '../domain/alerts'
import type { Card, Category, Transaction } from '../domain/types'

function useData() {
  const transactions = useList<Transaction>('transactions')
  const categories = useList<Category>('categories') ?? []
  const cards = useList<Card>('cards') ?? []
  return transactions ? { transactions, categories, cards } : undefined
}

/** Ao abrir o app, avisa (uma vez por dia) o que vence hoje e amanhã, se a pessoa permitiu notificações. */
/** Mostra a notificação: no celular só funciona pelo service worker; no computador, também direto. */
async function notify(title: string, body?: string): Promise<boolean> {
  const N = (globalThis as { Notification?: typeof Notification }).Notification
  const opts = { body, tag: 'vencimentos', icon: 'icon-192.png' }
  try {
    const reg = 'serviceWorker' in navigator
      ? await Promise.race([navigator.serviceWorker.ready, new Promise<undefined>(r => setTimeout(() => r(undefined), 1500))])
      : undefined
    if (reg) { await reg.showNotification(title, opts); return true }
  } catch { /* tenta direto abaixo */ }
  try { if (N) { new N(title, opts); return true } } catch { /* navegador não deixou */ }
  return false
}

export function useDueNotifications(enabled: boolean) {
  const { repo, device } = useApp()
  const data = useData()
  useEffect(() => {
    const N = (globalThis as { Notification?: typeof Notification }).Notification
    // Só depois de desbloquear: a notificação mostra valores.
    if (!enabled || !data || !device || !N || N.permission !== 'granted') return
    const now = today()
    // Avisa cada vencimento uma vez por dia; o que chegar depois (sincronização) também é avisado.
    const done = new Set((device.notified ?? []).filter(k => k.startsWith(`${now}|`)))
    const due = upcoming(data, now, 1).filter(d => d.kind === 'pagar' && !d.overdue && !done.has(`${now}|${d.id}`))
    if (due.length === 0) return
    const when = (d: string) => (d === now ? 'hoje' : 'amanhã')
    const title = due.length === 1 ? `Vence ${when(due[0].date)}: ${due[0].label} — ${formatBRL(due[0].cents)}` : `${due.length} contas vencem até amanhã`
    const body = due.length === 1 ? undefined : due.map(d => `${d.label} (${when(d.date)}) — ${formatBRL(d.cents)}`).join('\n')
    // Marca como avisado só depois que a notificação saiu.
    void notify(title, body).then(ok => { if (ok) void repo.setDevice({ notified: [...done, ...due.map(d => `${now}|${d.id}`)] }) })
  }, [enabled, data, device, repo])
}

/** Seção do Painel com o que vence nos próximos 7 dias. */
export function UpcomingSection() {
  const data = useData()
  const [perm, setPerm] = useState(() => (globalThis as { Notification?: typeof Notification }).Notification?.permission)
  if (!data) return null
  const now = today()
  const next = upcoming(data, now, 7)

  const toCalendar = () => {
    const ics = toIcs(upcoming(data, now, 60).filter(d => d.kind === 'pagar'))
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = 'vencimentos.ics'
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const askNotify = async () => {
    const N = (globalThis as { Notification?: typeof Notification }).Notification
    if (N) setPerm(await N.requestPermission())
  }
  const when = (d: string) => (d < now ? 'Atrasado' : d === now ? 'Hoje' : d === addDays(now, 1) ? 'Amanhã' : dateLabel(d))

  return (
    <section className="panel" role="region" aria-label="Próximos vencimentos">
      <div className="b-head"><h2>Próximos vencimentos</h2><span className="muted" style={{ fontSize: 13 }}>7 dias e atrasados</span></div>
      {next.length === 0 ? <p className="muted" style={{ margin: '10px 0 0' }}>Nada vence nos próximos 7 dias.</p> : (
        <ul className="dues">
          {next.map(d => (
            <li key={d.id}>
              <span className={`due-day ${d.date <= now ? 'today' : ''}`}>{when(d.date)}</span>
              <span className="due-label">{d.label}</span>
              <span className={`num ${d.kind === 'receber' ? 'entrada' : ''}`} style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{d.kind === 'receber' ? '+' : ''}{formatBRL(d.cents)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="btns" style={{ marginTop: 12 }}>
        <button className="mini" onClick={toCalendar}>Adicionar ao calendário</button>
        {perm === 'default' && <button className="mini" onClick={askNotify}>Avisar neste aparelho</button>}
        {perm === 'granted' && <span className="hint">Avisos ligados: o app avisa ao abrir o que vence hoje e amanhã.</span>}
      </div>
    </section>
  )
}
