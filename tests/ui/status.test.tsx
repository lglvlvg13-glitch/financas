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
  // Pago não leva etiqueta (a lista mostra só o que pede atenção).
  await waitFor(() => expect(within(screen.getByRole('listitem', { name: /Energia/ })).queryByRole('button', { name: 'Marcar como pago' })).toBeNull())
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

test('os itens da planilha aparecem com a classificação de cada um', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-servicos')
  const item = within(dlg).getByLabelText('Item')
  expect(within(item).getByRole('option', { name: 'Energia elétrica (Necessidade)' })).toBeInTheDocument()
  expect(within(item).getByRole('option', { name: 'TV por assinatura / streaming (Desejo)' })).toBeInTheDocument()
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

test('alimentação pode ser lançada como Desejo (restaurante) sem mudar a categoria', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '120')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-alimentacao')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  const metodo = within(dlg).getByRole('group', { name: 'No método 50/30/20' })
  expect(within(metodo).getByRole('button', { name: 'Necessidade' })).toHaveAttribute('aria-pressed', 'true')
  await s.user.click(within(metodo).getByRole('button', { name: 'Desejo' }))
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions'))[0]?.group).toBe('desejo'))
  expect((await s.repo.list<Transaction>('transactions'))[0].categoryId).toBe('cat-alimentacao')
})

test('sem mudar, o lançamento segue a categoria (não grava grupo próprio)', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '300')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-alimentacao')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(1))
  expect((await s.repo.list<Transaction>('transactions'))[0].group).toBeUndefined()
})

test('escolher o item já classifica: restaurante = Desejo', async () => {
  const s = await ready()
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '90')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-alimentacao')
  await s.user.selectOptions(within(dlg).getByLabelText('Item'), 'Restaurantes e delivery')
  expect(within(within(dlg).getByRole('group', { name: 'No método 50/30/20' })).getByRole('button', { name: /Desejo/ })).toHaveAttribute('aria-pressed', 'true')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions'))[0]?.item).toBe('Restaurantes e delivery'))
  expect((await s.repo.list<Transaction>('transactions'))[0].group).toBeUndefined()
})

test('em Categorias dá para mudar a classificação de cada item', async () => {
  const s = await setup({ ready: true })
  await s.user.click(await screen.findByRole('button', { name: 'Mais' }))
  await s.user.click(await screen.findByRole('button', { name: 'Ajustes' }))
  await s.user.click(await screen.findByRole('button', { name: 'Categorias e orçamento' }))
  await s.user.click(await screen.findByRole('button', { name: /^Alimentação/ }))
  const dlg = await screen.findByRole('dialog')
  const row = within(dlg).getByRole('group', { name: 'Lanches e cafés' })
  await s.user.click(within(row).getByRole('button', { name: 'Necessidade' }))
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => {
    const c = await s.repo.get<import('../../src/domain/types').Category>('categories', 'cat-alimentacao')
    expect(c?.items?.find(i => i.name === 'Lanches e cafés')?.group).toBe('necessidade')
  })
})

test('anexar foto do comprovante, ver e tirar', async () => {
  const s = await ready()
  if (!URL.createObjectURL) URL.createObjectURL = () => 'blob:x'
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {}
  const dlg = await openNew(s.user)
  await s.user.type(within(dlg).getByLabelText('Valor (R$)'), '45')
  await s.user.selectOptions(within(dlg).getByLabelText('Categoria'), 'cat-saude')
  await s.user.selectOptions(within(dlg).getByLabelText('Onde'), 'a:a1')
  await s.user.upload(within(dlg).getByLabelText('Anexar comprovante (foto ou PDF)'), new File([new Uint8Array([1, 2])], 'nota.jpg', { type: 'image/jpeg' }))
  await s.user.click(within(dlg).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions'))[0]?.receipt?.fileId).toBe('B1'))
  expect(s.drive.blobs.size).toBe(1)

  await s.user.click(await screen.findByRole('button', { name: /Saúde e bem-estar/ }))
  const edit = await screen.findByRole('dialog')
  await s.user.click(within(edit).getByRole('button', { name: 'Ver comprovante' }))
  expect(await within(edit).findByRole('img', { name: 'Comprovante' })).toBeInTheDocument()
  await s.user.click(within(edit).getByRole('button', { name: 'Tirar comprovante' }))
  await s.user.click(within(edit).getByRole('button', { name: 'Salvar' }))
  await waitFor(async () => expect((await s.repo.list<Transaction>('transactions'))[0].receipt).toBeUndefined())
  expect(s.drive.blobs.size).toBe(0)
})
