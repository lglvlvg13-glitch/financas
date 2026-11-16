import { useState } from 'react'
import { useList } from './context'
import { BarChart } from './charts'
import { formatBRL } from '../domain/money'
import { today } from '../domain/dates'
import { dashboard } from '../domain/report'
import type { Card, Category, Transaction } from '../domain/types'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** Como a aba DASHBOARD da planilha: cartões do ano e gráficos mês a mês. */
export function Dashboard() {
  const [year, setYear] = useState(Number(today().slice(0, 4)))
  const [onlyPaid, setOnlyPaid] = useState(false)
  const txs = useList<Transaction>('transactions')
  const categories = useList<Category>('categories') ?? []
  const cards = useList<Card>('cards') ?? []
  if (!txs) return null
  const d = dashboard(year, { transactions: txs, categories, cards }, { onlyPaid, today: today() })

  const CARDS: Array<[string, number, string]> = [
    ['Despesas atrasadas', d.overdueExpenseCents, 'saida'],
    ['Receitas atrasadas', d.overdueIncomeCents, ''],
    ['Investido no ano (pago)', d.paidInvestCents, 'investe'],
    ['Despesas pagas no ano', d.paidExpenseCents, 'saida'],
    ['Receitas pagas no ano', d.paidIncomeCents, 'entrada'],
    ['Saldo final (pago)', d.finalCents, d.finalCents < 0 ? 'saida' : ''],
  ]
  const CHARTS: Array<[string, keyof (typeof d.months)[number], string]> = [
    ['Entradas', 'incomeCents', '#12795f'],
    ['Saídas', 'expenseCents', '#b8432f'],
    ['Investimentos', 'investCents', '#2f5d9e'],
    ['Saldo (entradas − saídas)', 'beforeInvestCents', '#4a5d78'],
    ['Saldo final (− investimentos)', 'finalCents', '#1d3557'],
  ]

  return (
    <>
      <h1>Painel</h1>
      <div className="month">
        <button aria-label="Ano anterior" onClick={() => setYear(year - 1)}>‹</button>
        <strong>{year}</strong>
        <button aria-label="Ano seguinte" onClick={() => setYear(year + 1)}>›</button>
      </div>
      <div className="filters">
        <div className="seg" role="group" aria-label="Gráficos consideram">
          <button aria-pressed={!onlyPaid} onClick={() => setOnlyPaid(false)}>Todos</button>
          <button aria-pressed={onlyPaid} onClick={() => setOnlyPaid(true)}>Só pagos</button>
        </div>
      </div>
      <div className="cards">
        {CARDS.map(([label, v, cls]) => (
          <div key={label} role="group" aria-label={label}>
            <span className="muted" style={{ fontSize: 13 }}>{label}</span>
            <strong className={`num ${cls}`}>{formatBRL(v)}</strong>
          </div>
        ))}
      </div>
      <h2>Mês a mês</h2>
      <div className="charts">
        {CHARTS.map(([title, key, color]) => {
          const values = d.months.map(m => m[key])
          return (
            <div className="panel" key={title}>
              <div className="b-head" style={{ marginBottom: 8 }}>
                <strong>{title}</strong>
                <span className="muted num" style={{ fontSize: 13 }}>{formatBRL(values.reduce((a, b) => a + b, 0))} no ano</span>
              </div>
              <BarChart title={`${title} mês a mês`} height={80} colors={[color]}
                bars={values.map((v, i) => ({ label: MONTHS[i], values: [Math.max(0, v)] }))} />
            </div>
          )
        })}
      </div>
    </>
  )
}
