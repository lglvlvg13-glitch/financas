import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import { today, monthOf } from '../../src/domain/dates'
import { invoiceMonthFor } from '../../src/domain/invoice'
import type { Account, Card, Transaction } from '../../src/domain/types'

const D = today()
const M = monthOf(D)

async function seed(repo: Awaited<ReturnType<typeof setup>>['repo']) {
  await repo.put<Account>('accounts', { id: 'a1', name: 'Conta Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  const card = await repo.put<Card>('cards', { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 5, dueDay: 15 }, 'u1')
  await repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 5000, date: D, categoryId: 'cat-lazer', profileId: 'u1', cardId: 'k1', invoiceMonth: M,
  }, 'u1')
  return card
}

test('fatura mostra total e vencimento', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.user.click(await screen.findByRole('button', { name: 'Cartões' }))
  const panel = await screen.findByRole('region', { name: 'Visa' })
  expect(within(panel).getByText('R$ 50,00', { selector: '.total' })).toBeInTheDocument()
  expect(within(panel).getByText(`Vence em 15/${M.slice(5)}`)).toBeInTheDocument()
})

test('pagar fatura marca como paga', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.user.click(await screen.findByRole('button', { name: 'Cartões' }))
  const panel = await screen.findByRole('region', { name: 'Visa' })
  await s.user.click(within(panel).getByRole('button', { name: 'Pagar fatura' }))
  const dlg = await screen.findByRole('dialog')
  expect(within(dlg).getByLabelText('Valor (R$)')).toHaveValue('50,00')
  await s.user.selectOptions(within(dlg).getByLabelText('Pagar com a conta'), 'a1')
  await s.user.click(within(dlg).getByRole('button', { name: 'Pagar' }))
  expect(await within(panel).findByText('Paga')).toBeInTheDocument()
  const pay = (await s.repo.list<Transaction>('transactions')).find(t => t.cardPayment)
  expect(pay).toMatchObject({ amountCents: 5000, accountId: 'a1', categoryId: 'cat-pagamento-fatura', cardPayment: { cardId: 'k1', invoiceMonth: M } })
})

test('dia de fechamento 0 ou 32 é recusado', async () => {
  const s = await setup({ ready: true })
  await s.user.click(await screen.findByRole('button', { name: 'Cartões' }))
  await s.user.click(await screen.findByRole('button', { name: 'Novo cartão' }))
  const dlg = await screen.findByRole('dialog')
  await s.user.type(within(dlg).getByLabelText('Nome'), 'Master')
  await s.user.type(within(dlg).getByLabelText('Limite (R$)'), '1000')
  await s.user.type(within(dlg).getByLabelText('Dia de fechamento'), '32')
  await s.user.type(within(dlg).getByLabelText('Dia de vencimento'), '10')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  expect(await within(dlg).findByText('Os dias devem ser de 1 a 31.')).toBeInTheDocument()
  expect(await s.repo.list('cards')).toHaveLength(0)
})

test('mudar dia de fechamento move compras abertas, não as de fatura paga', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Account>('accounts', { id: 'a1', name: 'Conta', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  await s.repo.put<Card>('cards', { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 5, dueDay: 15 }, 'u1')
  const open = await s.repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 1000, date: '2026-11-10', categoryId: 'cat-lazer', profileId: 'u1', cardId: 'k1', invoiceMonth: invoiceMonthFor('2026-11-10', 5),
  }, 'u1')
  const paid = await s.repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 2000, date: '2026-10-10', categoryId: 'cat-lazer', profileId: 'u1', cardId: 'k1', invoiceMonth: invoiceMonthFor('2026-10-10', 5),
  }, 'u1')
  await s.repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 2000, date: '2026-11-15', categoryId: 'cat-pagamento-fatura', profileId: 'u1', accountId: 'a1',
    cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' },
  }, 'u1')
  expect(open.invoiceMonth).toBe('2026-12')
  expect(paid.invoiceMonth).toBe('2026-11')

  await s.user.click(await screen.findByRole('button', { name: 'Cartões' }))
  const panel = await screen.findByRole('region', { name: 'Visa' })
  await s.user.click(within(panel).getByRole('button', { name: 'Editar cartão' }))
  const dlg = await screen.findByRole('dialog')
  const closing = within(dlg).getByLabelText('Dia de fechamento')
  await s.user.clear(closing)
  await s.user.type(closing, '15')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.get<Transaction>('transactions', open.id))?.invoiceMonth).toBe('2026-11'))
  expect((await s.repo.get<Transaction>('transactions', paid.id))?.invoiceMonth).toBe('2026-11')
})

test('excluir pagamento volta a fatura para aberta', async () => {
  const s = await setup({ ready: true })
  await seed(s.repo)
  await s.repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 5000, date: D, categoryId: 'cat-pagamento-fatura', profileId: 'u1', accountId: 'a1',
    cardPayment: { cardId: 'k1', invoiceMonth: M },
  }, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Cartões' }))
  const panel = await screen.findByRole('region', { name: 'Visa' })
  expect(await within(panel).findByText('Paga')).toBeInTheDocument()
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: /Pagamento de fatura/ }))
  await s.user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Excluir' }))
  await s.user.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Excluir' }))
  await s.user.click(await screen.findByRole('button', { name: 'Cartões' }))
  const panel2 = await screen.findByRole('region', { name: 'Visa' })
  await waitFor(() => expect(within(panel2).queryByText('Paga')).toBeNull())
  expect(within(panel2).getByRole('button', { name: 'Pagar fatura' })).toBeInTheDocument()
})
