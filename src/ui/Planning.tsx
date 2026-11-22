import { useState } from 'react'
import { useGoals } from './useGoals'
import { useApp, useList, useLive } from './context'
import { Dialog, MonthNav, dateLabel, useMonth } from './common'
import { useUndo } from './UndoToast'
import { useGenerateRange } from './Summary'
import { Icon } from './Icons'
import { formatBRL, parseBRL } from '../domain/money'
import { lastDayOfMonth, today } from '../domain/dates'
import { AREAS, GENEROSITY_CATEGORY_ID, PLAN_ID, TERMS, areaById, areaPlan, goalId, goalProgress, planPct, termFor,
  type Area, type Goal, type Plan, type Term } from '../domain/goals'
import { SAVINGS_EXPENSE_ID } from '../domain/period'
import type { Card, Category, Transaction } from '../domain/types'

const fullDate = (d: string) => `${dateLabel(d)}/${d.slice(0, 4)}`
const termName = (t: Term) => TERMS.find(x => x.id === t)!.name

/** Subáreas de uma área. Necessidades usa as categorias de necessidade da família. */
export function subsFor(area: Area, categories: Category[]): string[] {
  if (area !== 'necessidades') return areaById(area).subs
  return categories
    .filter(c => c.kind === 'despesa' && !c.system && c.group === 'necessidade' && c.id !== GENEROSITY_CATEGORY_ID && c.id !== SAVINGS_EXPENSE_ID)
    .map(c => c.name)
}

export function Planning() {
  const { repo, me } = useApp()
  const [month, setMonth] = useMonth()
  const [term, setTerm] = useState<Term | 'todos'>('todos')
  const [editing, setEditing] = useState<Goal | { area: Area; sub?: string } | undefined>()
  const [editPlan, setEditPlan] = useState(false)
  const txs = useList<Transaction>('transactions')
  const categories = useList<Category>('categories') ?? []
  const cards = useList<Card>('cards') ?? []
  const plan = useLive(r => r.get<Plan>('settings', PLAN_ID))
  const goals = useGoals()
  const range = { from: `${month}-01`, to: `${month}-${String(lastDayOfMonth(month)).padStart(2, '0')}` }
  useGenerateRange(range)
  if (!txs || !goals) return null

  const now = today()
  const pct = planPct(plan)
  const r = areaPlan(range, { transactions: txs, categories, cards }, { today: now }, pct, goals)
  const shown = goals.filter(g => term === 'todos' || g.term === term)

  const toggleDone = (g: Goal) => {
    const next = { ...g }
    if (g.doneAt) delete next.doneAt
    else next.doneAt = now
    void repo.put<Goal>('settings', next, me)
  }

  return (
    <div className="plano">
      <h1>Planejamento</h1>

      <section className="panel" aria-label="Divisão da renda">
        <div className="b-head">
          <h2 style={{ margin: 0 }}>Divisão da renda</h2>
          <button className="mini" onClick={() => setEditPlan(true)}>Ajustar %</button>
        </div>
        <MonthNav month={month} setMonth={setMonth} />
        {r.incomeCents === 0
          ? <p className="muted">Sem entradas neste mês: a divisão compara o que saiu de cada área com a renda, então ainda não há o que comparar.</p>
          : <p className="muted" style={{ marginTop: 0 }}>Renda do mês: <strong className="num" style={{ color: 'var(--tinta)' }}>{formatBRL(r.incomeCents)}</strong></p>}
        <ul className="buckets">
          {r.rows.map(a => {
            const ratio = a.plannedCents > 0 ? Math.min(100, Math.round(a.realCents * 100 / a.plannedCents)) : (a.realCents > 0 ? 100 : 0)
            const verdict = r.incomeCents === 0 ? undefined
              : a.rule === 'teto' ? (a.inside ? 'Dentro do plano' : 'Acima do plano')
              : (a.inside ? 'Plano cumprido' : 'Abaixo do plano')
            return (
              <li key={a.area} aria-label={a.name}>
                <div className="b-head">
                  <strong>{a.name} <span className="muted">({a.pct}%)</span></strong>
                  {verdict && <span className={a.inside ? 'entrada' : 'saida'} style={{ fontWeight: 700 }}>{verdict}</span>}
                </div>
                <div className={`bar ${a.area} ${a.inside || r.incomeCents === 0 ? '' : 'over'}`} aria-hidden="true"><span style={{ width: `${ratio}%` }} /></div>
                <span className="hint num">Planejado {formatBRL(a.plannedCents)} · Realizado {formatBRL(a.realCents)}</span>
              </li>
            )
          })}
        </ul>
        {r.totalPct !== 100 && <p className="err">A divisão soma {r.totalPct}%, não 100%.</p>}
      </section>

      <div className="title-row" style={{ marginTop: 26 }}>
        <h2 style={{ margin: 0 }}>Metas</h2>
        <button className="btn" onClick={() => setEditing({ area: 'desejos' })}><Icon name="plus" size={18} /> Nova meta</button>
      </div>
      <div className="chips" role="group" aria-label="Filtrar por prazo">
        <button aria-pressed={term === 'todos'} onClick={() => setTerm('todos')}>Todas</button>
        {TERMS.map(t => <button key={t.id} aria-pressed={term === t.id} onClick={() => setTerm(t.id)}>{t.name}</button>)}
      </div>

      {AREAS.map(a => {
        const mine = shown.filter(g => g.area === a.id)
        const subs = subsFor(a.id, categories)
        // Subáreas fixas sempre aparecem; em Necessidades, só as que têm metas.
        const visible = a.id === 'necessidades' ? [...new Set(mine.map(g => g.sub ?? ''))] : [...subs, ...(mine.some(g => !g.sub || !subs.includes(g.sub)) ? [''] : [])]
        return (
          <section key={a.id} className={`panel area-box ${a.id}`} aria-label={a.name}>
            <div className="b-head">
              <h3>{a.name}</h3>
              <button className="mini" onClick={() => setEditing({ area: a.id })} aria-label={`Nova meta em ${a.name}`}><Icon name="plus" size={16} /> Meta</button>
            </div>
            {visible.length === 0 && <p className="muted small">Nenhuma meta{term !== 'todos' ? ` de ${termName(term).toLowerCase()}` : ''} nesta área.</p>}
            {visible.map(sub => {
              const list = mine.filter(g => sub ? g.sub === sub : !g.sub || !subs.includes(g.sub))
              return (
                <div key={sub || 'geral'} className="sub-box">
                  <div className="sub-head">
                    <span>{sub || 'Geral'}</span>
                    {list.length === 0 && <button className="linklike" onClick={() => setEditing({ area: a.id, sub })}>Adicionar meta</button>}
                  </div>
                  <ul className="goal-list">
                    {list.map(g => <GoalRow key={g.id} g={g} txs={txs} now={now} onOpen={() => setEditing(g)} onToggle={() => toggleDone(g)} />)}
                  </ul>
                </div>
              )
            })}
          </section>
        )
      })}

      {editing && <GoalForm initial={editing} categories={categories} onClose={() => setEditing(undefined)} />}
      {editPlan && <PlanForm pct={pct} onClose={() => setEditPlan(false)} />}
    </div>
  )
}

