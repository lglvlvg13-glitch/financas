import { buildInstallments } from '../../src/domain/invoice'
import type { Card } from '../../src/domain/types'

const card: Card = { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 5, dueDay: 15, updatedAt: 1, updatedBy: 'u1' }

test('100,00 em 3x = 33,34 + 33,33 + 33,33', () => {
  const parts = buildInstallments(
    { kind: 'despesa', amountCents: 10000, date: '2026-11-03', categoryId: 'cat-outros', profileId: 'u1', cardId: 'k1' },
    card, 3, 'g1',
  )
  expect(parts.map(p => p.amountCents)).toEqual([3334, 3333, 3333])
  expect(parts.map(p => p.invoiceMonth)).toEqual(['2026-11', '2026-12', '2027-01'])
  expect(parts.map(p => p.installment)).toEqual([
    { groupId: 'g1', n: 1, total: 3 }, { groupId: 'g1', n: 2, total: 3 }, { groupId: 'g1', n: 3, total: 3 },
  ])
  expect(parts.every(p => p.date === '2026-11-03')).toBe(true)
})

test('à vista gera um lançamento sem parcela', () => {
  const parts = buildInstallments(
    { kind: 'despesa', amountCents: 5000, date: '2026-11-05', categoryId: 'cat-outros', profileId: 'u1', cardId: 'k1' },
    card, 1, 'g2',
  )
  expect(parts).toHaveLength(1)
  expect(parts[0].installment).toBeUndefined()
  expect(parts[0].invoiceMonth).toBe('2026-12')
})
