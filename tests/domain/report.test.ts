import { yearReport, dashboard } from '../../src/domain/report'
import { toCsv } from '../../src/domain/csv'
import type { Category, Transaction } from '../../src/domain/types'

const meta = { updatedAt: 1, updatedBy: 'u1' as const }
const cats: Category[] = [
  { id: 'cat-sal', name: 'Salário', kind: 'receita', ...meta },
  { id: 'cat-mor', name: 'Moradia', kind: 'despesa', ...meta },
  { id: 'cat-cx', name: 'Caixinha', kind: 'investimento', ...meta },
]
const tx = (o: Partial<Transaction>): Transaction =>
  ({ id: Math.random().toString(), kind: 'despesa', amountCents: 0, date: '2026-01-05', categoryId: 'cat-mor', profileId: 'u1', accountId: 'a1', ...meta, ...o }) as Transaction
const txs = [
  tx({ kind: 'receita', amountCents: 500000, categoryId: 'cat-sal' }),
  tx({ amountCents: 200000 }),
  tx({ amountCents: 100000, date: '2026-03-05', pending: true }),
  tx({ kind: 'investimento', amountCents: 50000, categoryId: 'cat-cx', date: '2026-03-01' }),
]
const data = { transactions: txs, categories: cats, cards: [] }

test('relatório do ano: linhas por tipo e categoria, 12 meses e total', () => {
  const r = yearReport(2026, data, { today: '2026-11-16' })
  const row = (label: string) => r.rows.find(x => x.label === label)!
  expect(row('Receita').values[0]).toBe(500000)
  expect(row('Moradia').values[2]).toBe(100000)
  expect(row('Moradia').total).toBe(300000)
  expect(row('Saldo antes do investimento').values[0]).toBe(300000)
  expect(row('Saldo final').values[2]).toBe(-150000)
  expect(row('Saldo final').total).toBe(150000)
})

test('painel: atrasados e pagos do ano', () => {
  const d = dashboard(2026, data, { today: '2026-11-16' })
  expect(d.overdueExpenseCents).toBe(100000)
  expect(d.overdueIncomeCents).toBe(0)
  expect(d.paidInvestCents).toBe(50000)
  expect(d.paidExpenseCents).toBe(200000)
  expect(d.paidIncomeCents).toBe(500000)
  expect(d.finalCents).toBe(250000)
  expect(d.months).toHaveLength(12)
})

test('csv em pt-BR abre certo no Excel', () => {
  const csv = toCsv([['Valor', 'Descrição'], [123456, 'Mercado; feira']])
  expect(csv.startsWith('﻿')).toBe(true)
  expect(csv).toContain('Valor;Descrição')
  expect(csv).toContain('1234,56;"Mercado; feira"')
})
