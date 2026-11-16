import { useState } from 'react'
import { useList, useLive } from './context'
import { openWithStatus } from './Transactions'
import type { Page } from './pages'
import { formatBRL } from '../domain/money'
import { monthOf, today } from '../domain/dates'
import { dashboard } from '../domain/report'
import { countedIn, periodRange, periodSummary } from '../domain/period'
import { paidInvoices, txStatus } from '../domain/status'
import type { Card, Category, Settings, Transaction } from '../domain/types'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const C = { in: '#12795f', out: '#b8432f', inv: '#2f5d9e', ink: '#1d3557' }
type Series = 'fluxo' | 'investido' | 'saldo'

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Anel de progresso: quanto do previsto pelo método já foi usado. */
function Ring({ value, inside, label }: { value: number; inside: boolean; label: string }) {
  const r = 26, len = 2 * Math.PI * r
  const shown = Math.min(1, value)
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={label}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="#e6ecea" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={inside ? C.in : C.out} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${len * shown} ${len}`} transform="rotate(-90 32 32)" />
      <text x="32" y="36.5" textAnchor="middle" fontSize="13" fontWeight="800" fill={C.ink}>{Math.round(value * 100)}%</text>
    </svg>
  )
}

/** Painel: a visão do ano, primeira tela do app (cartões e gráficos da aba DASHBOARD da planilha). */
export function Dashboard({ go }: { go: (p: Page) => void }) {
  const now = today()
  const [year, setYear] = useState(Number(now.slice(0, 4)))
  const [onlyPaid, setOnlyPaid] = useState(false)
  const [series, setSeries] = useState<Series>('fluxo')
  const [picked, setPicked] = useState<number>()
  const txs = useList<Transaction>('transactions')
  const categories = useList<Category>('categories') ?? []
  const cards = useList<Card>('cards') ?? []
  const settings = useLive(r => r.get<Settings>('settings', 'app'))
  if (!txs) return null

  const data = { transactions: txs, categories, cards }
  const d = dashboard(year, data, { onlyPaid, today: now })
  const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` }
  const ys = periodSummary(yearRange, data, { onlyPaid, today: now })
  const isThisYear = String(year) === now.slice(0, 4)
  const curMonth = isThisYear ? Number(now.slice(5, 7)) - 1 : 11
  const sel = picked ?? curMonth
  const m = d.months[sel]

  // Atrasados de qualquer mês: é o que falta pagar.
  const ctx = { paid: paidInvoices(txs, cards), cards, today: now }
  const overdue = txs.filter(t => !t.deletedAt && !t.cardPayment && txStatus(t, ctx) === 'atrasado')
  const overdueOut = overdue.filter(t => t.kind !== 'receita')
  const overdueIn = overdue.filter(t => t.kind === 'receita')
  const sum = (list: Transaction[]) => list.reduce((s, t) => s + t.amountCents, 0)

  // Para onde foi o dinheiro que entrou no ano.
  const inc = ys.incomeCents, out = ys.expenseCents, inv = ys.investCents
  const left = Math.max(0, inc - out - inv)
  const base = Math.max(inc, out + inv, 1)
  const split = [
    { key: 'Despesas', v: out, color: C.out },
    { key: 'Investido', v: inv, color: '#7aa2dc' },
    { key: 'Sobrou', v: left, color: '#5fc29f' },
  ]

  // Método neste mês.
  const monthRange = periodRange('mes', isThisYear ? now : `${year}-12-15`)
  const ms = periodSummary(monthRange, data, { onlyPaid, methodId: settings?.methodId, today: now })

  // Onde mais gastaram no ano.
  const top = ys.byCategory.filter(c => c.kind === 'despesa' && c.spentCents > 0).slice(0, 5)
  const topMax = Math.max(1, ...top.map(c => c.spentCents))
  const cat = (id: string) => categories.find(c => c.id === id)

  // Gráfico do ano.
  const vals = d.months.map(x => series === 'fluxo' ? [x.incomeCents, x.expenseCents]
    : series === 'investido' ? [x.investCents] : [Math.abs(x.finalCents)])
  const max = Math.max(1, ...vals.flat())
  const colorsFor = (i: number) => series === 'fluxo' ? [C.in, C.out]
    : series === 'investido' ? [C.inv] : [d.months[i].finalCents < 0 ? C.out : C.ink]
  const seriesTitle = { fluxo: 'Entradas e saídas', investido: 'Investido', saldo: 'Saldo final' }[series]
  const hasYearData = inc + out + inv > 0
  const futureTx = countedIn(yearRange, data, { today: now }).length > 0

  return (
    <div className="dash">
      <div className="dash-top">
        <h1>Painel</h1>
        <div className="year-switch">
          <button aria-label="Ano anterior" onClick={() => { setYear(year - 1); setPicked(undefined) }}>‹</button>
          <strong>{year}</strong>
          <button aria-label="Ano seguinte" onClick={() => { setYear(year + 1); setPicked(undefined) }}>›</button>
        </div>
      </div>

      <section className="hero" role="group" aria-label={`Saldo final de ${year}`}>
        <div className="hero-head">
          <span>Saldo final de {year}</span>
          <div className="hero-seg" role="group" aria-label="Considerar">
            <button aria-pressed={!onlyPaid} onClick={() => setOnlyPaid(false)}>Todos</button>
            <button aria-pressed={onlyPaid} onClick={() => setOnlyPaid(true)}>Só pagos</button>
          </div>
        </div>
        <strong className="hero-value num">{formatBRL(ys.finalCents)}</strong>
        <div className="hero-stats">
          <span><i style={{ background: '#5fc29f' }} />Entradas <b className="num">{formatBRL(inc)}</b></span>
          <span><i style={{ background: '#f08b74' }} />Saídas <b className="num">{formatBRL(out)}</b></span>
          <span><i style={{ background: '#7aa2dc' }} />Investido <b className="num">{formatBRL(inv)}</b></span>
        </div>
        {hasYearData && (
          <>
            <div className="split" role="img"
              aria-label={`Para onde foi o dinheiro: ${split.map(s => `${s.key.toLowerCase()} ${pct(s.v, base)}%`).join(', ')}`}>
              {split.filter(s => s.v > 0).map(s => <span key={s.key} style={{ flexGrow: s.v, background: s.color }} />)}
            </div>
            <div className="split-legend" aria-hidden="true">
              {split.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.key} {pct(s.v, base)}%</span>)}
            </div>
            <p className="hero-note">Para onde foi o dinheiro que entrou em {year}.</p>
          </>
        )}
      </section>

      <div className="alerts">
        {overdueOut.length > 0 && (
          <button className="alert out" onClick={() => { openWithStatus('atrasado'); go('lancamentos') }}>
            <b>{plural(overdueOut.length, 'conta atrasada', 'contas atrasadas')}</b>
            <span className="num">{formatBRL(sum(overdueOut))}</span>
            <em>Ver e marcar como pago</em>
          </button>
        )}
        {overdueIn.length > 0 && (
          <button className="alert in" onClick={() => { openWithStatus('atrasado'); go('lancamentos') }}>
            <b>{plural(overdueIn.length, 'receita atrasada', 'receitas atrasadas')}</b>
            <span className="num">{formatBRL(sum(overdueIn))}</span>
            <em>Ver lançamentos</em>
          </button>
        )}
        {overdue.length === 0 && <p className="alert ok">Nenhuma conta atrasada.</p>}
      </div>

      <div className="kpis">
        <div role="group" aria-label="Receitas pagas no ano"><span>Receitas pagas no ano</span><strong className="num entrada">{formatBRL(d.paidIncomeCents)}</strong></div>
        <div role="group" aria-label="Despesas pagas no ano"><span>Despesas pagas no ano</span><strong className="num saida">{formatBRL(d.paidExpenseCents)}</strong></div>
        <div role="group" aria-label="Investido no ano (pago)"><span>Investido no ano (pago)</span><strong className="num investe">{formatBRL(d.paidInvestCents)}</strong></div>
        <div role="group" aria-label="Despesas atrasadas"><span>Despesas atrasadas no ano</span><strong className="num">{formatBRL(d.overdueExpenseCents)}</strong></div>
      </div>

      <section className="panel chart-card" role="group" aria-label={`${seriesTitle} mês a mês`}>
        <div className="b-head">
          <h2>Mês a mês</h2>
          <div className="chips small" role="group" aria-label="O que mostrar">
            <button aria-pressed={series === 'fluxo'} onClick={() => setSeries('fluxo')}>Entradas e saídas</button>
            <button aria-pressed={series === 'investido'} onClick={() => setSeries('investido')}>Investido</button>
            <button aria-pressed={series === 'saldo'} onClick={() => setSeries('saldo')}>Saldo</button>
          </div>
        </div>
        <div className="months">
          {d.months.map((x, i) => (
            <button key={i} className={`mcol ${i === sel ? 'sel' : ''} ${isThisYear && i > curMonth ? 'future' : ''}`}
              aria-pressed={i === sel}
              aria-label={`${MONTHS[i]}: entradas ${formatBRL(x.incomeCents)}, saídas ${formatBRL(x.expenseCents)}, investido ${formatBRL(x.investCents)}, saldo final ${formatBRL(x.finalCents)}`}
              onClick={() => setPicked(i)}>
              <span className="mbars">
                {vals[i].map((v, j) => <span key={j} style={{ height: `${v > 0 ? Math.max(3, (v / max) * 100) : 0}%`, background: colorsFor(i)[j] }} />)}
              </span>
              <span className="mlabel">{MONTHS[i]}</span>
            </button>
          ))}
        </div>
        <div className="picked" role="group" aria-label="Mês escolhido">
          <strong className="picked-title">{MONTHS_FULL[sel]} de {year}</strong>
          <div className="picked-grid">
            <span>Entradas<b className="num entrada">{formatBRL(m.incomeCents)}</b></span>
            <span>Saídas<b className="num saida">{formatBRL(m.expenseCents)}</b></span>
            <span>Investido<b className="num investe">{formatBRL(m.investCents)}</b></span>
            <span>Saldo final<b className={`num ${m.finalCents < 0 ? 'saida' : ''}`}>{formatBRL(m.finalCents)}</b></span>
          </div>
        </div>
      </section>

      {ms.incomeCents > 0 && (
        <button className="panel method-card" onClick={() => go('resumo')} aria-label={`Método neste mês: ${ms.method.label}. Abrir o Resumo`}>
          <div className="b-head">
            <h2>Método em {MONTHS_FULL[Number(monthOf(monthRange.from).slice(5)) - 1]}</h2>
            <span className="muted" style={{ fontSize: 13 }}>{ms.method.label.split(' – ')[0]}</span>
          </div>
          <div className="rings">
            {ms.method.buckets.map(b => (
              <div key={b.key} className="ring">
                <Ring value={b.plannedCents > 0 ? b.realCents / b.plannedCents : 0} inside={b.inside}
                  label={`${b.name}: ${formatBRL(b.realCents)} de ${formatBRL(b.plannedCents)} previstos, ${b.inside ? 'dentro' : 'fora'} do método`} />
                <b>{b.name}</b>
                <span className="num">{formatBRL(b.realCents)}</span>
                <span className={b.inside ? 'entrada' : 'saida'}>{b.inside ? 'Dentro' : 'Fora'}</span>
              </div>
            ))}
          </div>
        </button>
      )}

      {top.length > 0 && (
        <section className="panel">
          <h2 style={{ marginTop: 0 }}>Onde mais gastaram em {year}</h2>
          <ul className="top">
            {top.map(c => {
              const k = cat(c.categoryId)
              return (
                <li key={c.categoryId}>
                  <div className="b-head">
                    <span><b>{k?.name ?? 'Sem categoria'}</b> <small className={`tag ${k?.group === 'necessidade' ? 'need' : 'want'}`}>{k?.group === 'necessidade' ? 'Necessidade' : 'Desejo'}</small></span>
                    <span className="num" style={{ fontWeight: 700 }}>{formatBRL(c.spentCents)}</span>
                  </div>
                  <div className="topbar" aria-hidden="true"><span style={{ width: `${(c.spentCents / topMax) * 100}%` }} /></div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!futureTx && (
        <div className="list"><p className="empty">Nada lançado em {year}. Comece pelo + em Lançamentos.</p></div>
      )}
    </div>
  )
}
