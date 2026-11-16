import { useState } from 'react'
import { useApp, useList, useProfiles } from './context'
import { dateLabel, Dialog, monthLabel } from './common'
import { formatBRL, parseBRL } from '../domain/money'
import { today } from '../domain/dates'
import { defaultPurchaseDate, invoiceSummary, statementPurchase } from '../domain/invoice'
import { EXAMPLES } from '../domain/defaults'
import type { Card, Category, ProfileId, Transaction } from '../domain/types'

/** Lançar a fatura linha por linha, como vem no extrato do cartão. */
export function StatementForm({ card, month, onClose }: { card: Card; month: string; onClose: () => void }) {
  const { repo, me } = useApp()
  const names = useProfiles()
  const txs = useList<Transaction>('transactions') ?? []
  const categories = (useList<Category>('categories') ?? []).filter(c => c.kind === 'despesa' && !c.system)
  const [note, setNote] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [groupOverride, setGroupOverride] = useState<'necessidade' | 'desejo'>()
  const [item, setItem] = useState('')
  const [who, setWho] = useState<ProfileId>(me)
  const [split, setSplit] = useState(false)
  const [current, setCurrent] = useState('1')
  const [total, setTotal] = useState('')
  const [date, setDate] = useState(() => defaultPurchaseDate(month, card, today(), 1))
  const [dateTouched, setDateTouched] = useState(false)
  const [error, setError] = useState<string>()
  const [added, setAdded] = useState<string[]>([])

  const s = invoiceSummary(card, month, txs)
  const chosen = categories.find(c => c.id === categoryId)
  const items = chosen?.items ?? []
  const catGroup = items.find(x => x.name === item)?.group ?? chosen?.group ?? 'desejo'
  const effectiveGroup = groupOverride ?? catGroup
  const lines = s.items.slice().sort((a, b) => b.updatedAt - a.updatedAt)

  const setCurrentAndDate = (v: string) => {
    setCurrent(v)
    const k = Number(v)
    if (!dateTouched && Number.isInteger(k) && k >= 1) setDate(defaultPurchaseDate(month, card, today(), k))
  }

  const save = async (close: boolean) => {
    const cents = parseBRL(amount)
    const k = split ? Number(current) : 1, n = split ? Number(total) : 1
    if (!note.trim()) return setError('Escreva a descrição, como aparece na fatura.')
    if (!cents || cents <= 0) return setError('Valor inválido.')
    if (!categoryId) return setError('Escolha a categoria.')
    if (split && !(Number.isInteger(k) && Number.isInteger(n) && k >= 1 && n >= 2 && k <= n && n <= 72)) {
      return setError('Parcela inválida: use, por exemplo, 3 de 10.')
    }
    setError(undefined)
    const drafts = statementPurchase(
      { kind: 'despesa', amountCents: cents, date, categoryId, profileId: who, cardId: card.id, note: note.trim(),
        ...(item ? { item } : {}),
        ...(groupOverride && groupOverride !== catGroup ? { group: groupOverride } : {}) },
      { invoiceMonth: month, current: k, total: n, groupId: crypto.randomUUID() })
    for (const d of drafts) await repo.put<Transaction>('transactions', d, me)
    setAdded([...added, drafts[0].note!])
    if (close) return onClose()
    setNote(''); setAmount(''); setSplit(false); setGroupOverride(undefined); setItem(''); setCurrent('1'); setTotal(''); setDateTouched(false)
    setDate(defaultPurchaseDate(month, card, today(), 1))
    document.getElementById('st-desc')?.focus()
  }

  return (
    <Dialog title={`Lançar compras — ${card.name}, fatura de ${monthLabel(month).toLowerCase()}`} onClose={onClose}>
      <p className="hint" style={{ marginTop: -6 }}>Digite cada linha do extrato. Em compra parcelada, use o valor da parcela e o número que aparece na fatura (ex.: 3 de 10): o app lança as próximas parcelas nas faturas seguintes.</p>

      <div className="field">
        <label htmlFor="st-desc">Descrição</label>
        <input id="st-desc" value={note} onChange={e => setNote(e.target.value)} placeholder="Como aparece na fatura" />
      </div>
      <div className="range">
        <div className="field">
          <label htmlFor="st-valor">Valor (R$)</label>
          <input id="st-valor" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="st-data">Data da compra</label>
          <input id="st-data" type="date" value={date} onChange={e => { setDate(e.target.value); setDateTouched(true) }} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="st-cat">Categoria</label>
        <select id="st-cat" value={categoryId} onChange={e => { setCategoryId(e.target.value); setGroupOverride(undefined); setItem('') }}>
          <option value="">Escolha…</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {!items.length && EXAMPLES[categoryId] && <span className="hint">O que entra aqui: {EXAMPLES[categoryId].join(', ')}.</span>}
      </div>
      {items.length > 0 && (
        <div className="field">
          <label htmlFor="st-item">Item</label>
          <select id="st-item" value={item} onChange={e => { setItem(e.target.value); setGroupOverride(undefined) }}>
            <option value="">Não especificar</option>
            {items.map(x => <option key={x.name} value={x.name}>{x.name} ({x.group === 'necessidade' ? 'Necessidade' : 'Desejo'})</option>)}
          </select>
        </div>
      )}
      {categoryId && (
        <div className="field">
          <span className="lbl">No método 50/30/20</span>
          <div className="seg" role="group" aria-label="No método 50/30/20">
            <button aria-pressed={effectiveGroup === 'necessidade'} onClick={() => setGroupOverride('necessidade')}>Necessidade</button>
            <button aria-pressed={effectiveGroup === 'desejo'} onClick={() => setGroupOverride('desejo')}>Desejo</button>
          </div>
        </div>
      )}
      <div className="field">
        <span className="lbl">Compra</span>
        <div className="seg" role="group" aria-label="Compra">
          <button aria-pressed={!split} onClick={() => setSplit(false)}>À vista</button>
          <button aria-pressed={split} onClick={() => setSplit(true)}>Parcelada</button>
        </div>
      </div>
      {split && (
        <div className="range">
          <div className="field">
            <label htmlFor="st-k">Parcela</label>
            <input id="st-k" inputMode="numeric" value={current} onChange={e => setCurrentAndDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-n">de</label>
            <input id="st-n" inputMode="numeric" placeholder="10" value={total} onChange={e => setTotal(e.target.value)} />
          </div>
        </div>
      )}
      <div className="field">
        <span className="lbl">De quem</span>
        <div className="seg" role="group" aria-label="De quem">
          <button aria-pressed={who === 'u1'} onClick={() => setWho('u1')}>{names.u1}</button>
          <button aria-pressed={who === 'u2'} onClick={() => setWho('u2')}>{names.u2}</button>
        </div>
      </div>
      {error && <p className="err saida" role="alert">{error}</p>}
      <div className="btns">
        <button className="btn" onClick={() => save(false)}>Salvar e lançar outra</button>
        <button className="btn sec" onClick={() => save(true)}>Salvar e fechar</button>
        <button className="btn sec" onClick={onClose}>Fechar</button>
      </div>

      <div className="stmt-total" role="status">Total lançado nesta fatura: <b className="num">{formatBRL(s.totalCents)}</b></div>
      <p className="hint" style={{ marginTop: 4 }}>Compare com o total do extrato do banco.</p>
      {lines.length > 0 && (
        <ul className="list stmt-list">
          {lines.map(t => (
            <li key={t.id} className="b-head" style={{ padding: '10px 14px' }}>
              <span><b>{t.note ?? categories.find(c => c.id === t.categoryId)?.name}</b>
                <span className="hint"> {dateLabel(t.date)}{t.installment ? `, parcela ${t.installment.n} de ${t.installment.total}` : ''}</span></span>
              <span className="num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatBRL(t.amountCents)}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  )
}