function GoalRow({ g, txs, now, onOpen, onToggle }: { g: Goal; txs: Transaction[]; now: string; onOpen: () => void; onToggle: () => void }) {
  const p = goalProgress(g, txs, now)
  const hasValue = g.targetCents !== undefined && g.targetCents > 0
  return (
    <li className={`goal ${p.reached ? 'done' : ''}`} aria-label={g.name}>
      <button className="goal-main" onClick={onOpen}>
        <span className="goal-top">
          <strong>{g.name}</strong>
          <span className={`badge term-${g.term}`}>{termName(g.term)}</span>
        </span>
        <span className="hint">
          {g.deadline ? `Até ${fullDate(g.deadline)}` : 'Sem data'}
          {p.reached ? (g.doneAt ? ` · Concluída em ${dateLabel(g.doneAt)}` : ' · Valor alcançado') : p.late ? ' · Prazo passou' : ''}
        </span>
        {hasValue && <>
          <span className="bar" aria-hidden="true"><span style={{ width: `${p.pct}%` }} /></span>
          <span className="hint num">
            {formatBRL(p.doneCents)} de {formatBRL(g.targetCents!)} ({p.pct}%)
            {p.pendingCents > 0 && ` · ${formatBRL(p.pendingCents)} previsto`}
            {!p.reached && p.perMonthCents ? ` · faltam ${formatBRL(p.remainingCents!)}, ${formatBRL(p.perMonthCents)} por mês` : ''}
          </span>
        </>}
      </button>
      {!hasValue && (
        <button className={`check-btn ${g.doneAt ? 'on' : ''}`} onClick={onToggle} aria-pressed={!!g.doneAt} aria-label={g.doneAt ? `Reabrir ${g.name}` : `Marcar ${g.name} como concluída`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </li>
  )
}

function GoalForm({ initial, categories, onClose }: { initial: Goal | { area: Area; sub?: string }; categories: Category[]; onClose: () => void }) {
  const { repo, me } = useApp()
  const undo = useUndo()
  const existing = 'id' in initial ? initial : undefined
  const [name, setName] = useState(existing?.name ?? '')
  const [area, setArea] = useState<Area>(initial.area)
  const [sub, setSub] = useState(initial.sub ?? '')
  const [deadline, setDeadline] = useState(existing?.deadline ?? '')
  const [term, setTerm] = useState<Term>(existing?.term ?? 'curto')
  const [value, setValue] = useState(existing?.targetCents ? (existing.targetCents / 100).toFixed(2).replace('.', ',') : '')
  const [note, setNote] = useState(existing?.note ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const subs = subsFor(area, categories)

  const save = async () => {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Dê um nome para a meta.'
    const cents = value.trim() ? parseBRL(value) : undefined
    if (value.trim() && (cents === null || cents === undefined || cents <= 0)) e.value = 'Valor inválido. Deixe em branco para uma meta sem dinheiro.'
    setErrors(e)
    if (Object.keys(e).length) return
    const g: Omit<Goal, 'updatedAt' | 'updatedBy'> = {
      ...(existing ?? {}), id: existing?.id ?? goalId(crypto.randomUUID()), name: name.trim(), area, term,
    }
    delete g.sub; delete g.deadline; delete g.targetCents; delete g.note
    if (sub) g.sub = sub
    if (deadline) g.deadline = deadline
    if (cents) g.targetCents = cents
    if (note.trim()) g.note = note.trim()
    await repo.put<Goal>('settings', g, me)
    onClose()
  }

  const remove = async () => {
    await repo.remove('settings', existing!.id, me)
    undo({ message: 'Meta excluída.', undo: () => repo.restore('settings', existing!.id, me) })
    onClose()
  }

  return (
    <Dialog title={existing ? 'Editar meta' : 'Nova meta'} onClose={onClose}>
      <div className="field">
        <label htmlFor="g-nome">Meta</label>
        <input id="g-nome" value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Viagem em família, Correr 10 km, Dízimo do mês" />
        {errors.name && <span className="err">{errors.name}</span>}
      </div>
      <div className="field">
        <label htmlFor="g-area">Área</label>
        <select id="g-area" value={area} onChange={e => { setArea(e.target.value as Area); setSub('') }}>
          {AREAS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      {subs.length > 0 && (
        <div className="field">
          <label htmlFor="g-sub">{area === 'desejos' ? 'Área da vida' : area === 'necessidades' ? 'Categoria' : 'Tipo'}</label>
          <select id="g-sub" value={sub} onChange={e => setSub(e.target.value)}>
            <option value="">Geral</option>
            {subs.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="g-data">Data-limite (opcional)</label>
        <input id="g-data" type="date" value={deadline} onChange={e => { setDeadline(e.target.value); if (e.target.value) setTerm(termFor(e.target.value, today())) }} />
      </div>
      <div className="field">
        <span className="lbl">Prazo</span>
        <div className="seg" role="group" aria-label="Prazo">
          {TERMS.map(t => <button key={t.id} type="button" aria-pressed={term === t.id} onClick={() => setTerm(t.id)}>{t.name}</button>)}
        </div>
        <span className="hint">{TERMS.find(t => t.id === term)!.hint}{deadline ? ' (pela data-limite)' : ''}</span>
      </div>
      <div className="field">
        <label htmlFor="g-valor">Valor (R$, opcional)</label>
        <input id="g-valor" inputMode="decimal" value={value} onChange={e => setValue(e.target.value)} placeholder="Em branco = meta sem dinheiro" />
        {errors.value && <span className="err">{errors.value}</span>}
        <span className="hint">Com valor, o progresso soma os lançamentos ligados a esta meta. Sem valor, você marca como concluída.</span>
      </div>
      <div className="field">
        <label htmlFor="g-obs">Observação</label>
        <input id="g-obs" value={note} onChange={e => setNote(e.target.value)} />
      </div>
      <div className="btns">
        <button className="btn" onClick={() => void save()}>Salvar</button>
        {existing && <button className="btn perigo" onClick={() => void remove()}>Excluir</button>}
        <button className="btn sec" onClick={onClose}>Cancelar</button>
      </div>
    </Dialog>
  )
}

function PlanForm({ pct, onClose }: { pct: Record<Area, number>; onClose: () => void }) {
  const { repo, me } = useApp()
  const [vals, setVals] = useState<Record<Area, string>>(() =>
    Object.fromEntries(AREAS.map(a => [a.id, String(pct[a.id])])) as Record<Area, string>)
  const nums = Object.fromEntries(AREAS.map(a => [a.id, Number(vals[a.id].replace(',', '.'))])) as Record<Area, number>
  const valid = AREAS.every(a => Number.isFinite(nums[a.id]) && nums[a.id] >= 0 && nums[a.id] <= 100)
  const total = Math.round(AREAS.reduce((s, a) => s + (Number.isFinite(nums[a.id]) ? nums[a.id] : 0), 0) * 100) / 100
  const ok = valid && total === 100
  const save = async () => {
    await repo.put<Plan>('settings', { id: PLAN_ID, pct: nums }, me)
    onClose()
  }
  return (
    <Dialog title="Divisão da renda" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Quanto da renda de cada mês vai para cada área. A soma precisa dar 100%.</p>
      {AREAS.map(a => (
        <div className="field pct-row" key={a.id}>
          <label htmlFor={`p-${a.id}`}>{a.name}</label>
          <span className="pct-input"><input id={`p-${a.id}`} inputMode="decimal" value={vals[a.id]} onChange={e => setVals({ ...vals, [a.id]: e.target.value })} /> %</span>
        </div>
      ))}
      <p className={ok ? 'entrada' : 'err'} style={{ fontWeight: 700 }}>Total: {valid ? total : '—'}%{ok ? '' : ' (precisa somar 100%)'}</p>
      <div className="btns">
        <button className="btn" disabled={!ok} onClick={() => void save()}>Salvar</button>
        <button className="btn sec" onClick={onClose}>Cancelar</button>
      </div>
    </Dialog>
  )
}
