import { useState } from 'react'
import { useApp, useList, useProfiles } from './context'
import { dateLabel, monthLabel } from './common'
import { useUndo } from './UndoToast'
import { formatBRL } from '../domain/money'
import { addMonths, monthOf, today } from '../domain/dates'
import { invoiceMonthFor } from '../domain/invoice'
import { parseCsv, parseOfx, toDrafts, type DraftRow, type ImportTarget } from '../domain/importer'
import type { Account, Card, Category, ProfileId, Transaction } from '../domain/types'

/** Importar o extrato da conta ou a fatura do cartão (OFX ou CSV exportado pelo banco). */
export function Import({ onDone }: { onDone: () => void }) {
  const { repo, me } = useApp()
  const undo = useUndo()
  const names = useProfiles()
  const accounts = useList<Account>('accounts') ?? []
  const cards = useList<Card>('cards') ?? []
  const categories = useList<Category>('categories') ?? []
  const txs = useList<Transaction>('transactions') ?? []
  const [where, setWhere] = useState('')
  const [who, setWho] = useState<ProfileId>(me)
  const [invoiceMonth, setInvoiceMonth] = useState(monthOf(today()))
  const [rows, setRows] = useState<Array<DraftRow & { on: boolean }>>()
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const card = where.startsWith('c:') ? cards.find(c => c.id === where.slice(2)) : undefined
  const target = (month = invoiceMonth): ImportTarget | undefined =>
    where.startsWith('a:') ? { accountId: where.slice(2) } : card ? { cardId: card.id, invoiceMonth: month } : undefined

  const read = async (file: File) => {
    setError(undefined); setRows(undefined)
    const t = target()
    if (!t) { setError('Escolha primeiro para onde vão os lançamentos.'); return }
    const text = await file.text()
    const parsed = /<STMTTRN>/i.test(text) ? parseOfx(text) : parseCsv(text)
    if (parsed.length === 0) {
      setError('Não encontrei lançamentos nesse arquivo. Exporte o extrato do banco em OFX ou CSV (com colunas de data, descrição e valor) e tente de novo.')
      return
    }
    // Fatura: sugere o mês da fatura pela compra mais recente.
    let month = invoiceMonth
    if (card) {
      const last = parsed.map(r => r.date).sort().at(-1)!
      month = invoiceMonthFor(last, card.closingDay)
      setInvoiceMonth(month)
    }
    const drafts = toDrafts(parsed, { target: target(month)!, profileId: who, existing: txs, history: txs })
    const usable = card ? parsed.filter(r => r.amountCents > 0).length : parsed.filter(r => r.amountCents !== 0).length
    setSkipped(usable - drafts.length)
    setRows(drafts.map(d => ({ ...d, on: true })))
  }

  const update = (i: number, patch: Partial<Transaction>) =>
    setRows(rows!.map((r, j) => (j === i ? { ...r, draft: { ...r.draft, ...patch } } : r)))

  const chosen = (rows ?? []).filter(r => r.on)
  const save = async () => {
    if (busy) return
    setBusy(true)
    const ids: string[] = []
    try {
      for (const r of chosen) {
        const d = { ...r.draft, profileId: who, ...(card ? { invoiceMonth } : {}) }
        ids.push((await repo.put<Transaction>('transactions', d, me)).id)
      }
    } finally { setBusy(false) }
    undo({ message: `${ids.length} ${ids.length === 1 ? 'lançamento importado' : 'lançamentos importados'}.`, undo: async () => { for (const id of ids) await repo.remove('transactions', id, me) } })
    onDone()
  }

  const catsFor = (kind: Transaction['kind']) => categories.filter(c => c.kind === kind && !c.system)

  return (
    <>
      <h1>Importar extrato</h1>
      <p className="muted">No app ou no site do banco, exporte o extrato da conta ou a fatura do cartão em <b>OFX</b> ou <b>CSV</b>. O app sugere a categoria de cada linha (aprendendo com o que vocês já lançaram) e não importa a mesma linha duas vezes.</p>

      <div className="panel" style={{ display: 'grid', gap: 4 }}>
        <div className="field">
          <label htmlFor="imp-onde">Para onde</label>
          <select id="imp-onde" value={where} onChange={e => { setWhere(e.target.value); setRows(undefined) }}>
            <option value="">Escolha…</option>
            {accounts.length > 0 && <optgroup label="Extrato da conta">
              {accounts.map(a => <option key={a.id} value={`a:${a.id}`}>Conta {a.name}</option>)}
            </optgroup>}
            {cards.length > 0 && <optgroup label="Fatura do cartão">
              {cards.map(c => <option key={c.id} value={`c:${c.id}`}>Cartão {c.name}</option>)}
            </optgroup>}
          </select>
        </div>
        {card && (
          <div className="field">
            <label htmlFor="imp-fatura">Fatura de</label>
            <select id="imp-fatura" value={invoiceMonth} onChange={e => setInvoiceMonth(e.target.value)}>
              {[-3, -2, -1, 0, 1, 2].map(n => addMonths(monthOf(today()), n)).map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <span className="lbl">De quem</span>
          <div className="seg" role="group" aria-label="De quem">
            <button aria-pressed={who === 'u1'} onClick={() => setWho('u1')}>{names.u1}</button>
            <button aria-pressed={who === 'u2'} onClick={() => setWho('u2')}>{names.u2}</button>
          </div>
        </div>
        <div className="field">
          <label htmlFor="imp-arq">Arquivo do extrato (OFX ou CSV)</label>
          <input id="imp-arq" type="file" accept=".ofx,.csv,.txt,text/csv,application/x-ofx"
            onChange={e => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = '' }} />
        </div>
        {error && <p className="err saida" role="alert">{error}</p>}
      </div>

      {rows && (
        <>
          <h2>{rows.length === 0 ? 'Nada novo para importar' : `${rows.length} ${rows.length === 1 ? 'linha nova' : 'linhas novas'}`}</h2>
          {skipped > 0 && <p className="muted">{skipped} {skipped === 1 ? 'linha já tinha sido importada' : 'linhas já tinham sido importadas'} antes e {skipped === 1 ? 'ficou' : 'ficaram'} de fora.</p>}
          {card && <p className="hint">Estornos e pagamentos da fatura (valores negativos) ficam de fora.</p>}
          {rows.length > 0 && (
            <ul className="list import-list" aria-label="Linhas do extrato">
              {rows.map((r, i) => {
                const d = r.draft
                const cat = categories.find(c => c.id === d.categoryId)
                return (
                  <li key={r.key} aria-label={d.note} className={r.on ? '' : 'off'}>
                    <label className="check" style={{ marginBottom: 6 }}>
                      <input type="checkbox" checked={r.on} onChange={e => setRows(rows.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                      <span className="imp-desc"><b>{d.note}</b><span className="hint"> {dateLabel(d.date)}</span></span>
                      <span className={`num ${d.kind === 'receita' ? 'entrada' : 'saida'}`} style={{ marginLeft: 'auto', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {d.kind === 'receita' ? '+' : '−'}{formatBRL(d.amountCents)}
                      </span>
                    </label>
                    <div className="range">
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor={`imp-cat-${i}`}>Categoria</label>
                        <select id={`imp-cat-${i}`} value={d.categoryId} onChange={e => update(i, { categoryId: e.target.value, item: undefined })}>
                          {catsFor(d.kind).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      {cat?.items?.length ? (
                        <div className="field" style={{ marginBottom: 0 }}>
                          <label htmlFor={`imp-item-${i}`}>Item</label>
                          <select id={`imp-item-${i}`} value={d.item ?? ''} onChange={e => update(i, { item: e.target.value || undefined })}>
                            <option value="">Não especificar</option>
                            {cat.items.map(x => <option key={x.name} value={x.name}>{x.name}</option>)}
                          </select>
                        </div>
                      ) : <div />}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="btns">
            {chosen.length > 0 && <button className="btn" disabled={busy} onClick={save}>Importar {chosen.length} {chosen.length === 1 ? 'lançamento' : 'lançamentos'}</button>}
            <button className="btn sec" onClick={onDone}>Cancelar</button>
          </div>
        </>
      )}
    </>
  )
}
