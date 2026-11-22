import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import { today } from '../../src/domain/dates'
import { isGoalId, type Goal, type Plan } from '../../src/domain/goals'
import type { Account, Meta, Transaction } from '../../src/domain/types'

const D = today()

async function openPlanning(s: Awaited<ReturnType<typeof setup>>) {
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Planejamento e metas' }))
  await screen.findByRole('heading', { name: 'Planejamento' })
}

const goals = async (s: Awaited<ReturnType<typeof setup>>) =>
  (await s.repo.list<Meta>('settings')).filter(r => isGoalId(r.id)) as Goal[]

test('mostra as 5 áreas com as subáreas pedidas', async () => {
  const s = await setup({ ready: true })
  await openPlanning(s)
  for (const a of ['Generosidade', 'Necessidades', 'Desejos', 'Poupanças', 'Investimentos'])
    expect(screen.getByRole('region', { name: a })).toBeInTheDocument()
  const gen = within(screen.getByRole('region', { name: 'Generosidade' }))
  for (const sub of ['Dízimos', 'Ofertas', 'Doações']) expect(gen.getByText(sub)).toBeInTheDocument()
  const des = within(screen.getByRole('region', { name: 'Desejos' }))
  for (const sub of ['Física', 'Mental', 'Família', 'Financeira', 'Social']) expect(des.getByText(sub)).toBeInTheDocument()
})

test('criar meta sem dinheiro em Desejos > Física e marcar como concluída', async () => {
  const s = await setup({ ready: true })
  await openPlanning(s)
  await s.user.click(screen.getByRole('button', { name: 'Nova meta em Desejos' }))
  await s.user.type(screen.getByLabelText('Meta'), 'Correr 10 km')
  await s.user.selectOptions(screen.getByLabelText('Área da vida'), 'Física')
  await s.user.click(within(screen.getByRole('group', { name: 'Prazo' })).getByRole('button', { name: 'Médio prazo' }))
  await s.user.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect(await goals(s)).toHaveLength(1))
  const [g] = await goals(s)
  expect(g).toMatchObject({ name: 'Correr 10 km', area: 'desejos', sub: 'Física', term: 'medio' })
  expect(g.targetCents).toBeUndefined()
  await s.user.click(await screen.findByRole('button', { name: 'Marcar Correr 10 km como concluída' }))
  await waitFor(async () => expect((await goals(s))[0].doneAt).toBe(D))
})

test('meta com valor mostra o progresso dos lançamentos ligados', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Account>('accounts', { id: 'a1', name: 'Conta', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  await s.repo.put<Goal>('settings', { id: 'goal:viagem', name: 'Viagem', area: 'poupancas', sub: 'Objetivos', term: 'curto', targetCents: 500000 }, 'u1')
  await s.repo.put<Transaction>('transactions', { kind: 'despesa', amountCents: 125000, date: D, categoryId: 'cat-poupanca', profileId: 'u1', accountId: 'a1', goalId: 'goal:viagem' } as Transaction, 'u1')
  await openPlanning(s)
  const row = await screen.findByRole('listitem', { name: 'Viagem' })
  expect(within(row).getByText(/R\$ 1\.250,00 de R\$ 5\.000,00 \(25%\)/)).toBeInTheDocument()
})

test('divisão da renda: ajustar as % e só salvar quando somar 100', async () => {
  const s = await setup({ ready: true })
  await openPlanning(s)
  await s.user.click(screen.getByRole('button', { name: 'Ajustar %' }))
  const dlg = within(screen.getByRole('dialog'))
  const gen = dlg.getByLabelText('Generosidade')
  await s.user.clear(gen); await s.user.type(gen, '15')
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  const des = dlg.getByLabelText('Desejos')
  await s.user.clear(des); await s.user.type(des, '15')
  await s.user.click(screen.getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.get<Plan>('settings', 'plan'))?.pct).toMatchObject({ generosidade: 15, desejos: 15 }))
  const plano = within(screen.getByRole('region', { name: 'Divisão da renda' }))
  expect(await plano.findAllByText('(15%)', { selector: 'span' })).toHaveLength(2)
})
