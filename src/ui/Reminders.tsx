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
export function useDueNotifications() {
  const { repo, device } = useApp()
  const data = useData()
  useEffect(() => {
    const N = (globalThis as { Notification?: typeof Notification }).Notification
    if (!data || !device || !N || N.permission !== 'granted') return
    const now = today()
    // Avisa cada vencimento uma vez por dia; o que chegar depois (sincronização) também é avisado.
    const done = new Set((device.notified ?? []).filter(k => k.startsWith(`${now}|`)))
    const due = upcoming(data, now, 1).filter(d => d.kind === 'pagar' && !done.has(`${now}|${d.id}`))
    if (due.length === 0) return
    void repo.setDevice({ notified: [...done, ...due.map(d => `${now}|${d.id}`)] })
    const when = (d: string) => (d === now ? 'hoje' : 'amanhã')
    try {
      if (due.length === 1) new N(`Vence ${when(due[0].date)}: ${due[0].label} — ${formatBRL(due[0].cents)}`, { tag: 'vencimentos' })
      else new N(`${due.length} contas vencem até amanhã`, { body: due.map(d => `${d.label} (${when(d.date)}) — ${formatBRL(d.cents)}`).join('\n'), tag: 'vencimentos' })
    } catch { /* alguns navegadores só notificam pelo service worker; o Painel mostra de qualquer jeito */ }
  }, [data, device, repo])
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
  const when = (d: string) => (d === now ? 'Hoje' : d === addDays(now, 1) ? 'Amanhã' : dateLabel(d))

  return (
    <section className="panel" role="region" aria-label="Próximos vencimentos">
      <div className="b-head"><h2>Próximos vencimentos</h2><span className="muted" style={{ fontSize: 13 }}>7 dias</span></div>
      {next.length === 0 ? <p className="muted" style={{ margin: '10px 0 0' }}>Nada vence nos próximos 7 dias.</p> : (
        <ul className="dues">
          {next.map(d => (
            <li key={d.id}>
              <span className={`due-day ${d.date === now ? 'today' : ''}`}>{when(d.date)}</span>
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
