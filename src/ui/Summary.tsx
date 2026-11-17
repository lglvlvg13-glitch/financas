import { useEffect, useState } from 'react'
import { useApp, useList, useLive, useProfiles } from './context'
import { dateLabel, monthLabel } from './common'
import { BarChart } from './charts'
import { formatBRL } from '../domain/money'
import { addMonths, monthOf, today } from '../domain/dates'
import { invoiceSummary } from '../domain/invoice'
import { METHODS } from '../domain/methods'
import { countedIn, periodRange, periodSummary, shiftPeriod, type PeriodKind, type Range } from '../domain/period'
import { paidInvoices, txStatus } from '../domain/status'
import { toCsv } from '../domain/csv'
import { comparePeriods } from '../domain/compare'
import { CatIcon } from './Icons'
import { generateRecurrences } from '../data/recurring'
import type { Account, Card, Category, ProfileId, Settings, Transaction } from '../domain/types'

type Kind = PeriodKind | 'personalizado'
const KINDS: Array<[Kind, string]> = [
  ['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['trimestre', 'Trimestre'],
  ['semestre', 'Semestre'], ['ano', 'Ano'], ['personalizado', 'Personalizado'],
]
const fmtDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const fullDate = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function rangeLabel(kind: Kind, r: Range): string {
  const y = r.from.slice(0, 4), m = Number(r.from.slice(5, 7))
  switch (kind) {
    case 'dia': { const s = fmtDay.format(new Date(`${r.from}T12:00:00Z`)); return `${s.charAt(0).toUpperCase()}${s.slice(1)} de ${y}` }
    case 'semana': return `${dateLabel(r.from)} a ${dateLabel(r.to)} de ${r.to.slice(0, 4)}`
    case 'mes': return monthLabel(monthOf(r.from))
    case 'trimestre': return `${Math.ceil(m / 3)}º trimestre de ${y}`
    case 'semestre': return `${m <= 6 ? 1 : 2}º semestre de ${y}`
    case 'ano': return y
    default: return `${fullDate(r.from)} a ${fullDate(r.to)}`
  }
}

/** Gera os recorrentes dos meses do período, até o mês atual. */
function useGenerateRange(range: Range) {
  const { repo, me } = useApp()
  useEffect(() => {
    const last = monthOf(today()) < monthOf(range.to) ? monthOf(today()) : monthOf(range.to)
    let cancel = false
    void (async () => {
      let m = monthOf(range.from), n = 0
      while (m <= last && n < 24 && !cancel) { await generateRecurrences(repo, m, me); m = addMonths(m, 1); n++ }
    })()
    return () => { cancel = true }
  }, [repo, me, range.from, range.to])
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Summary({ go }: { go: (p: 'lancamentos' | 'cartoes') => void }) {
  const { repo, me } = useApp()
  const [kind, setKind] = useState<Kind>('mes')
  const [anchor, setAnchor] = useState(today())
  const [custom, setCustom] = useState<Range>(() => periodRange('mes', today()))
  const [who, setWho] = useState<ProfileId | 'todos'>('todos')
  const [onlyPaid, setOnlyPaid] = useState(false)
  const txs = useList<Transaction>('transactions')
  const categories = useList<Category>('categories') ?? []
  const accounts = useList<Account>('accounts') ?? []
  const cards = useList<Card>('cards') ?? []
  const settings = useLive(r => r.get<Settings>('settings', 'app'))
  const names = useProfiles()

  const range: Range = kind === 'personalizado' ? custom : periodRange(kind, anchor)
  useGenerateRange(range)
  if (!txs) return null

  const now = today()
  const data = { transactions: txs, categories, cards }
  const opts = { profile: who === 'todos' ? undefined : who, onlyPaid, methodId: settings?.methodId, today: now }
  const s = periodSummary(range, data, opts)
  const cat = (id: string) => categories.find(c => c.id === id)
  const catName = (id: string) => cat(id)?.name ?? 'Sem categoria'
  const label = rangeLabel(kind, range)

  const setMethod = (methodId: string) =>
    void repo.put<Settings>('settings', { ...(settings ?? {}), id: 'app', methodId }, me)

  const exportCsv = () => {
    const ctx = { paid: paidInvoices(txs, cards), cards, today: now }
    const where = (t: Transaction) => t.cardId ? `Cartão ${cards.find(c => c.id === t.cardId)?.name ?? ''}` : accounts.find(a => a.id === t.accountId)?.name ?? ''
    const KIND = { receita: 'Receita', despesa: 'Despesa', investimento: 'Investimento' }
    const ST = { pago: 'Pago', previsto: 'Previsto', atrasado: 'Atrasado' }
    const rows = countedIn(range, data, opts)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(({ t, date }) => [fullDate(date), KIND[t.kind], catName(t.categoryId), t.note ?? '', t.amountCents,
        where(t), names[t.profileId], fullDate(t.date), t.pending ? '' : fullDate(t.paidDate ?? t.date), ST[txStatus(t, ctx)]])
    const csv = toCsv([
      [`Resumo: ${label}`], [],
      ['Entradas', s.incomeCents], ['Saídas', s.expenseCents], ['Investimentos', s.investCents],
      ['Saldo antes do investimento', s.beforeInvestCents], ['Saldo final', s.finalCents], [],
      ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor R$', 'Conta / cartão', 'Pessoa', 'Vencimento', 'Data pgto', 'Situação'],
      ...rows,
    ])
    download(`resumo-${range.from}-a-${range.to}.csv`, csv)
  }

  const upcoming = cards.flatMap(card => [monthOf(now), addMonths(monthOf(now), 1)].map(m => ({ card, ...invoiceSummary(card, m, txs) })))
    .filter(f => f.totalCents > f.paidCents)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const pts = s.series.points
  const bars = pts.map(p => ({
    label: s.series.unit === 'mes' ? MONTH_SHORT[Number(p.key.slice(5, 7)) - 1] : String(Number(p.key.slice(8, 10))),
    values: [p.incomeCents, p.expenseCents, p.investCents],
  }))
  const nothing = s.incomeCents === 0 && s.expenseCents === 0 && s.investCents === 0
  const cmp = comparePeriods(kind, kind === 'personalizado' ? custom : anchor, data, { profile: opts.profile, onlyPaid, today: now })
  const UNIT: Record<Kind, [string, string]> = {
    dia: ['dia anterior', 'dias'], semana: ['semana anterior', 'semanas'], mes: ['mês anterior', 'meses'],
    trimestre: ['trimestre anterior', 'trimestres'], semestre: ['semestre anterior', 'semestres'], ano: ['ano anterior', 'anos'],
    personalizado: ['período anterior', 'períodos iguais'],
  }
  const [prevName, plural] = UNIT[kind]
  const vsText = (cur: number, base: number, what: string) => {
    if (base <= 0) return undefined
    const p = Math.round(((cur - base) / base) * 100)
    if (p === 0) return `igual ao ${what}`
    return `${Math.abs(p)}% ${p > 0 ? 'acima' : 'abaixo'} do ${what}`
  }
  const totalsCmp = [
    ['Entradas', cmp.totals.income], ['Saídas', cmp.totals.expense], ['Investido', cmp.totals.invest],
  ].map(([label, c]) => {
    const t = vsText((c as { current: number }).current, (c as { previous: number }).previous, prevName)
    return t ? `${label as string} ${t}` : undefined
  }).filter(Boolean) as string[]

  return (
    <div className="resumo">
      <div className="title-row">
        <h1>Resumo</h1>
        <div className="btns noprint" style={{ marginTop: 0 }}>
          <button className="mini" onClick={exportCsv}>Baixar .csv</button>
          <button className="mini" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </div>

      <div className="chips noprint" role="group" aria-label="Período">
        {KINDS.map(([k, l]) => <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>{l}</button>)}
      </div>

      {kind === 'personalizado' ? (
        <div className="range noprint">
          <div className="field"><label htmlFor="r-de">De</label>
            <input id="r-de" type="date" value={custom.from} onChange={e => e.target.value && setCustom({ from: e.target.value, to: e.target.value > custom.to ? e.target.value : custom.to })} /></div>
          <div className="field"><label htmlFor="r-ate">Até</label>
            <input id="r-ate" type="date" value={custom.to} onChange={e => e.target.value && setCustom({ to: e.target.value, from: e.target.value < custom.from ? e.target.value : custom.from })} /></div>
        </div>
      ) : (
        <div className="month">
          <button className="noprint" aria-label="Período anterior" onClick={() => setAnchor(shiftPeriod(kind, anchor, -1))}>‹</button>
          <strong>{label}</strong>
          <button className="noprint" aria-label="Período seguinte" onClick={() => setAnchor(shiftPeriod(kind, anchor, 1))}>›</button>
        </div>
      )}

      <div className="filters noprint">
        <div className="seg" role="group" aria-label="Ver de quem">
          <button aria-pressed={who === 'todos'} onClick={() => setWho('todos')}>Família</button>
          <button aria-pressed={who === 'u1'} onClick={() => setWho('u1')}>{names.u1}</button>
          <button aria-pressed={who === 'u2'} onClick={() => setWho('u2')}>{names.u2}</button>
        </div>
        <div className="seg" role="group" aria-label="Considerar">
          <button aria-pressed={!onlyPaid} onClick={() => setOnlyPaid(false)}>Todos</button>
          <button aria-pressed={onlyPaid} onClick={() => setOnlyPaid(true)}>Só pagos</button>
        </div>
      </div>
      <p className="print-only">{label}{who !== 'todos' ? ` — ${names[who]}` : ''}{onlyPaid ? ' — só pagos' : ''}</p>

      <div className="sobra" role="group" aria-label="Saldo final">
        <span className="muted">Saldo final do período</span>
        <strong className={`num ${s.finalCents < 0 ? 'saida' : ''}`}>{formatBRL(s.finalCents)}</strong>
        <span className="muted">Saldo antes do investimento: <strong className="num" style={{ color: 'var(--tinta)' }}>{formatBRL(s.beforeInvestCents)}</strong></span>
      </div>
      <div className="flow three">
        <div role="group" aria-label="Entradas"><span className="muted">Entradas</span><strong className="num entrada">{formatBRL(s.incomeCents)}</strong></div>
        <div role="group" aria-label="Saídas"><span className="muted">Saídas</span><strong className="num saida">{formatBRL(s.expenseCents)}</strong></div>
        <div role="group" aria-label="Investido"><span className="muted">Investido</span><strong className="num investe">{formatBRL(s.investCents)}</strong></div>
      </div>

      {!nothing && totalsCmp.length > 0 && (
        <p className="cmp-line">{totalsCmp.join(' · ')}</p>
      )}

      {nothing && (
        <div className="list" style={{ marginTop: 20 }}>
          <p className="empty">Nada lançado neste período.{' '}
            <button className="btn sec noprint" style={{ marginTop: 12 }} onClick={() => go('lancamentos')}>Ir para Lançamentos</button>
          </p>
        </div>
      )}

      {kind !== 'dia' && !nothing && (
        <>
          <h2>{s.series.unit === 'mes' ? 'Mês a mês' : 'Dia a dia'}</h2>
          <div className="panel">
            <BarChart title={`Entradas, saídas e investimentos ${s.series.unit === 'mes' ? 'mês a mês' : 'dia a dia'}`} bars={bars}
              colors={['var(--entrada)', 'var(--saida)', 'var(--investe-cor)']} legend={['Entradas', 'Saídas', 'Investido']} />
          </div>
        </>
      )}

      <h2>Método de orçamento</h2>
      <div className="panel method">
        <div className="field">
          <label htmlFor="metodo">Variação do método</label>
          <select id="metodo" value={s.method.id} onChange={e => setMethod(e.target.value)}>
            {METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
        {s.incomeCents === 0 ? <p className="muted">Sem entradas neste período: o método compara os gastos com a renda, então não há o que comparar.</p> : (
          <ul className="buckets">
            {s.method.buckets.map(b => (
              <li key={b.key} aria-label={b.name}>
                <div className="b-head">
                  <strong>{b.name} <span className="muted">({b.pct}%)</span></strong>
                  <span className={b.inside ? 'entrada' : 'saida'} style={{ fontWeight: 700 }}>{b.inside ? 'Dentro do método' : 'Fora do método'}</span>
                </div>
                <div className={`bar ${b.inside ? '' : 'over'}`} aria-hidden="true">
                  <span style={{ width: `${b.plannedCents > 0 ? Math.min(100, b.realCents / b.plannedCents * 100) : 100}%` }} />
                </div>
                <span className="hint num">Previsto {formatBRL(b.plannedCents)} · Real {formatBRL(b.realCents)} · Diferença {formatBRL(b.diffCents)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {s.byCategory.some(c => c.kind === 'despesa') && (
        <>
          <h2>Gastos por categoria</h2>
          <ul className="list">
            {s.byCategory.filter(c => c.kind === 'despesa').map(c => {
              const over = c.budgetCents !== undefined && c.spentCents > c.budgetCents
              const near = !over && c.budgetCents !== undefined && c.spentCents >= c.budgetCents * 0.8
              const pct = c.budgetCents ? Math.min(100, (c.spentCents / c.budgetCents) * 100) : 0
              const name = catName(c.categoryId)
              const k = cmp.byCategory.get(c.categoryId)
              const va = k?.vsAveragePct !== undefined && Math.abs(k.vsAveragePct) >= 15 ? Math.round(k.vsAveragePct) : undefined
              return (
                <li key={c.categoryId} aria-label={name} style={{ padding: '14px 16px' }} className="cat-line">
                  <CatIcon category={cat(c.categoryId)} size={38} />
                  <div style={{ minWidth: 0 }}>
                  <div className="b-head"><strong>{name}</strong><span className="num" style={{ fontWeight: 800 }}>{formatBRL(c.spentCents)}</span></div>
                  {va !== undefined && (
                    <div className={`trend ${va > 0 ? 'up' : 'down'}`}>{`${Math.abs(va)}% ${va > 0 ? 'acima' : 'abaixo'} da média dos últimos ${Math.min(6, cmp.periodsInAverage)} ${plural}`}</div>
                  )}
                  {c.budgetCents !== undefined && (
                    <>
                      <div className={`bar ${over ? 'over' : near ? 'near' : ''}`} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                      <div className={`num ${over ? 'saida' : near ? 'aviso-txt' : 'muted'}`} style={{ fontSize: 13, marginTop: 4 }}>
                        {over ? `Acima do orçamento em ${formatBRL(c.spentCents - c.budgetCents)}` : `${near ? `${Math.round(pct)}% usado — ` : ''}Restam ${formatBRL(c.budgetCents - c.spentCents)} de ${formatBRL(c.budgetCents)}`}
                      </div>
                    </>
                  )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {s.byCategory.some(c => c.kind !== 'despesa') && (
        <>
          <h2>Entradas e investimentos por categoria</h2>
          <ul className="list">
            {s.byCategory.filter(c => c.kind !== 'despesa').map(c => (
              <li key={c.categoryId} style={{ padding: '12px 16px' }} className="b-head">
                <strong>{catName(c.categoryId)}</strong>
                <span className={`num ${c.kind === 'receita' ? 'entrada' : 'investe'}`} style={{ fontWeight: 700 }}>{formatBRL(c.spentCents)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {who === 'todos' && !nothing && (
        <>
          <h2>{names.u1} e {names.u2}</h2>
          <div style={{ overflowX: 'auto' }}>
            <table className="compare num">
              <thead><tr><th scope="col"></th><th scope="col">Entradas</th><th scope="col">Saídas</th><th scope="col">Investido</th></tr></thead>
              <tbody>
                {(['u1', 'u2'] as ProfileId[]).map(p => (
                  <tr key={p}>
                    <th scope="row">{names[p]}</th>
                    <td className="entrada">{formatBRL(s.byProfile[p].incomeCents)}</td>
                    <td className="saida">{formatBRL(s.byProfile[p].expenseCents)}</td>
                    <td className="investe">{formatBRL(s.byProfile[p].investCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {upcoming.length > 0 && (
        <div className="noprint">
          <h2>Próximas faturas</h2>
          <ul className="list">
            {upcoming.map(f => (
              <li key={`${f.card.id}-${f.dueDate}`}>
                <button className="row" onClick={() => go('cartoes')}>
                  <strong>{f.card.name}</strong>
                  <span className="val num">{formatBRL(f.totalCents - f.paidCents)}</span>
                  <span className={`sub ${f.dueDate < now ? 'saida' : ''}`}>{f.dueDate < now ? 'Venceu' : 'Vence'} em {dateLabel(f.dueDate)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
