import { useMemo, useState } from 'react'
import { useApp, useList } from './context'
import { Confirm, Dialog } from './common'
import { useUndo } from './UndoToast'
import { formatBRL, parseBRL } from '../domain/money'
import { addMonths, dayOf, monthOf, today } from '../domain/dates'
import { EXAMPLES } from '../domain/defaults'
import { buildInstallments, invoiceMonthFor } from '../domain/invoice'
import type { Account, Card, Category, Recurrence, Transaction, TransactionDraft } from '../domain/types'

type Scope = 'uma' | 'todas'

/** Fotos grandes do celular viram JPEG de até 1600px (economiza espaço no Drive e no envio). */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') return file
  try {
    const img = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const out = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8))
    return out ?? file
  } catch { return file }
}

const centsToInput = (c: number) => formatBRL(c).replace('R$ ', '')

export function TransactionForm({ initial, onClose }: { initial?: Transaction; onClose: () => void }) {
  const { repo, me, files } = useApp()
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
  const [months, setMonths] = useState('')
  const [isPaid, setIsPaid] = useState(!initial?.pending)
  const [paidDate, setPaidDate] = useState(initial?.paidDate ?? '')
  /** Necessidade/Desejo só deste lançamento; undefined = segue a categoria. */
  const [groupOverride, setGroupOverride] = useState(initial?.group)
  const [item, setItem] = useState(initial?.item ?? '')
  const [receipt, setReceipt] = useState(initial?.receipt)
  const [newFile, setNewFile] = useState<File>()
  const [preview, setPreview] = useState<{ url: string; mime: string }>()
  const [fileMsg, setFileMsg] = useState<string>()
  const [note, setNote] = useState(initial?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmDelete, setConfirmDelete] = useState(false)

  const cardId = where.startsWith('c:') ? where.slice(2) : undefined
  const accountId = where.startsWith('a:') ? where.slice(2) : undefined
  const card = cards.find(c => c.id === cardId)
  const isParcela = !!initial?.installment
  // Compra lançada pelo extrato a partir da parcela k > 1: as parcelas anteriores não existem no app,
  // então "todas" só muda valor, categoria e observação de cada uma, sem recriar.
  const midStream = isParcela && group.length > 0 && Math.min(...group.map(t => t.installment!.n)) > 1
  const lockStructure = isParcela && (scope === 'uma' || midStream)   // parcela isolada: só valor, categoria e observação
  const groupTotal = group.reduce((s, t) => s + t.amountCents, 0)

  const setScopeAndAmount = (s: Scope) => {
    setScope(s)
    if (initial) setAmount(centsToInput(s === 'todas' && !midStream ? groupTotal : initial.amountCents))
  }

  const save = async () => {
    const cents = parseBRL(amount)
    const errs: Record<string, string> = {}
    if (cents === null || cents <= 0) errs.amount = 'Valor inválido'
    if (!categoryId) errs.category = 'Escolha uma categoria'
    if (!where) errs.where = 'Escolha a conta ou o cartão'
    if (!date) errs.date = 'Escolha a data'
    const nMonths = months.trim() ? Number(months) : undefined
    if (repeat && nMonths !== undefined && !(Number.isInteger(nMonths) && nMonths >= 1 && nMonths <= 600)) errs.months = 'Digite um número de meses de 1 a 600, ou deixe em branco'
    setErrors(errs)
    if (Object.keys(errs).length) return

    // Comprovante: envia o novo ao Drive; o tirado vai para a lixeira do Drive.
    let receiptField: Transaction['receipt'] = receipt
    if (newFile) {
      try {
        const blob = await shrinkImage(newFile)
        const fileId = await files.upload(`comprovante-${date}-${(note || 'lancamento').slice(0, 40)}.${blob.type === 'image/jpeg' ? 'jpg' : newFile.name.split('.').pop()}`, blob)
        receiptField = { fileId, name: newFile.name, mime: blob.type || newFile.type }
      } catch {
        // Não salva ainda: a pessoa decide se salva sem o comprovante.
        setNewFile(undefined)
        setFileMsg('O comprovante não foi enviado (sem internet ou sem login). Toque em Salvar de novo para salvar sem ele e anexe depois.')
        return
      }
    }
    if (initial?.receipt && initial.receipt.fileId !== receiptField?.fileId) void files.remove(initial.receipt.fileId).catch(() => {})

    const base: TransactionDraft = {
      kind, amountCents: cents!, date, categoryId, profileId: initial?.profileId ?? me,
      ...(accountId ? { accountId } : {}), ...(cardId ? { cardId } : {}), ...(note.trim() ? { note: note.trim() } : {}),
    }
    function withGroup(t: Transaction): Transaction {
      const out = { ...t }
      delete out.group; delete out.item
      return Object.assign(out, groupFields)
    }
    // Situação (só fora do cartão: compra no cartão segue a fatura).
    const catNow = categories.find(c => c.id === categoryId)
    const itemNow = kind === 'despesa' && item && catNow?.items?.some(x => x.name === item) ? item : undefined
    const autoGroup = catNow?.items?.find(x => x.name === itemNow)?.group ?? catNow?.group ?? 'desejo'
    const groupFields = {
      ...(itemNow ? { item: itemNow } : {}),
      ...(kind === 'despesa' && groupOverride && groupOverride !== autoGroup ? { group: groupOverride } : {}),
    }
    Object.assign(base, groupFields)
    if (receiptField) base.receipt = receiptField
    const paidFields = cardId || isPayment ? {}
      : isPaid ? (paidDate && paidDate !== date ? { paidDate } : {})
      : { pending: true as const }

    if (initial && isParcela && scope === 'todas' && midStream) {
      for (const t of group) await repo.put<Transaction>('transactions', withGroup({ ...t, amountCents: cents!, categoryId, note: note.trim() || undefined }), me)
    } else if (initial && isParcela && scope === 'uma') {
      await repo.put<Transaction>('transactions', withGroup({ ...initial, amountCents: cents!, categoryId, note: note.trim() || undefined }), me)
    } else if (initial && isParcela && scope === 'todas') {
      for (const t of group) await repo.remove('transactions', t.id, me)
      await createPurchase(base, initial.installment!.groupId)
    } else if (initial) {
      const next: Transaction = { ...initial, ...base }
      delete next.pending; delete next.paidDate
      if (!base.group) delete next.group
      if (!base.item) delete next.item
      if (!base.receipt) delete next.receipt
      Object.assign(next, paidFields)
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
        const r = await repo.put<Recurrence>('recurrences', {
          template, dayOfMonth: dayOf(date), startMonth: monthOf(date),
          ...(nMonths ? { endMonth: addMonths(monthOf(date), nMonths - 1) } : {}),
        }, me)
        recurrenceId = r.id
      }
      await repo.put<Transaction>('transactions', { ...base, ...paidFields, ...(recurrenceId ? { recurrenceId } : {}) }, me)
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
  const chosen = categories.find(c => c.id === categoryId)
  const items = kind === 'despesa' ? chosen?.items ?? [] : []
  const hint = chosen && !items.length && EXAMPLES[chosen.id] ? `O que entra aqui: ${EXAMPLES[chosen.id].join(', ')}.` : undefined
  const itemGroup = items.find(x => x.name === item)?.group
  const effectiveGroup = groupOverride ?? itemGroup ?? chosen?.group ?? 'desejo'

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
            <button aria-pressed={kind === 'investimento'} onClick={() => { setKind('investimento'); setCategoryId(''); if (cardId) setWhere('') }}>Investimento</button>
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="tx-valor">{isParcela && scope === 'todas' ? (midStream ? 'Valor de cada parcela (R$)' : 'Valor total da compra (R$)') : 'Valor (R$)'}</label>
        <input id="tx-valor" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} />
        {errors.amount && <span className="err">{errors.amount}</span>}
      </div>

      <div className="field">
        <label htmlFor="tx-data">{cardId ? 'Data da compra' : isPayment ? 'Data' : 'Vence em'}</label>
        <input id="tx-data" type="date" value={date} disabled={lockStructure} onChange={e => setDate(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="tx-cat">Categoria</label>
        <select id="tx-cat" value={categoryId} disabled={isPayment} onChange={e => { setCategoryId(e.target.value); setGroupOverride(undefined); setItem('') }}>
          <option value="">Escolha…</option>
          {catOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {errors.category && <span className="err">{errors.category}</span>}
        {hint && <span className="hint">{hint}</span>}
      </div>

      {items.length > 0 && (
        <div className="field">
          <label htmlFor="tx-item">Item</label>
          <select id="tx-item" value={item} onChange={e => { setItem(e.target.value); setGroupOverride(undefined) }}>
            <option value="">Não especificar</option>
            {items.map(x => <option key={x.name} value={x.name}>{x.name} ({x.group === 'necessidade' ? 'Necessidade' : 'Desejo'})</option>)}
          </select>
        </div>
      )}

      {kind === 'despesa' && chosen && !chosen.system && (
        <div className="field">
          <span className="lbl">No método 50/30/20</span>
          <div className="seg" role="group" aria-label="No método 50/30/20">
            <button aria-pressed={effectiveGroup === 'necessidade'} onClick={() => setGroupOverride('necessidade')}>Necessidade</button>
            <button aria-pressed={effectiveGroup === 'desejo'} onClick={() => setGroupOverride('desejo')}>Desejo</button>
          </div>
          <span className="hint">{groupOverride && groupOverride !== (itemGroup ?? chosen.group ?? 'desejo')
            ? 'Classificação só deste lançamento.'
            : 'Necessidade = despesa fixa, que não dá para cortar. Desejo = dá para cortar ou adiar.'}</span>
        </div>
      )}

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

      {!card && !isPayment && (
        <>
          <label className="check">
            <input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} />
            {kind === 'receita' ? 'Já foi recebido' : 'Já está pago'}
          </label>
          {isPaid ? (
            <div className="field">
              <label htmlFor="tx-pago">{kind === 'receita' ? 'Recebido em' : 'Pago em'}</label>
              <input id="tx-pago" type="date" value={paidDate || date} onChange={e => setPaidDate(e.target.value)} />
            </div>
          ) : (
            <p className="hint" style={{ marginTop: -6 }}>Fica <strong>Previsto</strong> até o vencimento e <strong>Atrasado</strong> depois.</p>
          )}
        </>
      )}

      {!initial && !card && (
        <>
          <label className="check">
            <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} />
            Repetir todo mês
          </label>
          {repeat && (
            <div className="field">
              <label htmlFor="tx-meses">Por quantos meses</label>
              <input id="tx-meses" inputMode="numeric" placeholder="Sem fim" value={months} onChange={e => setMonths(e.target.value)} />
              {errors.months ? <span className="err">{errors.months}</span>
                : <span className="hint">Os próximos meses chegam como Previsto, no dia {dayOf(date) || '–'}. Em branco, repete sem fim.</span>}
            </div>
          )}
        </>
      )}

      <div className="field">
        <label htmlFor="tx-obs">Observação</label>
        <input id="tx-obs" value={note} onChange={e => setNote(e.target.value)} />
      </div>

      <div className="field">
        <span className="lbl">Comprovante</span>
        {receipt ? (
          <div className="btns" style={{ marginTop: 0 }}>
            <button className="mini" onClick={async () => {
              try { const b = await files.open(receipt.fileId); setPreview({ url: URL.createObjectURL(b), mime: receipt.mime }) }
              catch { setFileMsg('Não deu para abrir o comprovante agora (sem internet ou sem login).') }
            }}>Ver comprovante</button>
            <button className="mini" onClick={() => { setReceipt(undefined); setPreview(undefined) }}>Tirar comprovante</button>
          </div>
        ) : (
          <>
            <label htmlFor="tx-comp" className="hint">Anexar comprovante (foto ou PDF)</label>
            <input id="tx-comp" type="file" accept="image/*,application/pdf" capture="environment"
              onChange={e => setNewFile(e.target.files?.[0])} />
            {newFile && <span className="hint">{newFile.name} — será guardado no Drive ao salvar.</span>}
          </>
        )}
        {preview && (preview.mime.startsWith('image/')
          ? <img src={preview.url} alt="Comprovante" className="receipt-img" />
          : <a href={preview.url} target="_blank" rel="noreferrer">Abrir o PDF do comprovante</a>)}
        {fileMsg && <span className="err saida" role="status">{fileMsg}</span>}
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
