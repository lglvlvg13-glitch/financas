import { screen, within } from '@testing-library/react'
import { setup } from './helpers'
import { today } from '../../src/domain/dates'
import type { Account, Category, Transaction } from '../../src/domain/types'

const D = today()

async function seed(repo: Awaited<ReturnType<typeof setup>>['repo']) {
  await repo.put<Account>('accounts', { id: 'a1', name: 'Conta', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  const tx = (t: Partial<Transaction>) => repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 0, date: D, categoryId: 'cat-outros', profileId: 'u1', accountId: 'a1', ...t,
  } as Transaction, 'u1')
  await tx({ kind: 'receita', amountCents: 500000, categoryId: 'cat-salario', profileId: 'u1' })
  await tx({ kind: 'receita', amountCents: 300000, categoryId: 'cat-salario', profileId: 'u2' })
  await tx({ amountCents: 120000, categoryId: 'cat-alimentacao', profileId: 'u1' })
  await tx({ amountCents: 80000, categoryId: 'cat-alimentacao', profileId: 'u2' })
}

test('mostra sobra do mês', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  const sobra = await screen.findByRole('group', { name: 'Sobra do mês' })
  expect(await within(sobra).findByText('R$ 6.000,00')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Entradas' })).getByText('R$ 8.000,00')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Saídas' })).getByText('R$ 2.000,00')).toBeInTheDocument()
})

test('categoria acima do orçamento fica destacada', async () => {
  const s = await setup({ ready: true })
  const cat = await s.repo.get<Category>('categories', 'cat-alimentacao')
  await s.repo.put<Category>('categories', { ...cat!, monthlyBudgetCents: 150000 }, 'u1')
  await seed(s.repo)
  const row = await screen.findByRole('listitem', { name: 'Alimentação' })
  expect(await within(row).findByText('Acima do orçamento em R$ 500,00')).toBeInTheDocument()
  expect(row.querySelector('.bar')).toHaveClass('over')
})

test('filtro por perfil muda os totais', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await within(await screen.findByRole('group', { name: 'Sobra do mês' })).findByText('R$ 6.000,00')
  await s.user.click(within(screen.getByRole('group', { name: 'Ver de quem' })).getByRole('button', { name: 'Usuário 2' }))
  expect(await within(screen.getByRole('group', { name: 'Sobra do mês' })).findByText('R$ 2.200,00')).toBeInTheDocument()
})
