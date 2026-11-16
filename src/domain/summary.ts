import { addMonths, clampDay, monthOf } from './dates'
import type { Account, Category, ProfileId, Recurrence, Transaction, TransactionDraft } from './types'

/** Lançamentos recorrentes que ainda faltam gerar no mês. */
export function dueRecurrences(recs: Recurrence[], month: string, existing: Transaction[]): TransactionDraft[] {
  const out: TransactionDraft[] = []
  for (const r of recs) {
    if (r.deletedAt || month < r.startMonth || (r.endMonth && month > r.endMonth)) continue
    // Qualquer lançamento do mês com esta recorrência (mesmo excluído) já conta: excluir foi decisão do usuário.
    if (existing.some(t => t.recurrenceId === r.id && monthOf(t.date) === month)) continue
    out.push({ ...r.template, date: clampDay(month, r.dayOfMonth), recurrenceId: r.id, pending: true })
  }
  return out
}

/** Mês em que o lançamento conta no resumo (competência). */
export function competenceMonth(t: Transaction): string {
  const m = monthOf(t.date)
  return t.installment ? addMonths(m, t.installment.n - 1) : m
}

interface SummaryData { transactions: Transaction[]; categories: Category[]; accounts: Account[] }

export function monthSummary(month: string, data: SummaryData, profile?: ProfileId) {
  const txs = data.transactions.filter(t =>
    !t.deletedAt && !t.cardPayment && competenceMonth(t) === month && (!profile || t.profileId === profile))

  const byProfile: Record<ProfileId, { incomeCents: number; expenseCents: number }> = {
    u1: { incomeCents: 0, expenseCents: 0 },
    u2: { incomeCents: 0, expenseCents: 0 },
  }
  const spent = new Map<string, number>()
  let incomeCents = 0, expenseCents = 0
  for (const t of txs) {
    if (t.kind === 'receita') {
      incomeCents += t.amountCents
      byProfile[t.profileId].incomeCents += t.amountCents
    } else {
      expenseCents += t.amountCents
      byProfile[t.profileId].expenseCents += t.amountCents
      spent.set(t.categoryId, (spent.get(t.categoryId) ?? 0) + t.amountCents)
    }
  }

  const byCategory = data.categories
    .filter(c => !c.deletedAt && c.kind === 'despesa' && (spent.has(c.id) || c.monthlyBudgetCents))
    .map(c => ({
      categoryId: c.id,
      spentCents: spent.get(c.id) ?? 0,
      ...(c.monthlyBudgetCents ? { budgetCents: c.monthlyBudgetCents } : {}),
    }))
    .sort((a, b) => b.spentCents - a.spentCents)

  return { incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, byCategory, byProfile }
}

/** Saldo inicial + receitas − despesas e investimentos já pagos na conta (inclui pagamentos de fatura). */
export function accountBalanceCents(account: Account, txs: Transaction[]): number {
  return txs
    .filter(t => !t.deletedAt && !t.pending && t.accountId === account.id)
    .reduce((s, t) => s + (t.kind === 'receita' ? t.amountCents : -t.amountCents), account.initialBalanceCents)
}
