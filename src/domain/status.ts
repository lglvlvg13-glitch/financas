import { addMonths, clampDay, dayOf, monthOf } from './dates'
import { dueDateFor, invoiceSummary } from './invoice'
import type { Card, Transaction } from './types'

export type TxStatus = 'pago' | 'previsto' | 'atrasado'

/** Data em que o lançamento conta nos totais: parcela n cai n−1 meses depois da compra. */
export function competenceDate(t: Transaction): string {
  if (!t.installment || t.installment.n === 1) return t.date
  return clampDay(addMonths(monthOf(t.date), t.installment.n - 1), dayOf(t.date))
}

const invKey = (cardId: string, month: string) => `${cardId}|${month}`

/** Faturas totalmente pagas ("cartão|mês"). */
export function paidInvoices(txs: Transaction[], cards: Card[]): Set<string> {
  const out = new Set<string>()
  const months = new Map<string, Set<string>>()
  for (const t of txs) {
    if (t.deletedAt || !t.cardId || !t.invoiceMonth || t.cardPayment) continue
    if (!months.has(t.cardId)) months.set(t.cardId, new Set())
    months.get(t.cardId)!.add(t.invoiceMonth)
  }
  for (const card of cards) {
    for (const m of months.get(card.id) ?? []) {
      const s = invoiceSummary(card, m, txs)
      if (s.totalCents > 0 && s.paidCents >= s.totalCents) out.add(invKey(card.id, m))
    }
  }
  return out
}

export interface StatusCtx { paid: Set<string>; cards: Card[]; today: string }

export function txStatus(t: Transaction, ctx: StatusCtx): TxStatus {
  if (t.cardId && t.invoiceMonth && !t.cardPayment) {
    if (ctx.paid.has(invKey(t.cardId, t.invoiceMonth))) return 'pago'
    const card = ctx.cards.find(c => c.id === t.cardId)
    const due = card ? dueDateFor(t.invoiceMonth, card) : t.date
    return due < ctx.today ? 'atrasado' : 'previsto'
  }
  if (!t.pending) return 'pago'
  return t.date < ctx.today ? 'atrasado' : 'previsto'
}
