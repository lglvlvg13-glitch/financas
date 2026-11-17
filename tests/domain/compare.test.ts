import { comparePeriods } from '../../src/domain/compare'
import type { Category, Transaction } from '../../src/domain/types'

const meta = { updatedAt: 1, updatedBy: 'u1' as const }
const cats: Category[] = [{ id: 'cat-lazer', name: 'Lazer', kind: 'despesa', ...meta }]
const tx = (date: string, amountCents: number): Transaction =>
  ({ id: Math.random().toString(), kind: 'despesa', amountCents, date, categoryId: 'cat-lazer', profileId: 'u1', accountId: 'a1', ...meta }) as Transaction

test('compara com o período anterior e com a média dos 6 anteriores', () => {
  const txs = [
    tx('2026-05-10', 30000), tx('2026-06-10', 30000), tx('2026-07-10', 40000),
    tx('2026-08-10', 40000), tx('2026-09-10', 30000), tx('2026-10-10', 40000),
    tx('2026-11-10', 52000),
  ]
  const c = comparePeriods('mes', '2026-11-16', { transactions: txs, categories: cats, cards: [] }, { today: '2026-11-16' })
  expect(c.totals.expense).toEqual({ current: 52000, previous: 40000, average: 35000 })
  const lazer = c.byCategory.get('cat-lazer')!
  expect(lazer.previous).toBe(40000)
  expect(lazer.average).toBe(35000)
  expect(Math.round(lazer.vsAveragePct!)).toBe(49)
})

test('sem histórico não inventa comparação', () => {
  const c = comparePeriods('mes', '2026-11-16', { transactions: [tx('2026-11-10', 1000)], categories: cats, cards: [] }, { today: '2026-11-16' })
  expect(c.byCategory.get('cat-lazer')!.vsAveragePct).toBeUndefined()
})
