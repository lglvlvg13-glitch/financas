import { countedIn, resolveGroup, SAVINGS_EXPENSE_ID, type SummaryData, type SummaryOpts } from './period'
import type { Category, Meta, Transaction } from './types'

/** As 5 áreas do planejamento, na ordem da família. */
export type Area = 'generosidade' | 'necessidades' | 'desejos' | 'poupancas' | 'investimentos'
export type Term = 'curto' | 'medio' | 'longo'

export interface AreaDef {
  id: Area
  name: string
  /** Subáreas fixas. Em Necessidades, a tela usa as categorias de necessidade da família. */
  subs: string[]
  /** 'teto': gastar até o planejado. 'piso': chegar pelo menos ao planejado. */
  rule: 'teto' | 'piso'
}

export const AREAS: AreaDef[] = [
  { id: 'generosidade', name: 'Generosidade', subs: ['Dízimos', 'Ofertas', 'Doações'], rule: 'piso' },
  { id: 'necessidades', name: 'Necessidades', subs: [], rule: 'teto' },
  { id: 'desejos', name: 'Desejos', subs: ['Física', 'Mental', 'Família', 'Financeira', 'Social'], rule: 'teto' },
  { id: 'poupancas', name: 'Poupanças', subs: ['Reserva de emergência', 'Curto prazo', 'Objetivos'], rule: 'piso' },
  { id: 'investimentos', name: 'Investimentos', subs: ['Aposentadoria', 'Patrimônio', 'Educação dos filhos'], rule: 'piso' },
]
export const areaById = (id: Area) => AREAS.find(a => a.id === id)!

export const TERMS: Array<{ id: Term; name: string; hint: string }> = [
  { id: 'curto', name: 'Curto prazo', hint: 'até 1 ano' },
  { id: 'medio', name: 'Médio prazo', hint: '1 a 5 anos' },
  { id: 'longo', name: 'Longo prazo', hint: 'mais de 5 anos' },
]

/** Divisão da renda sugerida ao começar; a família ajusta. Soma 100. */
export const DEFAULT_PCT: Record<Area, number> = { generosidade: 10, necessidades: 50, desejos: 20, poupancas: 10, investimentos: 10 }

/** Meta da família. Guardada na coleção de preferências com id "goal:…", para que versões antigas
 *  do app, que não conhecem metas, as preservem na sincronização. */
export interface Goal extends Meta {
  name: string
  area: Area
  sub?: string
  term: Term
  /** Sem valor: meta de vida sem dinheiro (ex.: correr 10 km), concluída à mão. */
  targetCents?: number
  /** YYYY-MM-DD */
  deadline?: string
  /** Data em que a família marcou como concluída. */
  doneAt?: string
  note?: string
}

/** Divisão da renda por área, registro único "plan" nas preferências. */
export interface Plan extends Meta { pct: Partial<Record<Area, number>> }

export const PLAN_ID = 'plan'
export const goalId = (uuid: string) => `goal:${uuid}`
export const isGoalId = (id: string) => id.startsWith('goal:')

export function planPct(plan: Plan | undefined): Record<Area, number> {
  return { ...DEFAULT_PCT, ...(plan?.pct ?? {}) }
}

const monthsBetween = (from: string, to: string) =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7))

/** Prazo pela data-limite: até 12 meses curto, até 60 médio, depois longo. */
export function termFor(deadline: string, today: string): Term {
  let m = monthsBetween(today, deadline)
  if (Number(deadline.slice(8, 10)) > Number(today.slice(8, 10))) m += 0.5 // passa do mesmo dia: conta parte do mês
  return m <= 12 ? 'curto' : m <= 60 ? 'medio' : 'longo'
}

/** Em que área um lançamento conta. Receitas não entram (são a renda). */
export function areaOf(t: Transaction, cats: Map<string, Category>, goals: Map<string, Goal>): Area | null {
  if (t.kind === 'receita') return null
  const g = t.goalId ? goals.get(t.goalId) : undefined
  if (g && !g.deletedAt) return g.area
  if (t.kind === 'investimento') return 'investimentos'
  if (t.categoryId === GENEROSITY_CATEGORY_ID) return 'generosidade'
  if (t.categoryId === SAVINGS_EXPENSE_ID) return 'poupancas'
  return resolveGroup(t, cats.get(t.categoryId)) === 'necessidade' ? 'necessidades' : 'desejos'
}

export const GENEROSITY_CATEGORY_ID = 'cat-doacoes'

export function areaPlan(
  range: { from: string; to: string }, data: SummaryData, opts: SummaryOpts,
  pct: Record<Area, number>, goals: Goal[],
) {
  const cats = new Map(data.categories.map(c => [c.id, c]))
  const gs = new Map(goals.map(g => [g.id, g]))
  let incomeCents = 0
  const real: Record<Area, number> = { generosidade: 0, necessidades: 0, desejos: 0, poupancas: 0, investimentos: 0 }
  for (const { t } of countedIn(range, data, opts)) {
    if (t.kind === 'receita') { incomeCents += t.amountCents; continue }
    const a = areaOf(t, cats, gs)
    if (a) real[a] += t.amountCents
  }
  const rows = AREAS.map(a => {
    const plannedCents = Math.round(incomeCents * pct[a.id] / 100)
    const realCents = real[a.id]
    return {
      area: a.id, name: a.name, rule: a.rule, pct: pct[a.id], plannedCents, realCents,
      diffCents: plannedCents - realCents,
      inside: a.rule === 'teto' ? realCents <= plannedCents : realCents >= plannedCents,
    }
  })
  return { incomeCents, rows, totalPct: AREAS.reduce((s, a) => s + pct[a.id], 0) }
}

/** Progresso de uma meta pelos lançamentos ligados a ela. */
export function goalProgress(g: Goal, txs: Transaction[], today: string) {
  let doneCents = 0, pendingCents = 0
  for (const t of txs) {
    if (t.deletedAt || t.goalId !== g.id) continue
    if (t.pending) pendingCents += t.amountCents
    else doneCents += t.amountCents
  }
  const target = g.targetCents
  const hasTarget = target !== undefined && target > 0
  const remainingCents = hasTarget ? Math.max(0, target - doneCents) : undefined
  const reached = !!g.doneAt || (hasTarget && doneCents >= target)
  const monthsLeft = g.deadline ? Math.max(0, monthsBetween(today.slice(0, 7), g.deadline.slice(0, 7))) : undefined
  const late = !!g.deadline && g.deadline < today && !reached
  return {
    doneCents, pendingCents, remainingCents, reached, late, monthsLeft,
    pct: hasTarget ? Math.min(100, Math.floor(doneCents * 100 / target)) : undefined,
    /** Quanto por mês falta juntar/gastar até a data, se ainda houver meses. */
    perMonthCents: remainingCents && monthsLeft ? Math.ceil(remainingCents / monthsLeft) : undefined,
  }
}
