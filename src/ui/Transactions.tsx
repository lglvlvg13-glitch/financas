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

/** Filtro pedido por outra tela (ex.: Painel → "contas atrasadas"); vale só para a próxima abertura. */
let requestedStatus: TxStatus | undefined
let requestedNew = false
/** Abre a lista já com o formulário de novo lançamento (atalho do ícone). */
export function openNewEntry() { requestedNew = true }
export function openWithStatus(st: TxStatus) { requestedStatus = st }

export function Transactions({ go }: { go?: (p: 'importar') => void } = {}) {
  const [month, setMonth] = useMonth()
  const [filter, setFilter] = useState<ProfileId | 'todos'>('todos')
  const [statusFilter, setStatusFilter] = useState<TxStatus | 'todos'>(() => {
    const st = requestedStatus ?? 'todos'
    requestedStatus = undefined
    return st
  })
  const { repo, me } = useApp()
  const [q, setQ] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [fCat, setFCat] = useState('')
  const [fWhere, setFWhere] = useState('')
  const [editing, setEditing] = useState<Transaction | 'novo' | undefined>(() => { const n = requestedNew; requestedNew = false; return n ? 'novo' : undefined })
  const txs = useList<Transaction>('transactions')
  const cats = useList<Category>('categories') ?? []
  const accounts = useList<Account>('accounts') ?? []
  const cards = useList<Card>('cards') ?? []
  const names = useProfiles()
  useGenerateRecurrences(month)

  const name = (list: Array<{ id: string; name: string }>, id?: string) => list.find(x => x.id === id)?.name ?? ''
  const now = today()
  const ctx = { paid: paidInvoices(txs ?? [], cards), cards, today: now }
  const all = (txs ?? []).filter(t => filter === 'todos' || t.profileId === filter).map(t => ({ t, st: txStatus(t, ctx) }))
  const inMonth = all.filter(r => competenceMonth(r.t) === month)
  const overdueAll = all.filter(r => r.st === 'atrasado' && !r.t.cardPayment)
  // "Atrasados" mostra as contas atrasadas de qualquer mês: é a lista do que falta pagar.
  const allOverdue = statusFilter === 'atrasado'
  const count = (st: TxStatus) => st === 'atrasado' ? overdueAll.length : inMonth.filter(r => r.st === st && !r.t.cardPayment).length
  // Busca e filtros valem para todos os meses.
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const searching = q.trim() !== '' || fCat !== '' || fWhere !== ''
  const matches = (t: Transaction) => {
    if (fCat && t.categoryId !== fCat) return false
    if (fWhere && (fWhere.startsWith('c:') ? t.cardId !== fWhere.slice(2) : t.accountId !== fWhere.slice(2))) return false
    if (!q.trim()) return true
    const hay = norm([t.note, t.item, name(cats, t.categoryId), String(t.amountCents / 100).replace('.', ',')].filter(Boolean).join(' '))
    return norm(q).split(/\s+/).every(w => hay.includes(w))
  }
  const rows = (searching ? all.filter(r => matches(r.t)) : allOverdue ? overdueAll : inMonth)
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
      <div className="title-row">
        <h1>Lançamentos</h1>
        {go && <button className="mini" onClick={() => go('importar')}>Importar extrato</button>}
      </div>
      <div className="search-row">
        <input aria-label="Buscar" type="search" placeholder="Buscar (ex.: padaria, 287,40)" value={q} onChange={e => setQ(e.target.value)} />
        <button className="mini" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}>Filtros{fCat || fWhere ? ' •' : ''}</button>
      </div>
      {showFilters && (
        <div className="range filters-box">
          <div className="field">
            <label htmlFor="f-cat">Filtrar categoria</label>
            <select id="f-cat" value={fCat} onChange={e => setFCat(e.target.value)}>
              <option value="">Todas</option>
              {cats.filter(c => !c.deletedAt).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-onde">Filtrar conta ou cartão</label>
            <select id="f-onde" value={fWhere} onChange={e => setFWhere(e.target.value)}>
              <option value="">Todas</option>
              {accounts.map(a => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}
              {cards.map(c => <option key={c.id} value={`c:${c.id}`}>Cartão {c.name}</option>)}
            </select>
          </div>
        </div>
      )}
      {searching
        ? <p className="muted" style={{ margin: '4px 0 16px' }}>{rows.length} {rows.length === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'}, em todos os meses — total {formatBRL(rows.reduce((a, r) => a + r.t.amountCents, 0))}.{' '}
            <button className="linklike" onClick={() => { setQ(''); setFCat(''); setFWhere('') }}>Limpar busca</button></p>
        : allOverdue ? <p className="muted" style={{ margin: '4px 0 16px' }}>Todas as contas atrasadas, de qualquer mês.</p> : <MonthNav month={month} setMonth={setMonth} />}
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
        <div className="list"><p className="empty">{allOverdue ? 'Nenhuma conta atrasada.' : <>Nada lançado em {monthLabel(month)}. Toque em + para lançar.</>}</p></div>
      )}
      {rows.length > 0 && (
        <ul className="list">
          {rows.map(({ t, st }) => {
            const where = t.cardId ? `Cartão ${name(cards, t.cardId)}` : name(accounts, t.accountId)
            const parcela = t.installment ? `, parcela ${t.installment.n} de ${t.installment.total}` : ''
            const detail = t.note ?? t.item
            const title = `${name(cats, t.categoryId) || 'Sem categoria'}${parcela}${detail ? ` — ${detail}` : ''}`
            const when = t.cardId ? `Compra ${dateLabel(t.date)}` : st === 'pago'
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
