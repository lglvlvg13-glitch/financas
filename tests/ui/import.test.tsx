import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import type { Account, Transaction } from '../../src/domain/types'

const CSV = 'Data;Descrição;Valor\n05/11/2026;SUPERMERCADO BOM PRECO;-61,29\n05/11/2026;SALARIO EMPRESA X;6.200,00\n06/11/2026;XPTO LTDA;-10,00\n'

async function openImport(s: Awaited<ReturnType<typeof setup>>) {
  await s.user.click(await screen.findByRole('button', { name: 'Lançamentos' }))
  await s.user.click(await screen.findByRole('button', { name: 'Importar extrato' }))
}

test('importar extrato da conta: revisar, corrigir categoria e não repetir', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Account>('accounts', { id: 'a1', name: 'Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  await openImport(s)
  await within(await screen.findByLabelText('Para onde')).findByRole('option', { name: 'Conta Itaú' })
  await s.user.selectOptions(screen.getByLabelText('Para onde'), 'a:a1')
  await s.user.upload(screen.getByLabelText('Arquivo do extrato (OFX ou CSV)'), new File([CSV], 'extrato.csv', { type: 'text/csv' }))
  const list = await screen.findByRole('list', { name: 'Linhas do extrato' })
  expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  const xpto = within(list).getByRole('listitem', { name: /XPTO/ })
  await s.user.selectOptions(within(xpto).getByLabelText('Categoria'), 'cat-lazer')
  await s.user.click(screen.getByRole('button', { name: 'Importar 3 lançamentos' }))
  await waitFor(async () => expect(await s.repo.list('transactions')).toHaveLength(3))
  const txs = await s.repo.list<Transaction>('transactions')
  expect(txs.find(t => t.note === 'XPTO LTDA')?.categoryId).toBe('cat-lazer')
  expect(txs.find(t => t.note === 'SUPERMERCADO BOM PRECO')).toMatchObject({ kind: 'despesa', amountCents: 6129, item: 'Supermercado' })
  expect(txs.every(t => t.importKey && !t.pending)).toBe(true)

  await openImport(s)
  await s.user.selectOptions(await screen.findByLabelText('Para onde'), 'a:a1')
  await s.user.upload(screen.getByLabelText('Arquivo do extrato (OFX ou CSV)'), new File([CSV], 'extrato.csv', { type: 'text/csv' }))
  expect(await screen.findByText(/3 linhas já tinham sido importadas/)).toBeInTheDocument()
})

test('arquivo que não é extrato mostra o que fazer', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Account>('accounts', { id: 'a1', name: 'Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  await openImport(s)
  await s.user.selectOptions(await screen.findByLabelText('Para onde'), 'a:a1')
  await s.user.upload(screen.getByLabelText('Arquivo do extrato (OFX ou CSV)'), new File(['oi'], 'nada.txt', { type: 'text/plain' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/Não encontrei lançamentos/)
})
