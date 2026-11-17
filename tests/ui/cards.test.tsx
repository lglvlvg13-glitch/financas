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

test('lançar a fatura compra por compra, com parcela em andamento', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Card>('cards', { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 5, dueDay: 15 }, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Cartões' }))
  const panel = await screen.findByRole('region', { name: 'Visa' })
  await s.user.click(within(panel).getByRole('button', { name: 'Lançar compras' }))
  const dlg = await screen.findByRole('dialog')
  await s.user.type(within(dlg).getByLabelText('Descrição'), 'Mercado')
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '50,00')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-alimentacao')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar e lançar outra' }))
  expect(await within(dlg).findByText('Mercado')).toBeInTheDocument()
  expect(within(dlg).getByLabelText('Descrição')).toHaveValue('')

  await s.user.type(within(dlg).getByLabelText('Descrição'), 'Loja')
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '100,00')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-vestuario')
  await s.user.click(within(dlg).getByRole('button', { name: 'Parcelada' }))
  const cur = within(dlg).getByLabelText('Parcela')
  await s.user.clear(cur); await s.user.type(cur, '3')
  await s.user.type(within(dlg).getByLabelText('de'), '10')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar e lançar outra' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(9))
  expect(within(dlg).getByRole('status')).toHaveTextContent('Total lançado nesta fatura: R$ 150,00')
  const loja = (await s.repo.list<Transaction>('transactions')).filter(t => t.note === 'Loja')
  expect(loja.map(t => t.installment!.n).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
  expect(new Set(loja.map(t => t.invoiceMonth)).size).toBe(8)
})

test('editar "todas as parcelas" de compra lançada pelo extrato não recria as parcelas antigas', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Card>('cards', { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 5, dueDay: 15 }, 'u1')
  const { statementPurchase } = await import('../../src/domain/invoice')
  const { addMonths } = await import('../../src/domain/dates')
  const bought = `${addMonths(M, -8)}-${D.slice(8, 10) > '28' ? '28' : D.slice(8, 10)}`
  for (const d of statementPurchase({ kind: 'despesa', amountCents: 10000, date: bought, categoryId: 'cat-vestuario', profileId: 'u1', cardId: 'k1', note: 'Loja' },
    { invoiceMonth: M, current: 9, total: 10, groupId: 'g' })) await s.repo.put<Transaction>('transactions', d, 'u1')
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: /Loja/ }))
  const dlg = await screen.findByRole('dialog')
  await s.user.click(within(dlg).getByRole('button', { name: 'Todas as parcelas' }))
  const v = within(dlg).getByLabelText(/Valor/)
  await s.user.clear(v); await s.user.type(v, '120,00')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions')).every(t => t.amountCents === 12000)).toBe(true))
  expect((await s.repo.list<Transaction>('transactions')).map(t => t.installment!.n).sort()).toEqual([10, 9].sort())
})

test('comprovante de uma parcela fica salvo; tirar de uma não apaga o arquivo das outras', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Card>('cards', { id: 'k1', name: 'Visa', limitCents: 500000, closingDay: 5, dueDay: 15 }, 'u1')
  const { buildInstallments } = await import('../../src/domain/invoice')
  const card = (await s.repo.get<Card>('cards', 'k1'))!
  for (const p of buildInstallments({ kind: 'despesa', amountCents: 30000, date: D, categoryId: 'cat-lazer', profileId: 'u1', cardId: 'k1', note: 'TV' }, card, 3, 'g1')) {
    await s.repo.put<Transaction>('transactions', { ...p, receipt: { fileId: 'B9', name: 'nota.jpg', mime: 'image/jpeg' } }, 'u1')
  }
  s.drive.blobs.set('B9', new Blob(['x']))
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: /TV/ }))
  const dlg = await screen.findByRole('dialog')
  await s.user.click(within(dlg).getByRole('button', { name: 'Tirar comprovante' }))
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions')).filter(t => t.receipt)).toHaveLength(2))
  expect(s.drive.blobs.has('B9')).toBe(true)
})
