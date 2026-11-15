import { useState } from 'react'
import { useList, useProfiles } from './context'
import { dateLabel, MonthNav, useMonth } from './common'
import { useGenerateRecurrences } from './Transactions'
import { formatBRL } from '../domain/money'
import { addMonths, today } from '../domain/dates'
import { invoiceSummary } from '../domain/invoice'
import { monthSummary } from '../domain/summary'
import type { Account, Card, Category, ProfileId, Transaction } from '../domain/types'

export function Summary({ go }: { go: (p: 'lancamentos' | 'cartoes') => void }) {
  const [month, setMonth] = useMonth()
  const [who, setWho] = useState<ProfileId | 'todos'>('todos')
  const txs = useList<Transaction>('transactions')
  const categories = useList<Category>('categories') ?? []
  const accounts = useList<Account>('accounts') ?? []
  const cards = useList<Card>('cards') ?? []
  const names = useProfiles()
  useGenerateRecurrences(month)

  if (!txs) return null
  const s = monthSummary(month, { transactions: txs, categories, accounts }, who === 'todos' ? undefined : who)
  const catName = (id: string) => categories.find(c => c.id === id)?.name ?? 'Sem categoria'

  // Próximas faturas: deste mês e do seguinte, ainda não pagas e não vencidas.
  const now = today()
  const upcoming = cards.flatMap(card => [month, addMonths(month, 1)].map(m => ({ card, ...invoiceSummary(card, m, txs) })))
    .filter(f => f.totalCents > f.paidCents && f.dueDate >= now)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return (
    <>
      <h1>Resumo</h1>
      <MonthNav month={month} setMonth={setMonth} />
      <div className="seg" role="group" aria-label="Ver de quem" style={{ marginBottom: 20 }}>
        <button aria-pressed={who === 'todos'} onClick={() => setWho('todos')}>Família</button>
        <button aria-pressed={who === 'u1'} onClick={() => setWho('u1')}>{names.u1}</button>
        <button aria-pressed={who === 'u2'} onClick={() => setWho('u2')}>{names.u2}</button>
      </div>

      <div className="sobra" role="group" aria-label="Sobra do mês">
        <span className="muted">Sobra do mês</span>
        <strong className={`num ${s.balanceCents < 0 ? 'saida' : ''}`}>{formatBRL(s.balanceCents)}</strong>
      </div>
      <div className="flow">
        <div role="group" aria-label="Entradas">
          <span className="muted">Entradas</span>
          <strong className="num entrada">{formatBRL(s.incomeCents)}</strong>
        </div>
        <div role="group" aria-label="Saídas">
          <span className="muted">Saídas</span>
          <strong className="num saida">{formatBRL(s.expenseCents)}</strong>
        </div>
      </div>

      {s.incomeCents === 0 && s.expenseCents === 0 && (
        <div className="list" style={{ marginTop: 20 }}>
          <p className="empty">Nada lançado neste mês.{' '}
            <button className="btn sec" style={{ marginTop: 12 }} onClick={() => go('lancamentos')}>Ir para Lançamentos</button>
          </p>
        </div>
      )}

      {s.byCategory.length > 0 && (
        <>
          <h2>Gastos por categoria</h2>
          <ul className="list">
            {s.byCategory.map(c => {
              const over = c.budgetCents !== undefined && c.spentCents > c.budgetCents
              const pct = c.budgetCents ? Math.min(100, (c.spentCents / c.budgetCents) * 100) : 0
              const name = catName(c.categoryId)
              return (
                <li key={c.categoryId} aria-label={name} style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong>{name}</strong>
                    <span className="num" style={{ fontWeight: 700 }}>{formatBRL(c.spentCents)}</span>
                  </div>
                  {c.budgetCents !== undefined && (
                    <>
                      <div className={`bar ${over ? 'over' : ''}`} aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
                      <div className={`num ${over ? 'saida' : 'muted'}`} style={{ fontSize: 13, marginTop: 4 }}>
                        {over
                          ? `Acima do orçamento em ${formatBRL(c.spentCents - c.budgetCents)}`
                          : `Restam ${formatBRL(c.budgetCents - c.spentCents)} de ${formatBRL(c.budgetCents)}`}
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      {who === 'todos' && (s.incomeCents > 0 || s.expenseCents > 0) && (
        <>
          <h2>{names.u1} e {names.u2}</h2>
          <table className="compare num">
            <thead><tr><th scope="col"></th><th scope="col">Entradas</th><th scope="col">Saídas</th></tr></thead>
            <tbody>
              {(['u1', 'u2'] as ProfileId[]).map(p => (
                <tr key={p}>
                  <th scope="row">{names[p]}</th>
                  <td className="entrada">{formatBRL(s.byProfile[p].incomeCents)}</td>
                  <td className="saida">{formatBRL(s.byProfile[p].expenseCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {upcoming.length > 0 && (
        <>
          <h2>Próximas faturas</h2>
          <ul className="list">
            {upcoming.map(f => (
              <li key={`${f.card.id}-${f.dueDate}`}>
                <button className="row" onClick={() => go('cartoes')}>
                  <strong>{f.card.name}</strong>
                  <span className="val num">{formatBRL(f.totalCents - f.paidCents)}</span>
                  <span className="sub">Vence em {dateLabel(f.dueDate)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
