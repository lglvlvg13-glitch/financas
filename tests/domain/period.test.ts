import { periodRange, shiftPeriod, periodSummary } from '../../src/domain/period'
import { METHODS } from '../../src/domain/methods'
import type { Category, Transaction } from '../../src/domain/types'

const meta = { updatedAt: 1, updatedBy: 'u1' as const }

test('faixas de período', () => {
  expect(periodRange('dia', '2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-16' })
  expect(periodRange('semana', '2026-11-18')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
  expect(periodRange('semana', '2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
  expect(periodRange('mes', '2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  expect(periodRange('trimestre', '2026-11-16')).toEqual({ from: '2026-10-01', to: '2026-12-31' })
  expect(periodRange('semestre', '2026-03-01')).toEqual({ from: '2026-01-01', to: '2026-06-30' })
  expect(periodRange('ano', '2026-07-01')).toEqual({ from: '2026-01-01', to: '2026-12-31' })
})

test('navegar entre períodos', () => {
  expect(shiftPeriod('semana', '2026-11-18', 1)).toBe('2026-11-25')
  expect(shiftPeriod('mes', '2026-01-31', 1)).toBe('2026-02-28')
  expect(shiftPeriod('trimestre', '2026-11-16', -1)).toBe('2026-08-16')
  expect(shiftPeriod('ano', '2026-11-16', 1)).toBe('2027-11-16')
  expect(shiftPeriod('dia', '2026-12-31', 1)).toBe('2027-01-01')
})

test('as 17 variações do método da planilha', () => {
  expect(METHODS).toHaveLength(17)
  for (const m of METHODS) expect(m.need + m.want + m.invest).toBe(100)
  expect(METHODS.find(m => m.label.startsWith('80/20'))).toMatchObject({ need: 80, want: 0, invest: 20 })
})

const cats: Category[] = [
  { id: 'cat-moradia', name: 'Moradia', kind: 'despesa', group: 'necessidade', monthlyBudgetCents: 300000, ...meta },
  { id: 'cat-lazer', name: 'Lazer', kind: 'despesa', group: 'desejo', ...meta },
  { id: 'cat-nova', name: 'Nova', kind: 'despesa', ...meta },
  { id: 'cat-sal', name: 'Salário', kind: 'receita', ...meta },
  { id: 'cat-cx', name: 'Caixinha', kind: 'investimento', ...meta },
]
const tx = (o: Partial<Transaction>): Transaction =>
  ({ id: Math.random().toString(), kind: 'despesa', amountCents: 0, date: '2026-11-05', categoryId: 'cat-moradia', profileId: 'u1', accountId: 'a1', ...meta, ...o }) as Transaction
const txs = [
  tx({ kind: 'receita', amountCents: 1000000, categoryId: 'cat-sal' }),
  tx({ amountCents: 300000 }),
  tx({ amountCents: 100000, categoryId: 'cat-lazer', profileId: 'u2' }),
  tx({ amountCents: 50000, categoryId: 'cat-nova', pending: true, date: '2026-11-25' }),
  tx({ kind: 'investimento', amountCents: 200000, categoryId: 'cat-cx' }),
  tx({ amountCents: 999, date: '2026-12-01' }),
]
const data = { transactions: txs, categories: cats, cards: [] }

test('totais do mês com investimentos e dois saldos', () => {
  const s = periodSummary({ from: '2026-11-01', to: '2026-11-30' }, data, { today: '2026-11-16' })
  expect(s.incomeCents).toBe(1000000)
  expect(s.expenseCents).toBe(450000)
  expect(s.investCents).toBe(200000)
  expect(s.beforeInvestCents).toBe(550000)
  expect(s.finalCents).toBe(350000)
  expect(s.byProfile.u2.expenseCents).toBe(100000)
})

test('só pagos tira o previsto de tudo', () => {
  const s = periodSummary({ from: '2026-11-01', to: '2026-11-30' }, data, { today: '2026-11-16', onlyPaid: true })
  expect(s.expenseCents).toBe(400000)
  expect(s.method.buckets.find(b => b.key === 'want')!.realCents).toBe(100000)
})

test('50/30/20: categoria sem grupo conta como desejo; dentro/fora', () => {
  const s = periodSummary({ from: '2026-11-01', to: '2026-11-30' }, data, { today: '2026-11-16', methodId: METHODS[0].id })
  const [need, want, inv] = s.method.buckets
  expect(need).toMatchObject({ plannedCents: 500000, realCents: 300000, inside: true })
  expect(want).toMatchObject({ plannedCents: 300000, realCents: 150000, inside: true })
  expect(inv).toMatchObject({ plannedCents: 200000, realCents: 200000, inside: true })
})

test('orçamento proporcional aos dias do período, cruzando meses', () => {
  const s = periodSummary({ from: '2026-11-16', to: '2026-12-15' }, data, { today: '2026-11-16' })
  const mor = s.byCategory.find(c => c.categoryId === 'cat-moradia')!
  // 15/30 de novembro + 15/31 de dezembro de R$ 3.000
  expect(mor.budgetCents).toBe(Math.round(300000 * 15 / 30) + Math.round(300000 * 15 / 31))
})

test('série por dia na semana e por mês no ano', () => {
  const w = periodSummary({ from: '2026-11-02', to: '2026-11-08' }, data, { today: '2026-11-16' })
  expect(w.series.unit).toBe('dia')
  expect(w.series.points).toHaveLength(7)
  expect(w.series.points.find(p => p.key === '2026-11-05')!.incomeCents).toBe(1000000)
  const y = periodSummary({ from: '2026-01-01', to: '2026-12-31' }, data, { today: '2026-11-16' })
  expect(y.series.unit).toBe('mes')
  expect(y.series.points).toHaveLength(12)
  expect(y.series.points[11].expenseCents).toBe(999)
})

import { DEFAULT_CATEGORIES } from '../../src/domain/defaults'
test('categorias padrão = planilha: 15 despesas, Lazer/Vestuário/Família = desejo', () => {
  const desp = DEFAULT_CATEGORIES.filter(c => c.kind === 'despesa' && !c.system)
  expect(desp).toHaveLength(15)
  expect(desp.filter(c => c.group === 'desejo').map(c => c.name)).toEqual(['Lazer e entretenimento', 'Vestuário', 'Família e social'])
  expect(DEFAULT_CATEGORIES.filter(c => c.kind === 'investimento')).toHaveLength(4)
})
