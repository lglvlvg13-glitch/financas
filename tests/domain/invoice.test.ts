import { dueDateFor, invoiceMonthFor, invoiceSummary, limitUsedCents, buildInstallments } from '../../src/domain/invoice'
import type { Card, Transaction } from '../../src/domain/types'

const card: Card = { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 5, dueDay: 15, updatedAt: 1, updatedBy: 'u1' }

const tx = (over: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(), kind: 'despesa', amountCents: 0, date: '2026-11-01', categoryId: 'cat-outros',
  profileId: 'u1', updatedAt: 1, updatedBy: 'u1', ...over,
})

test('compra antes do fechamento fica no mês', () => {
  expect(invoiceMonthFor('2026-11-03', 5)).toBe('2026-11')
})

test('compra no dia do fechamento vai para o mês seguinte', () => {
  expect(invoiceMonthFor('2026-11-05', 5)).toBe('2026-12')
})

test('fechamento 31 em fevereiro usa dia 28', () => {
  expect(invoiceMonthFor('2026-02-28', 31)).toBe('2026-03')
  expect(invoiceMonthFor('2026-02-27', 31)).toBe('2026-02')
})

test('vencimento no mesmo mês ou no seguinte', () => {
  expect(dueDateFor('2026-11', card)).toBe('2026-11-15')
  expect(dueDateFor('2026-11', { ...card, closingDay: 28, dueDay: 5 })).toBe('2026-12-05')
})

test('fatura soma compras do mês e desconta pagamentos', () => {
  const txs = [
    tx({ cardId: 'k1', invoiceMonth: '2026-11', amountCents: 5000 }),
    tx({ cardId: 'k1', invoiceMonth: '2026-11', amountCents: 2500 }),
    tx({ cardId: 'k1', invoiceMonth: '2026-12', amountCents: 9999 }),
    tx({ accountId: 'a1', amountCents: 7500, cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' } }),
  ]
  const s = invoiceSummary(card, '2026-11', txs)
  expect(s.totalCents).toBe(7500)
  expect(s.paidCents).toBe(7500)
  expect(s.dueDate).toBe('2026-11-15')
  expect(s.items).toHaveLength(2)
})

test('limite usado inclui parcelas futuras', () => {
  const parts = buildInstallments(
    { kind: 'despesa', amountCents: 30000, date: '2026-11-03', categoryId: 'cat-outros', profileId: 'u1', cardId: 'k1' },
    card, 3, 'g1',
  ).map(p => tx(p))
  expect(limitUsedCents(card, parts)).toBe(30000)
  const paid = [...parts, tx({ accountId: 'a1', amountCents: 10000, cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' } })]
  expect(limitUsedCents(card, paid)).toBe(20000)
})

test('lançamentos excluídos não entram na fatura', () => {
  const txs = [tx({ cardId: 'k1', invoiceMonth: '2026-11', amountCents: 5000, deletedAt: 9 })]
  expect(invoiceSummary(card, '2026-11', txs).totalCents).toBe(0)
  expect(limitUsedCents(card, txs)).toBe(0)
})
