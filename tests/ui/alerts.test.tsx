import { screen, within, waitFor } from '@testing-library/react'
import { setup } from './helpers'
import { addDays } from '../../src/domain/period'
import { today, monthOf } from '../../src/domain/dates'
import type { Account, Category, Transaction } from '../../src/domain/types'

const D = today()

test('Painel mostra próximos vencimentos e alerta de orçamento a 80%', async () => {
  const s = await setup({ ready: true })
  await s.repo.put<Account>('accounts', { id: 'a1', name: 'Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  const cat = await s.repo.get<Category>('categories', 'cat-alimentacao')
  await s.repo.put<Category>('categories', { ...cat!, monthlyBudgetCents: 100000 }, 'u1')
  await s.repo.put<Transaction>('transactions', { kind: 'despesa', amountCents: 90000, date: `${monthOf(D)}-01`, categoryId: 'cat-alimentacao', profileId: 'u1', accountId: 'a1' }, 'u1')
  await s.repo.put<Transaction>('transactions', { kind: 'despesa', amountCents: 28740, date: addDays(D, 2), categoryId: 'cat-servicos', profileId: 'u1', accountId: 'a1', pending: true, note: 'Energia' }, 'u1')
  const next = await screen.findByRole('region', { name: 'Próximos vencimentos' })
  expect(await within(next).findByText('Energia')).toBeInTheDocument()
  expect(within(next).getByText('R$ 287,40')).toBeInTheDocument()
  expect(await screen.findByText(/Alimentação já usou 90% do orçamento/)).toBeInTheDocument()
})

test('vencimentos viram notificação ao abrir, uma vez por dia', async () => {
  const shown: string[] = []
  class FakeNotification { static permission = 'granted'; constructor(title: string) { shown.push(title) } }
  ;(globalThis as unknown as { Notification: unknown }).Notification = FakeNotification
  const s = await setup({ ready: true })
  await s.repo.put<Account>('accounts', { id: 'a1', name: 'Itaú', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  await s.repo.put<Transaction>('transactions', { kind: 'despesa', amountCents: 28740, date: addDays(D, 1), categoryId: 'cat-servicos', profileId: 'u1', accountId: 'a1', pending: true, note: 'Energia' }, 'u1')
  await waitFor(() => expect(shown.some(t => t.includes('Energia'))).toBe(true))
  const count = shown.length
  // Abrir de novo no mesmo dia não repete o aviso.
  const { render } = await import('@testing-library/react')
  const App = (await import('../../src/ui/App')).default
  s.unmount()
  render(<App deps={{ repo: s.repo, requestToken: async () => ({ accessToken: 'T', expiresAt: Date.now() + 3e6 }), makeDrive: () => s.drive }} />)
  await screen.findByRole('heading', { name: 'Painel' })
  await new Promise(r => setTimeout(r, 300))
  expect(shown.length).toBe(count)
  delete (globalThis as unknown as { Notification?: unknown }).Notification
})
