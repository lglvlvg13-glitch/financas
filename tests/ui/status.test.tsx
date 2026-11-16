import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import { addMonths, monthOf, today } from '../../src/domain/dates'
import type { Account, Recurrence, Transaction } from '../../src/domain/types'

const D = today()

async function ready() {
  const s = await setup({ ready: true })
  await s.repo.put<Account>('accounts', { id: 'a1', name: 'Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  return s
}
async function openNew(user: Awaited<ReturnType<typeof setup>>['user']) {
  await user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await user.click(await screen.findByRole('button', { name: 'Novo lançamento' }))
  const dlg = await screen.findByRole('dialog')
  // As listas (categorias, contas) carregam do banco local logo depois de abrir.
  await within(dlg).findByRole('option', { name: 'Moradia' })
  await within(dlg).findByRole('option', { name: 'Itaú' })
  return dlg
}

test('conta a pagar: sem "Já está pago" fica pendente; marcar como pago grava a data', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '287,40')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-servicos')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  const venc = within(dlg).getByLabelText('Vence em')
  await s.user.clear(venc)
  await s.user.type(venc, '2020-01-10')
  await s.user.click(within(dlg).getByLabelText('Já está pago'))
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(1))
  const [t] = await s.repo.list<Transaction>('transactions')
  expect(t.pending).toBe(true)
})

test('lista mostra situação e "Marcar como pago" funciona', async () => {
  const s = await ready()
  await s.repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 28740, date: `${monthOf(D)}-01`, categoryId: 'cat-servicos', profileId: 'u1', accountId: 'a1', pending: true, note: 'Energia',
  }, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  const item = await screen.findByRole('listitem', { name: /Energia/ })
  expect(within(item).getByText(D > `${monthOf(D)}-01` ? 'Atrasado' : 'Previsto')).toBeInTheDocument()
  await s.user.click(within(item).getByRole('button', { name: 'Marcar como pago' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions'))[0].pending).toBeUndefined())
  expect((await s.repo.list<Transaction>('transactions'))[0].paidDate).toBe(D)
  expect(await within(item).findByText('Pago')).toBeInTheDocument()
})

test('investimento é um terceiro tipo com as categorias de investimento', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.click(within(dlg).getByRole('button', { name: 'Investimento' }))
  const cat = within(dlg).getByLabelText('Categoria')
  expect(within(cat).getByRole('option', { name: 'Caixinha 1' })).toBeInTheDocument()
  expect(within(cat).queryByRole('option', { name: 'Moradia' })).toBeNull()
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '500')
  await s.user.selectOptions(cat, 'cat-inv-caixinha-1')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions'))[0]?.kind).toBe('investimento'))
})

test('dica mostra os exemplos da categoria escolhida', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-servicos')
  expect(within(dlg).getByText(/Energia elétrica, Água e esgoto/)).toBeInTheDocument()
})

test('Lançador: repetir por 3 meses define o fim da recorrência', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '980')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-educacao')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  await s.user.click(within(dlg).getByLabelText('Repetir todo mês'))
  await s.user.type(within(dlg).getByLabelText('Por quantos meses'), '3')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect(await s.repo.list('recurrences')).toHaveLength(1))
  const [r] = await s.repo.list<Recurrence>('recurrences')
  expect(r.endMonth).toBe(addMonths(monthOf(D), 2))
})

test('conta do tipo Pix', async () => {
  const s = await setup({ ready: true })
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Contas' }))
  await s.user.click(await screen.findByRole('button', { name: 'Nova conta' }))
  const dlg = await screen.findByRole('dialog')
  expect(within(within(dlg).getByLabelText('Tipo')).getByRole('option', { name: 'Pix' })).toBeInTheDocument()
})
