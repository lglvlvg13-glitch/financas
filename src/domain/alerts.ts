import { addDays, proratedBudget, type SummaryData } from './period'
import { addMonths, lastDayOfMonth, monthOf } from './dates'
import { dueDateFor, invoiceSummary } from './invoice'
import { formatBRL } from './money'
import { competenceDate } from './status'

export interface Due { id: string; label: string; date: string; cents: number; kind: 'pagar' | 'receber'; overdue?: boolean }

/** Contas a pagar/receber e faturas abertas que vencem até `days` dias, mais as já vencidas e não pagas. */
export function upcoming(data: SummaryData, today: string, days = 7): Due[] {
  const until = addDays(today, days)
  const out: Due[] = []
  for (const t of data.transactions) {
    if (t.deletedAt || !t.pending || t.cardId || t.cardPayment) continue
    if (t.date > until) continue
    out.push({ id: t.id, label: t.note ?? t.item ?? 'Conta', date: t.date, cents: t.amountCents, kind: t.kind === 'receita' ? 'receber' : 'pagar', ...(t.date < today ? { overdue: true } : {}) })
  }
  for (const card of data.cards) {
    if (card.deletedAt) continue
    for (let m = addMonths(monthOf(today), -12); m <= addMonths(monthOf(until), 1); m = addMonths(m, 1)) {
      const due = dueDateFor(m, card)
      if (due > until) continue
      const s = invoiceSummary(card, m, data.transactions)
      const open = s.totalCents - s.paidCents
      if (open > 0) out.push({ id: `${card.id}|${m}`, label: `Fatura ${card.name}`, date: due, cents: open, kind: 'pagar', ...(due < today ? { overdue: true } : {}) })
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || b.cents - a.cents)
}

export interface BudgetAlert { categoryId: string; name: string; spentCents: number; budgetCents: number; pct: number }

/** Categorias que já usaram 80% ou mais do orçamento do mês (conta tudo, pago ou previsto). */
export function budgetAlerts(data: SummaryData, month: string, _today: string, threshold = 80): BudgetAlert[] {
  const range = { from: `${month}-01`, to: `${month}-${String(lastDayOfMonth(month)).padStart(2, '0')}` }
  const out: BudgetAlert[] = []
  for (const c of data.categories) {
    if (c.deletedAt || c.kind !== 'despesa' || !c.monthlyBudgetCents) continue
    const spent = data.transactions
      .filter(t => !t.deletedAt && !t.cardPayment && t.kind === 'despesa' && t.categoryId === c.id)
      .filter(t => { const d = competenceDate(t); return d >= range.from && d <= range.to })
      .reduce((s, t) => s + t.amountCents, 0)
    const budget = proratedBudget(c.monthlyBudgetCents, range)
    const pct = Math.round((spent / budget) * 100)
    if (pct >= threshold) out.push({ categoryId: c.id, name: c.name, spentCents: spent, budgetCents: budget, pct })
  }
  return out.sort((a, b) => b.pct - a.pct)
}

/** Arquivo .ics para adicionar os vencimentos ao calendário do celular, com lembrete às 9h da véspera. */
export function toIcs(items: Due[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')
  const esc = (s: string) => s.replace(/[\\;,]/g, m => `\\${m}`).replace(/\r?\n/g, '\\n')
  const ev = items.filter(d => !d.overdue).map(d => [
    'BEGIN:VEVENT',
    `UID:${esc(d.id)}-${d.date}@financas-da-familia`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d.date.replace(/-/g, '')}`,
    `DTEND;VALUE=DATE:${addDays(d.date, 1).replace(/-/g, '')}`,
    `SUMMARY:${esc(`${d.kind === 'pagar' ? 'Pagar' : 'Receber'} ${d.label} — ${formatBRL(d.cents)}`)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Vencimento amanhã', 'TRIGGER:-PT15H', 'END:VALARM',
    'END:VEVENT',
  ].join('\r\n'))
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Financas da Familia//PT-BR', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n')
}
