import { useEffect, useState } from 'react'
import { useApp, useList, useProfiles } from './context'
import { currentMonth, dateLabel, monthLabel, MonthNav, useMonth } from './common'
import { TransactionForm } from './TransactionForm'
import { formatBRL } from '../domain/money'
import { competenceMonth } from '../domain/summary'
import { paidInvoices, txStatus, type TxStatus } from '../domain/status'
import { today } from '../domain/dates'
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
  const [statusFilter, setStatusFilter] = useState<TxStatus | 'todos'>('todos')
  const { repo, me } = useApp()
  const [editing, setEditing] = useState<Transaction | 'novo'>()
  const txs = useList<Transaction>('transactions')
  const cats = useList<Category>('categories') ?? []
  const accounts = useList<Account>('accounts') ?? []
  const cards = useList<Card>('cards') ?? []
  const names = useProfiles()
  useGenerateRecurrences(month)

  const name = (list: Array<{ id: string; name: string }>, id?: string) => list.find(x => x.id === id)?.name ?? ''
  const now = today()
  const ctx = { paid: paidInvoices(txs ?? [], cards), cards, today: now }
  const inMonth = (txs ?? [])
    .filter(t => competenceMonth(t) === month && (filter === 'todos' || t.profileId === filter))
    .map(t => ({ t, st: txStatus(t, ctx) }))
  const count = (st: TxStatus) => inMonth.filter(r => r.st === st && !r.t.cardPayment).length
  const rows = inMonth
    .filter(r => statusFilter === 'todos' || (r.st === statusFilter && !r.t.cardPayment))
    .sort((a, b) => b.t.date.localeCompare(a.t.date) || b.t.updatedAt - a.t.updatedAt)

  const markPaid = (t: Transaction) => {
    const next: Transaction = { ...t, paidDate: now }
    delete next.pending
    void repo.put<Transaction>('transactions', next, me)
  }
  const STATUS_LABEL: Record<TxStatus, string> = { pago: 'Pago', previsto: 'Previsto', atrasado: 'Atrasado' }

  return (
    <>
      <h1>Lançamentos</h1>
      <MonthNav month={month} setMonth={setMonth} />
      <div className="seg" role="group" aria-label="Filtrar por pessoa" style={{ marginBottom: 16 }}>
        <button aria-pressed={filter === 'todos'} onClick={() => setFilter('todos')}>Todos</button>
        <button aria-pressed={filter === 'u1'} onClick={() => setFilter('u1')}>{names.u1}</button>
        <button aria-pressed={filter === 'u2'} onClick={() => setFilter('u2')}>{names.u2}</button>
      </div>
      <div className="chips" role="group" aria-label="Filtrar por situação">
        <button aria-pressed={statusFilter === 'todos'} onClick={() => setStatusFilter('todos')}>Todos</button>
        <button aria-pressed={statusFilter === 'atrasado'} onClick={() => setStatusFilter('atrasado')}>Atrasados ({count('atrasado')})</button>
        <button aria-pressed={statusFilter === 'previsto'} onClick={() => setStatusFilter('previsto')}>Previstos ({count('previsto')})</button>
        <button aria-pressed={statusFilter === 'pago'} onClick={() => setStatusFilter('pago')}>Pagos</button>
      </div>

      {txs && rows.length === 0 && (
        <div className="list"><p className="empty">Nada lançado em {monthLabel(month)}. Toque em + para lançar.</p></div>
      )}
      {rows.length > 0 && (
        <ul className="list">
          {rows.map(({ t, st }) => {
            const where = t.cardId ? `Cartão ${name(cards, t.cardId)}` : name(accounts, t.accountId)
            const parcela = t.installment ? `, parcela ${t.installment.n} de ${t.installment.total}` : ''
            const title = `${name(cats, t.categoryId) || 'Sem categoria'}${parcela}${t.note ? ` — ${t.note}` : ''}`
            const when = st === 'pago'
              ? `${t.kind === 'receita' ? 'Recebido' : 'Pago'} ${dateLabel(t.paidDate ?? t.date)}`
              : `${st === 'atrasado' ? 'Venceu' : 'Vence'} ${dateLabel(t.date)}`
            const sign = t.kind === 'receita' ? '+' : t.kind === 'investimento' ? '→ ' : '−'
            const cls = t.kind === 'receita' ? 'entrada' : t.kind === 'investimento' ? 'investe' : 'saida'
            const canMark = st !== 'pago' && !t.cardId && !t.cardPayment
            return (
              <li key={t.id} aria-label={title} className="txrow">
                <button className="row" onClick={() => setEditing(t)}>
                  <span><strong>{title}</strong></span>
                  <span className={`val num ${cls}`}>{sign}{formatBRL(t.amountCents)}</span>
                  <span className="sub">{when}, {where}, {names[t.profileId]}{t.kind === 'investimento' ? ', investimento' : ''}</span>
                </button>
                <div className="acts">
                  {!t.cardPayment && <span className={`badge ${st}`}>{STATUS_LABEL[st]}</span>}
                  {canMark && <button className="mini" onClick={() => markPaid(t)}>Marcar como pago</button>}
                </div>
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
