import { upcoming, budgetAlerts, toIcs } from '../../src/domain/alerts'
import type { Card, Category, Transaction } from '../../src/domain/types'

const meta = { updatedAt: 1, updatedBy: 'u1' as const }
const tx = (o: Partial<Transaction>): Transaction =>
  ({ id: Math.random().toString(), kind: 'despesa', amountCents: 1000, date: '2026-11-18', categoryId: 'cat-ali', profileId: 'u1', accountId: 'a1', ...meta, ...o }) as Transaction
const card: Card = { id: 'k1', name: 'Nubank', limitCents: 1, closingDay: 28, dueDay: 5, ...meta }
const cats: Category[] = [{ id: 'cat-ali', name: 'Alimentação', kind: 'despesa', monthlyBudgetCents: 100000, ...meta }]

test('próximos vencimentos: contas a pagar e faturas, em ordem, só os não pagos dentro do prazo', () => {
  const txs = [
    tx({ pending: true, note: 'Energia', amountCents: 28740, date: '2026-11-18' }),
    tx({ pending: true, note: 'Escola', date: '2026-12-30' }),                 // fora do prazo
    tx({ note: 'Paga', date: '2026-11-17' }),                                 // já paga
    tx({ pending: true, kind: 'receita', note: 'Salário', date: '2026-11-20', amountCents: 500000 }),
    tx({ accountId: undefined, cardId: 'k1', invoiceMonth: '2026-11', amountCents: 50000, date: '2026-11-10' }),
  ]
  const u = upcoming({ transactions: txs, categories: cats, cards: [card] }, '2026-11-16', 30)
  expect(u.map(x => [x.label, x.date, x.cents, x.kind])).toEqual([
    ['Energia', '2026-11-18', 28740, 'pagar'],
    ['Salário', '2026-11-20', 500000, 'receber'],
    ['Fatura Nubank', '2026-12-05', 50000, 'pagar'],
  ])
})

test('alerta quando a categoria passa de 80% do orçamento do mês', () => {
  const txs = [tx({ amountCents: 85000, date: '2026-11-05' })]
  expect(budgetAlerts({ transactions: txs, categories: cats, cards: [] }, '2026-11', '2026-11-16'))
    .toEqual([{ categoryId: 'cat-ali', name: 'Alimentação', spentCents: 85000, budgetCents: 100000, pct: 85 }])
  expect(budgetAlerts({ transactions: [tx({ amountCents: 70000 })], categories: cats, cards: [] }, '2026-11', '2026-11-16')).toEqual([])
})

test('arquivo de calendário com lembrete na véspera', () => {
  const ics = toIcs([{ label: 'Energia', date: '2026-11-18', cents: 28740, kind: 'pagar', id: 'x' }])
  expect(ics).toContain('BEGIN:VCALENDAR')
  expect(ics).toContain('DTSTART;VALUE=DATE:20261118')
  expect(ics).toContain('SUMMARY:Pagar Energia — R$ 287\\,40')
  expect(ics).toContain('TRIGGER:-PT15H')
})

test('conta vencida e não paga continua na lista, marcada como atrasada', () => {
  const u = upcoming({ transactions: [tx({ pending: true, note: 'Energia', date: '2026-11-10' })], categories: cats, cards: [] }, '2026-11-16', 7)
  expect(u).toEqual([expect.objectContaining({ label: 'Energia', overdue: true })])
})

test('calendário escapa barra e quebra de linha', () => {
  const ics = toIcs([{ label: 'A\\B\nC', date: '2026-11-18', cents: 100, kind: 'pagar', id: 'x' }])
  expect(ics).toContain('A\\\\B\\nC')
})
