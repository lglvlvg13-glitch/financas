import { competenceDate, paidInvoices, txStatus } from '../../src/domain/status'
import type { Card, Transaction } from '../../src/domain/types'

const meta = { updatedAt: 1, updatedBy: 'u1' as const }
const card: Card = { id: 'k1', name: 'Visa', limitCents: 100000, closingDay: 5, dueDay: 15, ...meta }
const t = (o: Partial<Transaction>): Transaction =>
  ({ id: Math.random().toString(), kind: 'despesa', amountCents: 1000, date: '2026-11-10', categoryId: 'c', profileId: 'u1', accountId: 'a1', ...meta, ...o }) as Transaction

test('lançamento antigo (sem pending) é pago', () => {
  expect(txStatus(t({}), { paid: new Set(), cards: [card], today: '2026-11-16' })).toBe('pago')
})

test('pendente vence no futuro = previsto; venceu = atrasado', () => {
  const ctx = { paid: new Set<string>(), cards: [card], today: '2026-11-16' }
  expect(txStatus(t({ pending: true, date: '2026-11-20' }), ctx)).toBe('previsto')
  expect(txStatus(t({ pending: true, date: '2026-11-16' }), ctx)).toBe('previsto')
  expect(txStatus(t({ pending: true, date: '2026-11-15' }), ctx)).toBe('atrasado')
})

test('compra no cartão é paga quando a fatura do mês dela é paga', () => {
  const buy = t({ accountId: undefined, cardId: 'k1', invoiceMonth: '2026-12' })
  const pay = t({ categoryId: 'cat-pagamento-fatura', cardPayment: { cardId: 'k1', invoiceMonth: '2026-12' }, amountCents: 1000 })
  expect(txStatus(buy, { paid: paidInvoices([buy], [card]), cards: [card], today: '2026-11-16' })).toBe('previsto')
  expect(txStatus(buy, { paid: paidInvoices([buy], [card]), cards: [card], today: '2026-12-16' })).toBe('atrasado')
  expect(txStatus(buy, { paid: paidInvoices([buy, pay], [card]), cards: [card], today: '2026-12-16' })).toBe('pago')
})

test('parcela n conta no mês da compra + (n−1), mesmo dia limitado ao fim do mês', () => {
  expect(competenceDate(t({ date: '2026-01-31', installment: { groupId: 'g', n: 2, total: 3 } }))).toBe('2026-02-28')
  expect(competenceDate(t({ date: '2026-01-31' }))).toBe('2026-01-31')
})
