import { addMonths, clampDay, dayOf, lastDayOfMonth, monthOf } from './dates'
import { splitCents } from './money'
import type { Card, Meta, Transaction, TransactionDraft } from './types'

/** Mês (YYYY-MM) em que fecha a fatura de uma compra feita em `purchaseDate`. */
export function invoiceMonthFor(purchaseDate: string, closingDay: number): string {
  const m = monthOf(purchaseDate)
  const effective = Math.min(closingDay, lastDayOfMonth(m))
  return dayOf(purchaseDate) >= effective ? addMonths(m, 1) : m
}

/** Vencimento da fatura que fecha em `invoiceMonth`. */
export function dueDateFor(invoiceMonth: string, card: Pick<Card, 'closingDay' | 'dueDay'>): string {
  const m = card.dueDay > card.closingDay ? invoiceMonth : addMonths(invoiceMonth, 1)
  return clampDay(m, card.dueDay)
}

type PurchaseBase = Omit<Transaction, keyof Meta | 'installment' | 'invoiceMonth'> & { cardId: string }

/** Gera as parcelas de uma compra no cartão (1 = à vista, sem campo installment). */
export function buildInstallments(base: PurchaseBase, card: Card, count: number, groupId: string): TransactionDraft[] {
  const first = invoiceMonthFor(base.date, card.closingDay)
  return splitCents(base.amountCents, count).map((amountCents, i) => ({
    ...base,
    amountCents,
    invoiceMonth: addMonths(first, i),
    ...(count > 1 ? { installment: { groupId, n: i + 1, total: count } } : {}),
  }))
}

const live = (t: Transaction) => !t.deletedAt

export function invoiceSummary(card: Card, month: string, txs: Transaction[]) {
  const items = txs.filter(t => live(t) && t.cardId === card.id && t.invoiceMonth === month)
  const paidCents = txs
    .filter(t => live(t) && t.cardPayment?.cardId === card.id && t.cardPayment.invoiceMonth === month)
    .reduce((s, t) => s + t.amountCents, 0)
  return {
    totalCents: items.reduce((s, t) => s + t.amountCents, 0),
    paidCents,
    dueDate: dueDateFor(month, card),
    items,
  }
}

/** Compras (todas as parcelas) menos pagamentos do cartão. */
export function limitUsedCents(card: Card, txs: Transaction[]): number {
  let used = 0
  for (const t of txs) {
    if (!live(t)) continue
    if (t.cardId === card.id) used += t.amountCents
    if (t.cardPayment?.cardId === card.id) used -= t.amountCents
  }
  return Math.max(0, used)
}
