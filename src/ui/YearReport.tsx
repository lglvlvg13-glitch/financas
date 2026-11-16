import { useState } from 'react'
import { useList, useLive } from './context'
import { formatBRL } from '../domain/money'
import { today } from '../domain/dates'
import { yearReport } from '../domain/report'
import { toCsv } from '../domain/csv'
import type { Card, Category, Settings, Transaction } from '../domain/types'

const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const cell = (v: number) => (v === 0 ? '–' : formatBRL(v).replace('R$ ', ''))

/** Como a aba RELATÓRIO FINANCEIRO: cada categoria mês a mês, saldos e o método 50/30/20 do ano. */
export function YearReport() {
  const [year, setYear] = useState(Number(today().slice(0, 4)))
  const [onlyPaid, setOnlyPaid] = useState(false)
  const txs = useList<Transaction>('transactions')
  const categories = useList<Category>('categories') ?? []
  const cards = useList<Card>('cards') ?? []
  const settings = useLive(r => r.get<Settings>('settings', 'app'))
  if (!txs) return null
  const r = yearReport(year, { transactions: txs, categories, cards }, { onlyPaid, today: today() })
  const method = r.summary(settings?.methodId).method

  const exportCsv = () => {
    const csv = toCsv([['Categoria', ...MONTHS, 'Total do ano'], ...r.rows.map(x => [x.label, ...x.values, x.total])])
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `relatorio-${year}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <>
      <div className="title-row">
        <h1>Relatório do ano</h1>
        <div className="btns noprint" style={{ marginTop: 0 }}>
          <button className="mini" onClick={exportCsv}>Baixar .csv</button>
          <button className="mini" onClick={() => window.print()}>Imprimir / PDF</button>
        </div>
      </div>
      <div className="month">
        <button className="noprint" aria-label="Ano anterior" onClick={() => setYear(year - 1)}>‹</button>
        <strong>{year}</strong>
        <button className="noprint" aria-label="Ano seguinte" onClick={() => setYear(year + 1)}>›</button>
      </div>
      <div className="filters noprint">
        <div className="seg" role="group" aria-label="Considerar">
          <button aria-pressed={!onlyPaid} onClick={() => setOnlyPaid(false)}>Todos</button>
          <button aria-pressed={onlyPaid} onClick={() => setOnlyPaid(true)}>Só pagos</button>
        </div>
      </div>
      <div className="report-wrap">
        <table className="report">
          <thead>
            <tr><th scope="col" style={{ textAlign: 'left', paddingLeft: 14 }}>Categoria</th>{MONTHS.map(m => <th scope="col" key={m}>{m}</th>)}<th scope="col">Total do ano</th></tr>
          </thead>
          <tbody>
            {r.rows.map((x, i) => (
              <tr key={i} className={x.level}>
                <th scope="row" className={x.level === 'total' ? (x.kind === 'receita' ? 'entrada' : x.kind === 'despesa' ? 'saida' : 'investe') : ''}>{x.label}</th>
                {x.values.map((v, j) => <td key={j} className={v < 0 ? 'saida' : ''}>{cell(v)}</td>)}
                <td className={x.total < 0 ? 'saida' : ''}>{cell(x.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Método no ano: {method.label}</h2>
      <div className="panel">
        <ul className="buckets">
          {method.buckets.map(b => (
            <li key={b.key} aria-label={b.name}>
              <div className="b-head">
                <strong>{b.name} <span className="muted">({b.pct}%)</span></strong>
                <span className={b.inside ? 'entrada' : 'saida'} style={{ fontWeight: 700 }}>{b.inside ? 'Dentro do método' : 'Fora do método'}</span>
              </div>
              <span className="hint num">Previsto {formatBRL(b.plannedCents)} · Real {formatBRL(b.realCents)} · Diferença {formatBRL(b.diffCents)}</span>
            </li>
          ))}
        </ul>
        <div className="b-head" style={{ borderTop: '1px solid var(--linha)', paddingTop: 12, marginTop: 14 }}>
          <span className="muted">Saldo final projetado pelo método</span><strong className="num">{formatBRL(method.plannedFinalCents)}</strong>
        </div>
        <div className="b-head" style={{ marginTop: 6 }}>
          <span className="muted">Saldo final real</span><strong className="num">{formatBRL(method.realFinalCents)}</strong>
        </div>
        <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>A variação é a escolhida no Resumo.</p>
      </div>
    </>
  )
}
