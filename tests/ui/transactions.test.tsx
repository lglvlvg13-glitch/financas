import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import { today, monthOf } from '../../src/domain/dates'
import { buildInstallments } from '../../src/domain/invoice'
import type { Account, Card, Recurrence, Transaction } from '../../src/domain/types'

const D = today()

async function withAccountAndCard(repo: Awaited<ReturnType<typeof setup>>['repo']) {
  const acc = await repo.put<Account>('accounts', { id: 'a1', name: 'Conta Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  const card = await repo.put<Card>('cards', { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 40 > 31 ? 31 : 31, dueDay: 10 }, 'u1')
  return { acc, card }
}

async function openNew(user: Awaited<ReturnType<typeof setup>>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await user.click(await screen.findByRole('button', { name: 'Novo lançamento' }))
  return screen.findByRole('dialog')
}

test('valor inválido bloqueia o salvar', async () => {
  const s = await setup({ ready: true })
  await withAccountAndCard(s.repo)
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), 'abc')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  expect(await within(dlg).findByText('Valor inválido')).toBeInTheDocument()
  expect(await s.repo.list('transactions')).toHaveLength(0)
})

test('compra 3x no cartão cria 3 lançamentos', async () => {
  const s = await setup({ ready: true })
  await withAccountAndCard(s.repo)
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '300,00')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-lazer')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'c:k1')
  await s.user.selectOptions(await within(dlg).findByLabelText('Parcelas'), '3')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(3))
  const txs = await s.repo.list<Transaction>('transactions')
  expect(txs.map(t => t.amountCents)).toEqual([10000, 10000, 10000])
})

test('lançamento recebe o perfil do aparelho', async () => {
  const s = await setup({ ready: true })
  await withAccountAndCard(s.repo)
  await s.repo.setDevice({ profileId: 'u2' })
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '12,50')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-alimentacao')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(1))
  const [t] = await s.repo.list<Transaction>('transactions')
  expect(t.profileId).toBe('u2')
  expect(t.amountCents).toBe(1250)
})

test('editar lançamento altera valor e categoria', async () => {
  const s = await setup({ ready: true })
  await withAccountAndCard(s.repo)
  const t = await s.repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 5000, date: D, categoryId: 'cat-outros', profileId: 'u1', accountId: 'a1',
  }, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: /Outros/ }))
  const dlg = await screen.findByRole('dialog')
  const valor = within(dlg).getByLabelText('Valor (R$)')
  await s.user.clear(valor)
  await s.user.type(valor, '70,00')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-lazer')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.get<Transaction>('transactions', t.id))?.amountCents).toBe(7000))
  expect((await s.repo.get<Transaction>('transactions', t.id))?.categoryId).toBe('cat-lazer')
  expect(await s.repo.list('transactions')).toHaveLength(1)
})

test('excluir pede confirmação e Desfazer restaura', async () => {
  const s = await setup({ ready: true })
  await withAccountAndCard(s.repo)
  await s.repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 5000, date: D, categoryId: 'cat-outros', profileId: 'u1', accountId: 'a1',
  }, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: /Outros/ }))
  await s.user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }))
  const confirm = await screen.findByRole('alertdialog')
  expect(within(confirm).getByText('Excluir este lançamento?')).toBeInTheDocument()
  await s.user.click(within(confirm).getByRole('button', { name: 'Excluir' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(0))
  await s.user.click(await screen.findByRole('button', { name: 'Desfazer' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(1))
})

async function seedInstallments(repo: Awaited<ReturnType<typeof setup>>['repo'], card: Card) {
  for (const p of buildInstallments({ kind: 'despesa', amountCents: 30000, date: D, categoryId: 'cat-lazer', profileId: 'u1', cardId: card.id }, card, 3, 'g1')) {
    await repo.put<Transaction>('transactions', p, 'u1')
  }
}

test('excluir todas as parcelas grava 3 lápides', async () => {
  const s = await setup({ ready: true })
  const { card } = await withAccountAndCard(s.repo)
  await seedInstallments(s.repo, card)
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: /Lazer/ }))
  await s.user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }))
  await s.user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Todas as 3 parcelas' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(0))
  const doc = await s.repo.exportDoc()
  expect(Object.values(doc.records.transactions).filter(t => t.deletedAt)).toHaveLength(3)
})

test('editar todas as parcelas de 3x para 4x', async () => {
  const s = await setup({ ready: true })
  const { card } = await withAccountAndCard(s.repo)
  await seedInstallments(s.repo, card)
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: /Lazer/ }))
  const dlg = await screen.findByRole('dialog')
  await s.user.click(within(dlg).getByRole('button', { name: 'Todas as parcelas' }))
  await s.user.selectOptions(within(dlg).getByLabelText('Parcelas'), '4')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(4))
  const doc = await s.repo.exportDoc()
  expect(Object.values(doc.records.transactions).filter(t => t.deletedAt)).toHaveLength(3)
  const live = await s.repo.list<Transaction>('transactions')
  expect(live.reduce((a, t) => a + t.amountCents, 0)).toBe(30000)
})

test('encerrar recorrência não gera o mês seguinte', async () => {
  const s = await setup({ ready: true })
  await withAccountAndCard(s.repo)
  await s.repo.put<Recurrence>('recurrences', {
    id: 'r1', dayOfMonth: 5, startMonth: '2026-01',
    template: { kind: 'despesa', amountCents: 150000, categoryId: 'cat-moradia', profileId: 'u1', accountId: 'a1', note: 'Aluguel' },
  }, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos recorrentes' }))
  await s.user.click(await screen.findByRole('button', { name: /Aluguel/ }))
  await s.user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Encerrar' }))
  await waitFor(async () => expect((await s.repo.get<Recurrence>('recurrences', 'r1'))?.endMonth).toBe(monthOf(D)))
})

test('excluir conta com lançamentos mostra a quantidade', async () => {
  const s = await setup({ ready: true })
  await withAccountAndCard(s.repo)
  for (let i = 0; i < 2; i++) {
    await s.repo.put<Transaction>('transactions', { kind: 'despesa', amountCents: 100, date: D, categoryId: 'cat-outros', profileId: 'u1', accountId: 'a1' }, 'u1')
  }
  await s.user.click(await screen.findByRole('button', { name: 'Contas' }))
  await s.user.click(await screen.findByRole('button', { name: /Conta Itaú/ }))
  await s.user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }))
  const confirm = await screen.findByRole('alertdialog')
  expect(within(confirm).getByText(/Esta conta tem 2 lançamentos/)).toBeInTheDocument()
  await s.user.click(within(confirm).getByRole('button', { name: 'Excluir também os 2 lançamentos' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(0))
  expect(await s.repo.list('accounts')).toHaveLength(0)
})

test('categoria do sistema não pode ser excluída', async () => {
  const s = await setup({ ready: true })
  await s.user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  await s.user.click(await screen.findByRole('button', { name: 'Categorias e orçamento' }))
  await s.user.click(await screen.findByRole('button', { name: /Pagamento de fatura/ }))
  const dlg = await screen.findByRole('dialog')
  expect(within(dlg).queryByRole('button', { name: 'Excluir' })).toBeNull()
})
