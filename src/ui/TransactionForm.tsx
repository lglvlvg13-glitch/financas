import { useMemo, useState } from 'react'
import { useApp, useList } from './context'
import { Confirm, Dialog } from './common'
import { useUndo } from './UndoToast'
import { formatBRL, parseBRL } from '../domain/money'
import { dayOf, monthOf, today } from '../domain/dates'
import { buildInstallments, invoiceMonthFor } from '../domain/invoice'
import type { Account, Card, Category, Recurrence, Transaction, TransactionDraft } from '../domain/types'

type Scope = 'uma' | 'todas'

const centsToInput = (c: number) => formatBRL(c).replace('R$ ', '')

export function TransactionForm({ initial, onClose }: { initial?: Transaction; onClose: () => void }) {
  const { repo, me } = useApp()
  const undo = useUndo()
  const accounts = useList<Account>('accounts') ?? []
  const cards = useList<Card>('cards') ?? []
  const categories = useList<Category>('categories') ?? []
  const allTx = useList<Transaction>('transactions') ?? []

  const group = useMemo(
    () => initial?.installment ? allTx.filter(t => t.installment?.groupId === initial.installment!.groupId) : [],
    [allTx, initial],
  )
  const isPayment = !!initial?.cardPayment
  const [scope, setScope] = useState<Scope>('uma')
  const [kind, setKind] = useState<Transaction['kind']>(initial?.kind ?? 'despesa')
  const [amount, setAmount] = useState(initial ? centsToInput(initial.amountCents) : '')
  const [date, setDate] = useState(initial?.date ?? today())
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [where, setWhere] = useState(initial?.cardId ? `c:${initial.cardId}` : initial?.accountId ? `a:${initial.accountId}` : '')
  const [count, setCount] = useState(initial?.installment?.total ?? 1)
  const [repeat, setRepeat] = useState(false)
  const [note, setNote] = useState(initial?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const cardId = where.startsWith('c:') ? where.slice(2) : undefined
  const accountId = where.startsWith('a:') ? where.slice(2) : undefined
  const card = cards.find(c => c.id === cardId)
  const isParcela = !!initial?.installment
  const lockStructure = isParcela && scope === 'uma'   // parcela isolada: só valor, categoria e observação
  const groupTotal = group.reduce((s, t) => s + t.amountCents, 0)

  const setScopeAndAmount = (s: Scope) => {
    setScope(s)
    if (initial) setAmount(centsToInput(s === 'todas' ? groupTotal : initial.amountCents))
  }

  const save = async () => {
    const cents = parseBRL(amount)
    const errs: Record<string, string> = {}
    if (cents === null || cents <= 0) errs.amount = 'Valor inválido'
    if (!categoryId) errs.category = 'Escolha uma categoria'
    if (!where) errs.where = 'Escolha a conta ou o cartão'
    if (!date) errs.date = 'Escolha a data'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const base: TransactionDraft = {
      kind, amountCents: cents!, date, categoryId, profileId: initial?.profileId ?? me,
      ...(accountId ? { accountId } : {}), ...(cardId ? { cardId } : {}), ...(note.trim() ? { note: note.trim() } : {}),
    }

    if (initial && isParcela && scope === 'uma') {
      await repo.put<Transaction>('transactions', { ...initial, amountCents: cents!, categoryId, note: note.trim() || undefined }, me)
    } else if (initial && isParcela && scope === 'todas') {
      for (const t of group) await repo.remove('transactions', t.id, me)
      await createPurchase(base, initial.installment!.groupId)
    } else if (initial) {
      const next: Transaction = { ...initial, ...base }
      if (!cardId) { delete next.cardId; delete next.invoiceMonth }
      if (!accountId) delete next.accountId
      if (!next.note) delete next.note
      if (card && !isPayment) next.invoiceMonth = invoiceMonthFor(date, card.closingDay)
      await repo.put<Transaction>('transactions', next, me)
    } else if (card) {
      await createPurchase(base, crypto.randomUUID())
    } else {
      let recurrenceId: string | undefined
      if (repeat) {
        const { date: _d, ...template } = base
        void _d
        const r = await repo.put<Recurrence>('recurrences', { template, dayOfMonth: dayOf(date), startMonth: monthOf(date) }, me)
        recurrenceId = r.id
      }
      await repo.put<Transaction>('transactions', { ...base, ...(recurrenceId ? { recurrenceId } : {}) }, me)
    }
    onClose()
  }

  const createPurchase = async (base: TransactionDraft, groupId: string) => {
    for (const p of buildInstallments({ ...base, cardId: card!.id }, card!, count, groupId)) {
      await repo.put<Transaction>('transactions', p, me)
    }
  }

  const doDelete = async (all: boolean) => {
    const targets = all ? group : [initial!]
    for (const t of targets) await repo.remove('transactions', t.id, me)
    undo({
      message: all ? 'Parcelas excluídas.' : 'Lançamento excluído.',
      undo: async () => { for (const t of targets) await repo.restore('transactions', t.id, me) },
    })
    onClose()
  }

  const catOptions = categories.filter(c => c.kind === kind && (!c.system || c.id === initial?.categoryId))

  return (
    <Dialog title={initial ? 'Editar lançamento' : 'Novo lançamento'} onClose={onClose}>
      {isParcela && (
        <div className="field">
          <span className="lbl">Aplicar a</span>
          <div className="seg" role="group" aria-label="Aplicar a">
            <button aria-pressed={scope === 'uma'} onClick={() => setScopeAndAmount('uma')}>
              Só a parcela {initial!.installment!.n}
            </button>
            <button aria-pressed={scope === 'todas'} onClick={() => setScopeAndAmount('todas')}>Todas as parcelas</button>
          </div>
        </div>
      )}

      {!isParcela && !isPayment && (
        <div className="field">
          <span className="lbl">Tipo</span>
          <div className="seg" role="group" aria-label="Tipo">
            <button aria-pressed={kind === 'despesa'} onClick={() => { setKind('despesa'); setCategoryId('') }}>Despesa</button>
            <button aria-pressed={kind === 'receita'} onClick={() => { setKind('receita'); setCategoryId(''); if (cardId) setWhere('') }}>Receita</button>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="tx-valor">{isParcela ? (scope === 'todas' ? 'Valor total da compra (R$)' : 'Valor (R$)') : 'Valor (R$)'}</label>
        <input id="tx-valor" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} />
        {errors.amount && <span className="err">{errors.amount}</span>}
      </div>

      <div className="field">
        <label htmlFor="tx-data">{cardId ? 'Data da compra' : 'Data'}</label>
        <input id="tx-data" type="date" value={date} disabled={lockStructure} onChange={e => setDate(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="tx-cat">Categoria</label>
        <select id="tx-cat" value={categoryId} disabled={isPayment} onChange={e => setCategoryId(e.target.value)}>
          <option value="">Escolha…</option>
          {catOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {errors.category && <span className="err">{errors.category}</span>}
      </div>

      <div className="field">
        <label htmlFor="tx-onde">Onde</label>
        <select id="tx-onde" value={where} disabled={lockStructure || isPayment} onChange={e => setWhere(e.target.value)}>
          <option value="">Escolha…</option>
          {accounts.length > 0 && <optgroup label="Contas">
            {accounts.map(a => <option key={a.id} value={`a:${a.id}`}>{a.name}</option>)}
          </optgroup>}
          {kind === 'despesa' && cards.length > 0 && <optgroup label="Cartões de crédito">
            {cards.map(c => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}
          </optgroup>}
        </select>
        {errors.where && <span className="err">{errors.where}</span>}
        {accounts.length === 0 && cards.length === 0 && <span className="muted">Cadastre uma conta em Contas ou um cartão em Cartões.</span>}
      </div>

      {card && !isPayment && (!initial || isParcela) && (
        <div className="field">
          <label htmlFor="tx-parc">Parcelas</label>
          <select id="tx-parc" value={count} disabled={lockStructure} onChange={e => setCount(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n === 1 ? 'À vista' : `${n}x`}</option>)}
          </select>
        </div>
      )}

      {!initial && !card && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
          Repetir todo mês
        </label>
      )}

      <div className="field">
        <label htmlFor="tx-obs">Observação</label>
        <input id="tx-obs" value={note} onChange={e => setNote(e.target.value)} />
      </div>

      <div className="btns">
        <button className="btn" onClick={save}>Salvar</button>
        <button className="btn sec" onClick={onClose}>Cancelar</button>
        {initial && <button className="btn perigo" onClick={() => setConfirmDelete(true)}>Excluir</button>}
      </div>

      {confirmDelete && (
        <Confirm
          title={isParcela ? 'Excluir quais parcelas?' : 'Excluir este lançamento?'}
          onCancel={() => setConfirmDelete(false)}
          actions={isParcela
            ? [
              { label: `Só a parcela ${initial!.installment!.n}`, kind: 'perigo', run: () => doDelete(false) },
              { label: `Todas as ${group.length} parcelas`, kind: 'perigo', run: () => doDelete(true) },
            ]
            : [{ label: 'Excluir', kind: 'perigo', run: () => doDelete(false) }]}
        />
      )}
    </Dialog>
  )
}
