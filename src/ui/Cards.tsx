import { useState } from 'react'
import { useApp, useList } from './context'
import { Confirm, currentMonth, dateLabel, Dialog, MonthNav, plural } from './common'
import { useUndo } from './UndoToast'
import { formatBRL, parseBRL } from '../domain/money'
import { addMonths, today } from '../domain/dates'
import { invoiceMonthFor, invoiceSummary, limitUsedCents } from '../domain/invoice'
import { PAYMENT_CATEGORY_ID } from '../domain/defaults'
import type { Account, Card, Category, Transaction } from '../domain/types'

const isPaid = (s: { totalCents: number; paidCents: number }) => s.totalCents > 0 && s.paidCents >= s.totalCents

export function Cards() {
  const [month, setMonth] = useState(currentMonth())
  const cards = useList<Card>('cards')
  const txs = useList<Transaction>('transactions') ?? []
  const [editing, setEditing] = useState<Card | 'novo'>()
  const [paying, setPaying] = useState<{ card: Card; cents: number }>()

  return (
    <>
      <h1>Cartões</h1>
      <MonthNav month={month} setMonth={setMonth} />
      {cards && cards.length === 0 && (
        <div className="list"><p className="empty">Nenhum cartão ainda. Cadastre o cartão com o dia em que a fatura fecha e o dia em que vence.</p></div>
      )}
      {(cards ?? []).map(card => (
        <InvoicePanel key={card.id} card={card} month={month} txs={txs}
          onEdit={() => setEditing(card)}
          onPay={cents => setPaying({ card, cents })} />
      ))}
      <div className="btns"><button className="btn" onClick={() => setEditing('novo')}>Novo cartão</button></div>
      {editing && <CardForm initial={editing === 'novo' ? undefined : editing} onClose={() => setEditing(undefined)} />}
      {paying && <PayForm card={paying.card} month={month} cents={paying.cents} onClose={() => setPaying(undefined)} />}
    </>
  )
}

