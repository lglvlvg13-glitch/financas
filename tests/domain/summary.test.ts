import { accountBalanceCents, dueRecurrences, monthSummary } from '../../src/domain/summary'
import type { Account, Category, Recurrence, Transaction } from '../../src/domain/types'

const tx = (over: Partial<Transaction>): Transaction => ({
  id: crypto.randomUUID(), kind: 'despesa', amountCents: 0, date: '2026-11-10', categoryId: 'cat-outros',
  profileId: 'u1', accountId: 'a1', updatedAt: 1, updatedBy: 'u1', ...over,
})

const rec = (over: Partial<Recurrence> = {}): Recurrence => ({
  id: 'r1', updatedAt: 1, updatedBy: 'u1', dayOfMonth: 31, startMonth: '2026-01',
  template: { kind: 'despesa', amountCents: 150000, categoryId: 'cat-moradia', profileId: 'u1', accountId: 'a1' },
  ...over,
})

const cats: Category[] = [
  { id: 'cat-outros', name: 'Outros', kind: 'despesa', updatedAt: 1, updatedBy: 'u1', monthlyBudgetCents: 50000 },
  { id: 'cat-salario', name: 'Salário', kind: 'receita', updatedAt: 1, updatedBy: 'u1' },
]
const acc: Account = { id: 'a1', name: 'Conta', kind: 'corrente', initialBalanceCents: 100000, updatedAt: 1, updatedBy: 'u1' }

test('recorrência gera lançamento no dia certo', () => {
  const out = dueRecurrences([rec()], '2026-02', [])
  expect(out).toHaveLength(1)
  expect(out[0].date).toBe('2026-02-28')
  expect(out[0].recurrenceId).toBe('r1')
  expect(out[0].amountCents).toBe(150000)
})

test('recorrência não duplica', () => {
  expect(dueRecurrences([rec()], '2026-11', [tx({ recurrenceId: 'r1', date: '2026-11-30' })])).toHaveLength(0)
})

test('recorrência gera de novo se o lançamento do mês foi excluído? não — exclusão é decisão do usuário', () => {
  expect(dueRecurrences([rec()], '2026-11', [tx({ recurrenceId: 'r1', date: '2026-11-30', deletedAt: 5 })])).toHaveLength(0)
})

test('recorrência encerrada não gera', () => {
  expect(dueRecurrences([rec({ endMonth: '2026-10' })], '2026-11', [])).toHaveLength(0)
  expect(dueRecurrences([rec({ startMonth: '2026-12' })], '2026-11', [])).toHaveLength(0)
  expect(dueRecurrences([rec({ deletedAt: 3 })], '2026-11', [])).toHaveLength(0)
})

test('pagamento de fatura não conta duas vezes', () => {
  const txs = [
    tx({ accountId: undefined, cardId: 'k1', invoiceMonth: '2026-11', amountCents: 10000 }),
    tx({ amountCents: 10000, categoryId: 'cat-pagamento-fatura', cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' } }),
  ]
  expect(monthSummary('2026-11', { transactions: txs, categories: cats, accounts: [acc] }).expenseCents).toBe(10000)
})

test('parcelas contam a partir do mês da compra', () => {
  const txs = [1, 2, 3].map(n => tx({
    accountId: undefined, cardId: 'k1', date: '2026-11-05', amountCents: 1000,
    installment: { groupId: 'g', n, total: 3 }, invoiceMonth: `2026-${11 + n}`,
  }))
  const data = { transactions: txs, categories: cats, accounts: [acc] }
  expect(monthSummary('2026-11', data).expenseCents).toBe(1000)
  expect(monthSummary('2026-12', data).expenseCents).toBe(1000)
  expect(monthSummary('2027-01', data).expenseCents).toBe(1000)
})

test('resumo por perfil', () => {
  const txs = [tx({ amountCents: 3000 }), tx({ amountCents: 2000, profileId: 'u2' }), tx({ kind: 'receita', categoryId: 'cat-salario', amountCents: 9000 })]
  const data = { transactions: txs, categories: cats, accounts: [acc] }
  const all = monthSummary('2026-11', data)
  expect(all.byProfile.u1.expenseCents).toBe(3000)
  expect(all.byProfile.u2.expenseCents).toBe(2000)
  expect(all.incomeCents).toBe(9000)
  expect(all.balanceCents).toBe(4000)
  expect(monthSummary('2026-11', data, 'u2').expenseCents).toBe(2000)
})

test('orçamento por categoria', () => {
  const s = monthSummary('2026-11', { transactions: [tx({ amountCents: 60000 })], categories: cats, accounts: [acc] })
  expect(s.byCategory).toContainEqual({ categoryId: 'cat-outros', spentCents: 60000, budgetCents: 50000 })
})

test('saldo da conta', () => {
  const txs = [
    tx({ kind: 'receita', amountCents: 50000 }),
    tx({ amountCents: 20000 }),
    tx({ amountCents: 10000, cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' } }),
    tx({ accountId: 'outra', amountCents: 99999 }),
    tx({ amountCents: 77777, deletedAt: 4 }),
  ]
  expect(accountBalanceCents(acc, txs)).toBe(120000)
})
