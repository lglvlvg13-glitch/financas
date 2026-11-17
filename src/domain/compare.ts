import { periodRange, periodSummary, shiftPeriod, addDays, daysIn, type PeriodKind, type Range, type SummaryData, type SummaryOpts } from './period'

export interface Cmp { current: number; previous: number; average: number }
export interface CatCmp extends Cmp { vsPreviousPct?: number; vsAveragePct?: number }

const pct = (cur: number, base: number) => (base > 0 ? ((cur - base) / base) * 100 : undefined)

/** Os 6 períodos anteriores do mesmo tamanho (meses para "mês", semanas para "semana", etc.). */
function previousRanges(kind: PeriodKind | 'personalizado', anchorOrRange: string | Range, n = 6): Range[] {
  const out: Range[] = []
  if (kind === 'personalizado') {
    const r = anchorOrRange as Range, len = daysIn(r)
    for (let i = 1; i <= n; i++) out.push({ from: addDays(r.from, -len * i), to: addDays(r.to, -len * i) })
  } else {
    for (let i = 1; i <= n; i++) out.push(periodRange(kind, shiftPeriod(kind, anchorOrRange as string, -i)))
  }
  return out
}

/** Compara o período com o anterior e com a média dos 6 anteriores (por categoria e nos totais).
 *  A média considera só os períodos que tiveram algum lançamento, para não puxar para baixo antes de começar a usar o app. */
export function comparePeriods(kind: PeriodKind | 'personalizado', anchorOrRange: string | Range, data: SummaryData, opts: Omit<SummaryOpts, 'methodId'>) {
  const cur = periodSummary(kind === 'personalizado' ? anchorOrRange as Range : periodRange(kind, anchorOrRange as string), data, opts)
  const prev = previousRanges(kind, anchorOrRange).map(r => periodSummary(r, data, opts))
  const used = prev.filter(p => p.incomeCents + p.expenseCents + p.investCents > 0)
  const avg = (f: (s: typeof cur) => number) => (used.length ? Math.round(used.reduce((a, s) => a + f(s), 0) / used.length) : 0)

  const cats = new Set([...cur.byCategory, ...prev.flatMap(p => p.byCategory)].map(c => c.categoryId))
  const byCategory = new Map<string, CatCmp>()
  for (const id of cats) {
    const spent = (s: typeof cur) => s.byCategory.find(c => c.categoryId === id)?.spentCents ?? 0
    const c: CatCmp = { current: spent(cur), previous: spent(prev[0]), average: avg(spent) }
    const vp = pct(c.current, c.previous), va = used.length >= 2 ? pct(c.current, c.average) : undefined
    if (vp !== undefined) c.vsPreviousPct = vp
    if (va !== undefined) c.vsAveragePct = va
    byCategory.set(id, c)
  }
  const tot = (f: (s: typeof cur) => number): Cmp => ({ current: f(cur), previous: f(prev[0]), average: avg(f) })
  return {
    totals: { income: tot(s => s.incomeCents), expense: tot(s => s.expenseCents), invest: tot(s => s.investCents) },
    byCategory,
    periodsInAverage: used.length,
  }
}
