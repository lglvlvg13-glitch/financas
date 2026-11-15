import { useEffect, useState } from 'react'
import { useApp, useList, useProfiles } from './context'
import { currentMonth, dateLabel, monthLabel, MonthNav, useMonth } from './common'
import { TransactionForm } from './TransactionForm'
import { formatBRL } from '../domain/money'
import { competenceMonth } from '../domain/summary'
import { generateRecurrences } from '../data/recurring'
import type { Account, Card, Category, ProfileId, Recurrence, Transaction } from '../domain/types'

/** Gera os lançamentos recorrentes do mês (só até o mês atual). */
export function useGenerateRecurrences(month: string) {
  const { repo, me } = useApp()
  const recs = useList<Recurrence>('recurrences')
  useEffect(() => {
    if (!recs || month > currentMonth()) return
    void generateRecurrences(repo, month, me)
  }, [repo, me, recs, month])
}

export function Transactions() {
  const [month, setMonth] = useMonth()
  const [filter, setFilter] = useState<ProfileId | 'todos'>('todos')
  const [editing, setEditing] = useState<Transaction | 'novo'>()
  const txs = useList<Transaction>('transactions')
  const cats = useList<Category>('categories') ?? []
  const accounts = useList<Account>('accounts') ?? []
  const cards = useList<Card>('cards') ?? []
  const names = useProfiles()
  useGenerateRecurrences(month)

  const name = (list: Array<{ id: string; name: string }>, id?: string) => list.find(x => x.id === id)?.name ?? ''
  const rows = (txs ?? [])
    .filter(t => competenceMonth(t) === month && (filter === 'todos' || t.profileId === filter))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt)

  return (
    <>
      <h1>Lançamentos</h1>
      <MonthNav month={month} setMonth={setMonth} />
      <div className="seg" role="group" aria-label="Filtrar por pessoa" style={{ marginBottom: 16 }}>
        <button aria-pressed={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</button>
        <button aria-pressed={filter === 'u1'} onClick={() => setFilter('u1')}>{names.u1}</button>
        <button aria-pressed={filter === 'u2'} onClick={() => setFilter('u2')}>{names.u2}</button>
      </div>

      {txs && rows.length === 0 && (
        <div className="list"><p className="empty">Nada lançado em {monthLabel(month)}. Toque em + para lançar.</p></div>
      )}
      {rows.length > 0 && (
        <ul className="list">
          {rows.map(t => {
            const where = t.cardId ? `Cartão ${name(cards, t.cardId)}` : name(accounts, t.accountId)
            const parcela = t.installment ? `, parcela ${t.installment.n} de ${t.installment.total}` : ''
            return (
              <li key={t.id}>
                <button className="row" onClick={() => setEditing(t)}>
                  <span><strong>{name(cats, t.categoryId) || 'Sem categoria'}</strong>{parcela}{t.note ? ` — ${t.note}` : ''}</span>
                  <span className={`val num ${t.kind === 'receita' ? 'entrada' : 'saida'}`}>
                    {t.kind === 'receita' ? '+' : '−'}{formatBRL(t.amountCents)}
                  </span>
                  <span className="sub">{dateLabel(t.date)}, {where}, {names[t.profileId]}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <button className="fab" aria-label="Novo lançamento" onClick={() => setEditing('novo')}>+</button>
      {editing && <TransactionForm initial={editing === 'novo' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}
