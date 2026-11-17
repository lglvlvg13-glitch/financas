import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import { today, monthOf, addMonths } from '../../src/domain/dates'
import type { Account, Transaction } from '../../src/domain/types'

const D = today()

async function seed(repo: Awaited<ReturnType<typeof setup>>['repo']) {
  await repo.put<Account>('accounts', { id: 'a1', name: 'Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  const t = (o: Partial<Transaction>) => repo.put<Transaction>('transactions', { kind: 'despesa', amountCents: 1000, date: D, categoryId: 'cat-alimentacao', profileId: 'u1', accountId: 'a1', ...o } as Transaction, 'u1')
  await t({ note: 'Padaria Pão Quente', amountCents: 1250, item: 'Lanches e cafés' })
  await t({ note: 'Padaria Pão Quente', amountCents: 1380, item: 'Lanches e cafés', date: `${addMonths(monthOf(D), -2)}-10` })
  await t({ note: 'Posto Shell', categoryId: 'cat-transporte', amountCents: 25000 })
}

test('categorias mais usadas aparecem primeiro e o último valor é sugerido', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: 'Novo lançamento' }))
  const dlg = await screen.findByRole('dialog')
  const cat = within(dlg).getByLabelText('Categoria')
  const groups = await within(cat).findAllByRole('group')
  expect(groups[0]).toHaveAttribute('label', 'Mais usadas')
  expect(within(groups[0]).getAllByRole('option')[0]).toHaveTextContent('Alimentação')
  await s.user.selectOptions(cat, 'cat-alimentacao')
  await s.user.selectOptions(within(dlg).getByLabelText('Item'), 'Lanches e cafés')
  await s.user.click(within(dlg).getByRole('button', { name: /Usar R\$ 12,50/ }))
  expect(within(dlg).getByLabelText('Valor (R$)')).toHaveValue('12,50')
})

test('busca em todos os meses por texto, com total', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.type(await screen.findByLabelText('Buscar'), 'padaria')
  await waitFor(() => expect(screen.getAllByRole('listitem', { name: /Padaria/ })).toHaveLength(2))
  expect(screen.getByText(/2 lançamentos encontrados.*R\$ 26,30/)).toBeInTheDocument()
})

test('filtro por categoria e por conta', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: 'Filtros' }))
  await s.user.selectOptions(await screen.findByLabelText('Filtrar categoria'), 'cat-transporte')
  await waitFor(() => expect(screen.getAllByRole('listitem', { name: /Transporte/ })).toHaveLength(1))
  expect(screen.queryByRole('listitem', { name: /Padaria/ })).toBeNull()
})
