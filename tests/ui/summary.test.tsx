import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import { today, monthOf, addMonths } from '../../src/domain/dates'
import type { Account, Category, Settings, Transaction } from '../../src/domain/types'

const D = today()
const M = monthOf(D)
const prevMonthDay = `${addMonths(M, -1)}-10`

async function seed(repo: Awaited<ReturnType<typeof setup>>['repo']) {
  await repo.put<Account>('accounts', { id: 'a1', name: 'Conta', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  const tx = (t: Partial<Transaction>) => repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 0, date: D, categoryId: 'cat-emergencias', profileId: 'u1', accountId: 'a1', ...t,
  } as Transaction, 'u1')
  await tx({ kind: 'receita', amountCents: 500000, categoryId: 'cat-salario-u1' })
  await tx({ kind: 'receita', amountCents: 300000, categoryId: 'cat-salario-u2', profileId: 'u2' })
  await tx({ amountCents: 120000, categoryId: 'cat-alimentacao' })
  await tx({ amountCents: 80000, categoryId: 'cat-lazer', profileId: 'u2', pending: true, date: `${addMonths(M, 1)}-01` > D ? D : D })
  await tx({ kind: 'investimento', amountCents: 100000, categoryId: 'cat-inv-caixinha-1' })
  await tx({ amountCents: 55500, categoryId: 'cat-moradia', date: prevMonthDay })
}

const group = (name: string) => screen.getByRole('group', { name })

test('mês: entradas, saídas, investido e os dois saldos', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  expect(await within(await screen.findByRole('group', { name: 'Saldo final' })).findByText('R$ 5.000,00')).toBeInTheDocument()
  expect(within(group('Entradas')).getByText('R$ 8.000,00')).toBeInTheDocument()
  expect(within(group('Saídas')).getByText('R$ 2.000,00')).toBeInTheDocument()
  expect(within(group('Investido')).getByText('R$ 1.000,00')).toBeInTheDocument()
  expect(within(group('Saldo final')).getByText('R$ 6.000,00')).toBeInTheDocument()
})

test('trocar para Ano inclui o mês anterior; Só pagos tira o previsto', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await within(await screen.findByRole('group', { name: 'Saídas' })).findByText('R$ 2.000,00')
  if (M.slice(5) !== '01') {
    await s.user.click(within(screen.getByRole('group', { name: 'Período' })).getByRole('button', { name: 'Ano' }))
    expect(await within(group('Saídas')).findByText('R$ 2.555,00')).toBeInTheDocument()
    await s.user.click(within(screen.getByRole('group', { name: 'Período' })).getByRole('button', { name: 'Mês' }))
  }
  await s.user.click(within(screen.getByRole('group', { name: 'Considerar' })).getByRole('button', { name: 'Só pagos' }))
  expect(await within(group('Saídas')).findByText('R$ 1.200,00')).toBeInTheDocument()
})

test('dia e semana mostram só o que cai no período', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await within(await screen.findByRole('group', { name: 'Saídas' })).findByText('R$ 2.000,00')
  await s.user.click(within(screen.getByRole('group', { name: 'Período' })).getByRole('button', { name: 'Dia' }))
  expect(await within(group('Entradas')).findByText('R$ 8.000,00')).toBeInTheDocument()
  await s.user.click(screen.getByRole('button', { name: 'Período anterior' }))
  expect(await within(group('Entradas')).findByText('R$ 0,00')).toBeInTheDocument()
})

test('variação do método fica salva e muda o previsto', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  const sel = await screen.findByLabelText('Variação do método')
  await s.user.selectOptions(sel, 'm2')
  await waitFor(async () => expect((await s.repo.get<Settings>('settings', 'app'))?.methodId).toBe('m2'))
  const need = screen.getByRole('listitem', { name: 'Necessidades' })
  expect(within(need).getByText(/Previsto R\$ 5\.600,00/)).toBeInTheDocument()
})

test('categoria acima do orçamento fica destacada', async () => {
  const s = await setup({ ready: true })
  const cat = await s.repo.get<Category>('categories', 'cat-alimentacao')
  await s.repo.put<Category>('categories', { ...cat!, monthlyBudgetCents: 100000 }, 'u1')
  await seed(s.repo)
  await s.user.click(await screen.findByRole('button', { name: 'Mês' }))
  const row = await screen.findByRole('listitem', { name: 'Alimentação' })
  expect(await within(row).findByText('Acima do orçamento em R$ 200,00')).toBeInTheDocument()
})

test('baixar planilha gera um arquivo .csv', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  const created: Blob[] = []
  URL.createObjectURL = ((b: Blob) => { created.push(b); return 'blob:x' }) as typeof URL.createObjectURL
  URL.revokeObjectURL = () => {}
  await s.user.click(await screen.findByRole('button', { name: 'Baixar .csv' }))
  expect(created).toHaveLength(1)
  const text = await created[0].text()
  expect(text).toContain('Situação')
  expect(text).toContain('Alimentação')
})

test('Painel mostra atrasados e pagos do ano', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.repo.put<Transaction>('transactions', { kind: 'despesa', amountCents: 41200, date: '2020-01-01' > D ? D : `${D.slice(0, 4)}-01-02`, categoryId: 'cat-seguros', profileId: 'u1', accountId: 'a1', pending: true }, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Painel' }))
  const card = await screen.findByRole('group', { name: 'Despesas atrasadas' })
  expect(await within(card).findByText(/R\$ /)).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /Entradas mês a mês/ })).toBeInTheDocument()
})

test('Relatório do ano tem as linhas da planilha', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Relatório do ano' }))
  const table = await screen.findByRole('table')
  for (const label of ['Receita', 'Despesa', 'Saldo antes do investimento', 'Investimento', 'Saldo final', 'Moradia', 'Caixinha 1']) {
    expect(within(table).getByRole('rowheader', { name: label })).toBeInTheDocument()
  }
})
