import { useEffect, useRef, useState, type ReactNode } from 'react'
import { addMonths, monthOf, today } from '../domain/dates'

const monthFmt = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
export const monthLabel = (m: string) => {
  const s = monthFmt.format(new Date(`${m}-15T12:00:00Z`))
  return s.charAt(0).toUpperCase() + s.slice(1)
}
export const dateLabel = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
export const currentMonth = () => monthOf(today())

export function useMonth(): [string, (m: string) => void] {
  return useState(currentMonth())
}

export function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div className="month">
      <button aria-label="Mês anterior" onClick={() => setMonth(addMonths(month, -1))}>‹</button>
      <strong>{monthLabel(month)}</strong>
      <button aria-label="Mês seguinte" onClick={() => setMonth(addMonths(month, 1))}>›</button>
    </div>
  )
}

/** Painel modal; fecha com Esc ou tocando fora. */
export function Dialog({ title, onClose, children, role = 'dialog' }: {
  title: string; onClose: () => void; children: ReactNode; role?: 'dialog' | 'alertdialog'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select, button')?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dialog" role={role} aria-modal="true" aria-label={title} ref={ref}>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export interface ConfirmAction { label: string; kind?: 'perigo' | 'sec'; run: () => void | Promise<void> }

export function Confirm({ title, body, actions, onCancel }: {
  title: string; body?: ReactNode; actions: ConfirmAction[]; onCancel: () => void
}) {
  return (
    <Dialog title={title} onClose={onCancel} role="alertdialog">
      {body && <div className="muted">{body}</div>}
      <div className="btns">
        {actions.map(a => (
          <button key={a.label} className={`btn ${a.kind ?? ''}`} onClick={() => void a.run()}>{a.label}</button>
        ))}
        <button className="btn sec" onClick={onCancel}>Cancelar</button>
      </div>
    </Dialog>
  )
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
