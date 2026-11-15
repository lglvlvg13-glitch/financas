import { useState } from 'react'
import { useApp, useList } from './context'
import { Confirm, currentMonth, Dialog, monthLabel } from './common'
import { useUndo } from './UndoToast'
import { formatBRL, parseBRL } from '../domain/money'
import { monthOf } from '../domain/dates'
import type { Category, Recurrence, Transaction } from '../domain/types'

export function Recurrences() {
  const recs = useList<Recurrence>('recurrences')
  const cats = useList<Category>('categories') ?? []
  const [editing, setEditing] = useState<Recurrence>()
  const catName = (id: string) => cats.find(c => c.id === id)?.name ?? ''

  return (
    <>
      <h1>Lançamentos recorrentes</h1>
      <p className="muted">Lançados sozinhos todo mês. Para criar um, marque “Repetir todo mês” ao fazer um lançamento.</p>
      {recs && recs.length === 0 && <div className="list"><p className="empty">Nenhum lançamento recorrente.</p></div>}
      {recs && recs.length > 0 && (
        <ul className="list">
          {recs.map(r => (
            <li key={r.id}>
              <button className="row" onClick={() => setEditing(r)}>
                <strong>{r.template.note || catName(r.template.categoryId)}</strong>
                <span className={`val num ${r.template.kind === 'receita' ? 'entrada' : 'saida'}`}>{formatBRL(r.template.amountCents)}</span>
                <span className="sub">
                  Todo dia {r.dayOfMonth}{r.endMonth ? `, até ${monthLabel(r.endMonth)}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <RecurrenceForm rec={editing} onClose={() => setEditing(undefined)} />}
    </>
  )
}

function RecurrenceForm({ rec, onClose }: { rec: Recurrence; onClose: () => void }) {
  const { repo, me } = useApp()
  const undo = useUndo()
  const txs = useList<Transaction>('transactions') ?? []
  const [amount, setAmount] = useState(formatBRL(rec.template.amountCents).replace('R$ ', ''))
  const [day, setDay] = useState(rec.dayOfMonth)
  const [note, setNote] = useState(rec.template.note ?? '')
  const [error, setError] = useState<string>()
  const [confirm, setConfirm] = useState(false)
  const [alsoThisMonth, setAlsoThisMonth] = useState(false)
  const thisMonthTx = txs.find(t => t.recurrenceId === rec.id && monthOf(t.date) === currentMonth())

  const save = async () => {
    const cents = parseBRL(amount)
    if (!cents || cents <= 0) return setError('Valor inválido')
    if (day < 1 || day > 31) return setError('Dia deve ser de 1 a 31')
    await repo.put<Recurrence>('recurrences', {
      ...rec, dayOfMonth: day, template: { ...rec.template, amountCents: cents, note: note.trim() || undefined },
    }, me)
    onClose()
  }

  const end = async () => {
    await repo.put<Recurrence>('recurrences', { ...rec, endMonth: currentMonth() }, me)
    onClose()
  }

  const remove = async () => {
    await repo.remove('recurrences', rec.id, me)
    const removedTx = alsoThisMonth && thisMonthTx ? thisMonthTx.id : undefined
    if (removedTx) await repo.remove('transactions', removedTx, me)
    undo({ message: 'Recorrência excluída.', undo: async () => {
      await repo.restore('recurrences', rec.id, me)
      if (removedTx) await repo.restore('transactions', removedTx, me)
    } })
    onClose()
  }

  return (
    <Dialog title="Lançamento recorrente" onClose={onClose}>
      <p className="muted">As mudanças valem para os próximos meses. O que já foi lançado não muda.</p>
      <div className="field">
        <label htmlFor="rec-valor">Valor (R$)</label>
        <input id="rec-valor" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="rec-dia">Dia do mês</label>
        <input id="rec-dia" type="number" min={1} max={31} value={day} onChange={e => setDay(Number(e.target.value))} />
      </div>
      <div className="field">
        <label htmlFor="rec-obs">Descrição</label>
        <input id="rec-obs" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {error && <p className="err saida" role="alert">{error}</p>}
      <div className="btns">
        <button className="btn" onClick={save}>Salvar</button>
        {!rec.endMonth && <button className="btn sec" onClick={end}>Encerrar</button>}
        <button className="btn perigo" onClick={() => setConfirm(true)}>Excluir</button>
      </div>
      {confirm && (
        <Confirm
          title="Excluir esta recorrência?"
          onCancel={() => setConfirm(false)}
          body={thisMonthTx && (
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={alsoThisMonth} onChange={e => setAlsoThisMonth(e.target.checked)} />
              Excluir também o lançamento deste mês
            </label>
          )}
          actions={[{ label: 'Excluir', kind: 'perigo', run: remove }]}
        />
      )}
    </Dialog>
  )
}
