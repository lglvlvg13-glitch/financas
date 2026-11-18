import { useState } from 'react'
import { useApp, useList } from './context'
import { Confirm, currentMonth, dateLabel, Dialog, MonthNav, plural } from './common'
import { useUndo } from './UndoToast'
import { StatementForm } from './StatementForm'
import { CatIcon } from './Icons'
import { formatBRL, parseBRL } from '../domain/money'
import { addMonths, today } from '../domain/dates'
import { invoiceMonthFor, invoiceSummary, limitUsedCents } from '../domain/invoice'
import { PAYMENT_CATEGORY_ID } from '../domain/defaults'
import type { Account, Card, Category, Transaction } from '../domain/types'

const isPaid = (s: { totalCents: number; paidCents: number }) => s.totalCents > 0 && s.paidCents >= s.totalCents

/** Mês pedido por outra tela (ex.: Painel → fatura atrasada); vale só para a próxima abertura. */
let requestedMonth: string | undefined
export function openCardsAt(month: string) { requestedMonth = month }

export function Cards() {
  const [month, setMonth] = useState(() => { const m = requestedMonth ?? currentMonth(); requestedMonth = undefined; return m })
  const cards = useList<Card>('cards')
  const txs = useList<Transaction>('transactions') ?? []
  const [editing, setEditing] = useState<Card | 'novo'>()
  const [paying, setPaying] = useState<{ card: Card; cents: number }>()
  const [entering, setEntering] = useState<Card>()

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
          onEnter={() => setEntering(card)}
          onPay={cents => setPaying({ card, cents })} />
      ))}
      <div className="btns"><button className="btn" onClick={() => setEditing('novo')}>Novo cartão</button></div>
      {editing && <CardForm initial={editing === 'novo' ? undefined : editing} onClose={() => setEditing(undefined)} />}
      {entering && <StatementForm card={entering} month={month} onClose={() => setEntering(undefined)} />}
      {paying && <PayForm card={paying.card} month={month} cents={paying.cents} onClose={() => setPaying(undefined)} />}
    </>
  )
}

function InvoicePanel({ card, month, txs, onEdit, onPay, onEnter }: {
  card: Card; month: string; txs: Transaction[]; onEdit: () => void; onPay: (cents: number) => void; onEnter: () => void
}) {
  const cats = useList<Category>('categories') ?? []
  const s = invoiceSummary(card, month, txs)
  const used = limitUsedCents(card, txs)
  const paid = isPaid(s)
  const remaining = Math.max(0, s.totalCents - s.paidCents)
  const catName = (id: string) => cats.find(c => c.id === id)?.name ?? ''

  const avail = Math.max(0, card.limitCents - used)
  const status = paid ? 'Paga' : s.totalCents === 0 ? 'Sem compras' : s.paidCents > 0 ? 'Paga em parte' : 'Em aberto'
  return (
    <section className="card-panel" aria-label={card.name}>
      <div className="card-face" style={{ background: faceColor(card.id) }}>
        <div className="cf-top">
          <h2 className="cf-name">{card.name}</h2>
          <span className={`cf-status ${paid ? 'pago' : ''}`}>{status}</span>
        </div>
        <span className="chip" aria-hidden="true" />
        <p className="num total cf-total" style={{ margin: 0 }}>{formatBRL(s.totalCents)}</p>
        <div className="cf-meta"><span>Vence em {dateLabel(s.dueDate)}</span><span>Fecha dia {card.closingDay}</span></div>
      </div>
      <div className="panel" style={{ padding: 16 }}>
        <div className="b-head" style={{ fontSize: 14 }}>
          <span className="muted">Limite disponível</span>
          <strong className="num">{formatBRL(avail)} <span className="muted" style={{ fontWeight: 600 }}>de {formatBRL(card.limitCents)}</span></strong>
        </div>
        <div className="limit" style={{ marginTop: 8 }} aria-hidden="true"><span style={{ width: `${card.limitCents ? Math.min(100, (used / card.limitCents) * 100) : 0}%` }} /></div>
        {s.items.length > 0 && (
          <details style={{ marginTop: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700, minHeight: 36 }}>{plural(s.items.length, 'compra', 'compras')} nesta fatura</summary>
            <ul className="list" style={{ marginTop: 8, boxShadow: 'none', background: 'var(--suave-2)' }}>
              {s.items.map(t => (
                <li key={t.id} className="row with-ico" style={{ cursor: 'default' }}>
                  <CatIcon category={cats.find(c => c.id === t.categoryId)} size={34} />
                  <strong className="tx-title">{t.note ?? t.item ?? catName(t.categoryId)}{t.installment ? ` (${t.installment.n}/${t.installment.total})` : ''}</strong>
                  <span className="val num">{formatBRL(t.amountCents)}</span>
                  <span className="sub">{catName(t.categoryId)} · {dateLabel(t.date)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="btns" style={{ marginTop: 14 }}>
          <button className="btn" onClick={onEnter}>Lançar compras</button>
          {!paid && remaining > 0 && <button className="btn sec" onClick={() => onPay(remaining)}>Pagar fatura</button>}
          <button className="btn sec" onClick={onEdit}>Editar cartão</button>
        </div>
      </div>
    </section>
  )
}

/** Cor da "face" do cartão, fixa por cartão. */
const FACES = ['#1b2540', '#14306a', '#3b2e5a', '#5a2e3a', '#0f4a3a', '#3d4a2c']
function faceColor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return FACES[h % FACES.length]
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
    const affected = await repo.removeCascade('cards', initial!.id, me)
    undo({ message: 'Cartão excluído.', undo: () => repo.restoreAll(affected, me) })
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
          body={linked > 0 ? <p>Este cartão tem {plural(linked, 'compra', 'compras')}. Elas serão excluídas junto. Os pagamentos de fatura continuam nas contas.</p> : undefined}
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