function InvoicePanel({ card, month, txs, onEdit, onPay }: {
  card: Card; month: string; txs: Transaction[]; onEdit: () => void; onPay: (cents: number) => void
}) {
  const cats = useList<Category>('categories') ?? []
  const s = invoiceSummary(card, month, txs)
  const used = limitUsedCents(card, txs)
  const paid = isPaid(s)
  const remaining = Math.max(0, s.totalCents - s.paidCents)
  const catName = (id: string) => cats.find(c => c.id === id)?.name ?? ''

  return (
    <section className="panel" aria-label={card.name} style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 style={{ margin: 0 }}>{card.name}</h2>
        <span className={paid ? 'entrada' : 'muted'} style={{ fontWeight: 700 }}>
          {paid ? 'Paga' : s.totalCents === 0 ? 'Sem compras' : s.paidCents > 0 ? 'Paga em parte' : 'Em aberto'}
        </span>
      </div>
      <p className="num total" style={{ fontSize: 28, fontWeight: 800, margin: '8px 0 0' }}>{formatBRL(s.totalCents)}</p>
      <p className="muted" style={{ marginBottom: 8 }}>Vence em {dateLabel(s.dueDate)}</p>
      <p className="muted num" style={{ fontSize: 14 }}>
        Limite disponível: {formatBRL(Math.max(0, card.limitCents - used))} de {formatBRL(card.limitCents)}
      </p>
      {s.items.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontWeight: 600, minHeight: 36 }}>{plural(s.items.length, 'compra', 'compras')} nesta fatura</summary>
          <ul className="list" style={{ marginTop: 8 }}>
            {s.items.map(t => (
              <li key={t.id} className="row" style={{ cursor: 'default' }}>
                <span>{catName(t.categoryId)}{t.installment ? `, parcela ${t.installment.n} de ${t.installment.total}` : ''}{t.note ? ` — ${t.note}` : ''}</span>
                <span className="val num">{formatBRL(t.amountCents)}</span>
                <span className="sub">{dateLabel(t.date)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="btns">
        {!paid && remaining > 0 && <button className="btn" onClick={() => onPay(remaining)}>Pagar fatura</button>}
        <button className="btn sec" onClick={onEdit}>Editar cartão</button>
      </div>
    </section>
  )
}

function PayForm({ card, month, cents, onClose }: { card: Card; month: string; cents: number; onClose: () => void }) {
  const { repo, me } = useApp()
  const accounts = useList<Account>('accounts') ?? []
  const [amount, setAmount] = useState(formatBRL(cents).replace('R$ ', ''))
  const [accountId, setAccountId] = useState('')
  const [date, setDate] = useState(today())
  const [error, setError] = useState<string>()

  const pay = async () => {
    const v = parseBRL(amount)
    if (!v || v <= 0) return setError('Valor inválido')
    if (!accountId) return setError('Escolha a conta de onde sai o pagamento.')
    await repo.put<Transaction>('transactions', {
      kind: 'despesa', amountCents: v, date, categoryId: PAYMENT_CATEGORY_ID, profileId: me, accountId,
      cardPayment: { cardId: card.id, invoiceMonth: month },
    }, me)
    onClose()
  }

  return (
    <Dialog title={`Pagar fatura do ${card.name}`} onClose={onClose}>
      <div className="field">
        <label htmlFor="pay-valor">Valor (R$)</label>
        <input id="pay-valor" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="pay-conta">Pagar com a conta</label>
        <select id="pay-conta" value={accountId} onChange={e => setAccountId(e.target.value)}>
          <option value="">Escolha…</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        {accounts.length === 0 && <span className="muted">Cadastre uma conta em Contas primeiro.</span>}
      </div>
      <div className="field">
        <label htmlFor="pay-data">Data do pagamento</label>
        <input id="pay-data" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      {error && <p className="err saida" role="alert">{error}</p>}
      <div className="btns">
        <button className="btn" onClick={pay}>Pagar</button>
        <button className="btn sec" onClick={onClose}>Cancelar</button>
      </div>
    </Dialog>
  )
}

function CardForm({ initial, onClose }: { initial?: Card; onClose: () => void }) {
  const { repo, me } = useApp()
  const undo = useUndo()
  const txs = useList<Transaction>('transactions') ?? []
  const [name, setName] = useState(initial?.name ?? '')
  const [limit, setLimit] = useState(initial ? formatBRL(initial.limitCents).replace('R$ ', '') : '')
  const [closing, setClosing] = useState(initial ? String(initial.closingDay) : '')
  const [due, setDue] = useState(initial ? String(initial.dueDay) : '')
  const [error, setError] = useState<string>()
  const [linked, setLinked] = useState<number>()

  const save = async () => {
    if (!name.trim()) return setError('Dê um nome para o cartão.')
    const lim = parseBRL(limit)
    if (lim === null || lim <= 0) return setError('Limite inválido.')
    const c = Number(closing), d = Number(due)
    const okDay = (n: number) => Number.isInteger(n) && n >= 1 && n <= 31
    if (!okDay(c) || !okDay(d)) return setError('Os dias devem ser de 1 a 31.')
    const saved = await repo.put<Card>('cards', { ...initial, name: name.trim(), limitCents: lim, closingDay: c, dueDay: d }, me)

    // Fechamento mudou: compras de faturas ainda não pagas vão para a fatura certa.
    if (initial && initial.closingDay !== c) {
      for (const t of txs) {
        if (t.cardId !== saved.id || t.cardPayment || !t.invoiceMonth) continue
        if (isPaid(invoiceSummary(saved, t.invoiceMonth, txs))) continue
        // Todas as parcelas guardam a data da compra; a parcela n cai n−1 faturas depois da primeira.
        const next = addMonths(invoiceMonthFor(t.date, c), (t.installment?.n ?? 1) - 1)
        if (next !== t.invoiceMonth) await repo.put<Transaction>('transactions', { ...t, invoiceMonth: next }, me)
      }
    }
    onClose()
  }

  const remove = async () => {
    const ids = await repo.removeCascade('cards', initial!.id, me)
    undo({ message: 'Cartão excluído.', undo: async () => {
      await repo.restore('cards', ids[0], me)
      for (const id of ids.slice(1)) await repo.restore('transactions', id, me)
    } })
    onClose()
  }

  return (
    <Dialog title={initial ? 'Editar cartão' : 'Novo cartão'} onClose={onClose}>
      <div className="field">
        <label htmlFor="card-nome">Nome</label>
        <input id="card-nome" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Nubank, Visa Itaú" />
      </div>
      <div className="field">
        <label htmlFor="card-lim">Limite (R$)</label>
        <input id="card-lim" inputMode="decimal" value={limit} onChange={e => setLimit(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="card-fech">Dia de fechamento</label>
        <input id="card-fech" inputMode="numeric" value={closing} onChange={e => setClosing(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="card-venc">Dia de vencimento</label>
        <input id="card-venc" inputMode="numeric" value={due} onChange={e => setDue(e.target.value)} />
      </div>
      {initial && <p className="muted" style={{ fontSize: 14 }}>Mudar o fechamento move as compras de faturas ainda não pagas. Faturas pagas não mudam.</p>}
      {error && <p className="err saida" role="alert">{error}</p>}
      <div className="btns">
        <button className="btn" onClick={save}>Salvar</button>
        <button className="btn sec" onClick={onClose}>Cancelar</button>
        {initial && <button className="btn perigo" onClick={async () => setLinked(await repo.countLinked('cards', initial.id))}>Excluir</button>}
      </div>
      {linked !== undefined && (
        <Confirm
          title={`Excluir o cartão ${initial!.name}?`}
          body={linked > 0 ? <p>Este cartão tem {plural(linked, 'lançamento', 'lançamentos')} (compras e pagamentos). Eles serão excluídos junto.</p> : undefined}
          onCancel={() => setLinked(undefined)}
          actions={[{
            label: linked > 0 ? `Excluir também os ${plural(linked, 'lançamento', 'lançamentos')}` : 'Excluir',
            kind: 'perigo', run: remove,
          }]}
        />
      )}
    </Dialog>
  )
}
