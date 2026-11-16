import { periodSummary, countedIn, type SummaryData } from './period'
import { paidInvoices, txStatus } from './status'
import type { TxKind } from './types'

const pad = (n: number) => String(n).padStart(2, '0')
const monthRange = (year: number, m: number) => {
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate()
  return { from: `${year}-${pad(m)}-01`, to: `${year}-${pad(m)}-${pad(last)}` }
}

export interface ReportRow { label: string; level: 'total' | 'item' | 'saldo'; kind?: TxKind; values: number[]; total: number }

/** Mesma estrutura da aba RELATÓRIO FINANCEIRO: tipo, categorias, saldos, 12 meses e total. */
export function yearReport(year: number, data: SummaryData, opts: { onlyPaid?: boolean; today: string }) {
  const months = Array.from({ length: 12 }, (_, i) => countedIn(monthRange(year, i + 1), data, opts))
  const sumBy = (pred: (kind: TxKind, cat: string) => boolean) =>
    months.map(rows => rows.reduce((s, { t }) => s + (pred(t.kind, t.categoryId) ? t.amountCents : 0), 0))
  const mk = (label: string, level: ReportRow['level'], values: number[], kind?: TxKind): ReportRow =>
    ({ label, level, kind, values, total: values.reduce((a, b) => a + b, 0) })

  const cats = data.categories.filter(c => !c.deletedAt && !c.system)
  const rows: ReportRow[] = []
  const block = (kind: TxKind, title: string) => {
    const tot = sumBy(k => k === kind)
    rows.push(mk(title, 'total', tot, kind))
    for (const c of cats.filter(c => c.kind === kind)) rows.push(mk(c.name, 'item', sumBy((k, id) => k === kind && id === c.id), kind))
    return tot
  }
  const inc = block('receita', 'Receita')
  const exp = block('despesa', 'Despesa')
  const before = inc.map((v, i) => v - exp[i])
  rows.push(mk('Saldo antes do investimento', 'saldo', before))
  const inv = block('investimento', 'Investimento')
  rows.push(mk('Saldo final', 'saldo', before.map((v, i) => v - inv[i])))

  const yearRange = { from: `${year}-01-01`, to: `${year}-12-31` }
  return { rows, summary: (methodId?: string) => periodSummary(yearRange, data, { ...opts, methodId }) }
}

/** Cartões e gráficos da aba DASHBOARD. */
export function dashboard(year: number, data: SummaryData, opts: { onlyPaid?: boolean; today: string }) {
  const all = countedIn({ from: `${year}-01-01`, to: `${year}-12-31` }, data, { today: opts.today })
  const ctx = { paid: paidInvoices(data.transactions, data.cards), cards: data.cards, today: opts.today }
  let overdueExpenseCents = 0, overdueIncomeCents = 0, paidInvestCents = 0, paidExpenseCents = 0, paidIncomeCents = 0
  for (const { t } of all) {
    const st = txStatus(t, ctx)
    if (st === 'atrasado' && t.kind === 'despesa') overdueExpenseCents += t.amountCents
    if (st === 'atrasado' && t.kind === 'receita') overdueIncomeCents += t.amountCents
    if (st !== 'pago') continue
    if (t.kind === 'investimento') paidInvestCents += t.amountCents
    if (t.kind === 'despesa') paidExpenseCents += t.amountCents
    if (t.kind === 'receita') paidIncomeCents += t.amountCents
  }
  const months = Array.from({ length: 12 }, (_, i) => {
    const s = periodSummary(monthRange(year, i + 1), data, opts)
    return { incomeCents: s.incomeCents, expenseCents: s.expenseCents, investCents: s.investCents, beforeInvestCents: s.beforeInvestCents, finalCents: s.finalCents }
  })
  return {
    overdueExpenseCents, overdueIncomeCents, paidInvestCents, paidExpenseCents, paidIncomeCents,
    finalCents: paidIncomeCents - paidExpenseCents - paidInvestCents, months,
  }
}
