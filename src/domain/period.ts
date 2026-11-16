import { addMonths, clampDay, dayOf, lastDayOfMonth, monthOf } from './dates'
import { methodById } from './methods'
import { competenceDate, paidInvoices, txStatus } from './status'
import type { Card, Category, ProfileId, Transaction, TxKind } from './types'

export type PeriodKind = 'dia' | 'semana' | 'mes' | 'trimestre' | 'semestre' | 'ano'
export interface Range { from: string; to: string }

const pad = (n: number) => String(n).padStart(2, '0')
const toDate = (d: string) => new Date(`${d}T12:00:00Z`)
const fromDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export function addDays(date: string, n: number): string {
  const d = toDate(date)
  d.setUTCDate(d.getUTCDate() + n)
  return fromDate(d)
}

/** Dias do intervalo, contando as duas pontas. */
export function daysIn(r: Range): number {
  return Math.round((toDate(r.to).getTime() - toDate(r.from).getTime()) / 86_400_000) + 1
}

const monthSpan: Record<'mes' | 'trimestre' | 'semestre' | 'ano', number> = { mes: 1, trimestre: 3, semestre: 6, ano: 12 }

export function periodRange(kind: PeriodKind, anchor: string): Range {
  if (kind === 'dia') return { from: anchor, to: anchor }
  if (kind === 'semana') {
    const dow = (toDate(anchor).getUTCDay() + 6) % 7 // segunda = 0
    const from = addDays(anchor, -dow)
    return { from, to: addDays(from, 6) }
  }
  const span = monthSpan[kind]
  const [y, m] = monthOf(anchor).split('-').map(Number)
  const startM = Math.floor((m - 1) / span) * span + 1
  const first = `${y}-${pad(startM)}`
  const last = addMonths(first, span - 1)
  return { from: `${first}-01`, to: `${last}-${pad(lastDayOfMonth(last))}` }
}

export function shiftPeriod(kind: PeriodKind, anchor: string, n: number): string {
  if (kind === 'dia') return addDays(anchor, n)
  if (kind === 'semana') return addDays(anchor, 7 * n)
  return clampDay(addMonths(monthOf(anchor), monthSpan[kind] * n), dayOf(anchor))
}

export interface SummaryData { transactions: Transaction[]; categories: Category[]; cards: Card[] }
export interface SummaryOpts { profile?: ProfileId; onlyPaid?: boolean; methodId?: string; today: string }

interface Totals { incomeCents: number; expenseCents: number; investCents: number }
const zero = (): Totals => ({ incomeCents: 0, expenseCents: 0, investCents: 0 })
const field: Record<TxKind, keyof Totals> = { receita: 'incomeCents', despesa: 'expenseCents', investimento: 'investCents' }

/** Lançamentos que entram nos totais do intervalo, com a data em que contam. */
export function countedIn(range: Range, data: SummaryData, opts: SummaryOpts): Array<{ t: Transaction; date: string }> {
  const paid = paidInvoices(data.transactions, data.cards)
  const ctx = { paid, cards: data.cards, today: opts.today }
  const out: Array<{ t: Transaction; date: string }> = []
  for (const t of data.transactions) {
    if (t.deletedAt || t.cardPayment) continue
    if (opts.profile && t.profileId !== opts.profile) continue
    const date = competenceDate(t)
    if (date < range.from || date > range.to) continue
    if (opts.onlyPaid && txStatus(t, ctx) !== 'pago') continue
    out.push({ t, date })
  }
  return out
}

/** Orçamento mensal proporcional aos dias de cada mês que o intervalo cobre. */
export function proratedBudget(monthlyCents: number, range: Range): number {
  let total = 0
  for (let m = monthOf(range.from); m <= monthOf(range.to); m = addMonths(m, 1)) {
    const last = lastDayOfMonth(m)
    const from = m === monthOf(range.from) ? dayOf(range.from) : 1
    const to = m === monthOf(range.to) ? dayOf(range.to) : last
    total += Math.round(monthlyCents * (to - from + 1) / last)
  }
  return total
}

export function periodSummary(range: Range, data: SummaryData, opts: SummaryOpts) {
  const rows = countedIn(range, data, opts)
  const totals = zero()
  const byProfile: Record<ProfileId, Totals> = { u1: zero(), u2: zero() }
  const perCat = new Map<string, number>()
  for (const { t } of rows) {
    totals[field[t.kind]] += t.amountCents
    byProfile[t.profileId][field[t.kind]] += t.amountCents
    perCat.set(t.categoryId, (perCat.get(t.categoryId) ?? 0) + t.amountCents)
  }

  const cats = data.categories.filter(c => !c.deletedAt)
  const byCategory = cats
    .filter(c => perCat.has(c.id) || (c.kind === 'despesa' && c.monthlyBudgetCents))
    .map(c => ({
      categoryId: c.id, kind: c.kind, spentCents: perCat.get(c.id) ?? 0,
      ...(c.kind === 'despesa' && c.monthlyBudgetCents ? { budgetCents: proratedBudget(c.monthlyBudgetCents, range) } : {}),
    }))
    .sort((a, b) => b.spentCents - a.spentCents)

  // 50/30/20: despesas de categorias "necessidade" x o resto (sem grupo = desejo, como na planilha).
  const group = new Map(cats.map(c => [c.id, c.group]))
  let needReal = 0
  for (const { t } of rows) if (t.kind === 'despesa' && (t.group ?? group.get(t.categoryId)) === 'necessidade') needReal += t.amountCents
  const m = methodById(opts.methodId)
  const plan = (pct: number) => Math.round(totals.incomeCents * pct / 100)
  const buckets = [
    { key: 'need' as const, name: 'Necessidades', pct: m.need, plannedCents: plan(m.need), realCents: needReal },
    { key: 'want' as const, name: 'Desejos', pct: m.want, plannedCents: plan(m.want), realCents: totals.expenseCents - needReal },
    { key: 'invest' as const, name: 'Investimentos', pct: m.invest, plannedCents: plan(m.invest), realCents: totals.investCents },
  ].map(b => ({
    ...b, diffCents: b.plannedCents - b.realCents,
    inside: b.key === 'invest' ? b.realCents >= b.plannedCents : b.realCents <= b.plannedCents,
  }))

  return {
    ...totals,
    beforeInvestCents: totals.incomeCents - totals.expenseCents,
    finalCents: totals.incomeCents - totals.expenseCents - totals.investCents,
    byProfile,
    byCategory,
    method: {
      id: m.id, label: m.label, buckets,
      plannedFinalCents: totals.incomeCents - buckets.reduce((s, b) => s + b.plannedCents, 0),
      realFinalCents: totals.incomeCents - totals.expenseCents - totals.investCents,
    },
    series: series(range, rows),
  }
}

/** Um ponto por dia (até ~2 meses) ou por mês. */
function series(range: Range, rows: Array<{ t: Transaction; date: string }>) {
  const unit: 'dia' | 'mes' = daysIn(range) <= 62 ? 'dia' : 'mes'
  const points: Array<{ key: string } & Totals> = []
  if (unit === 'dia') for (let d = range.from; d <= range.to; d = addDays(d, 1)) points.push({ key: d, ...zero() })
  else for (let m = monthOf(range.from); m <= monthOf(range.to); m = addMonths(m, 1)) points.push({ key: m, ...zero() })
  const idx = new Map(points.map((p, i) => [p.key, i]))
  for (const { t, date } of rows) {
    const p = points[idx.get(unit === 'dia' ? date : monthOf(date))!]
    if (p) p[field[t.kind]] += t.amountCents
  }
  return { unit, points }
}
