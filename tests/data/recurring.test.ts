import { Repo } from '../../src/data/db'
import { generateRecurrences } from '../../src/data/recurring'
import type { Account, Recurrence, Transaction } from '../../src/domain/types'

let n = 0
const newRepo = async () => {
  const r = new Repo(`rec-${++n}-${Math.random()}`)
  await r.ensureDefaults('u1')
  await r.put<Account>('accounts', { id: 'a1', name: 'C', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  await r.put<Recurrence>('recurrences', {
    id: 'r1', dayOfMonth: 5, startMonth: '2026-01',
    template: { kind: 'despesa', amountCents: 200000, categoryId: 'cat-moradia', profileId: 'u1', accountId: 'a1', note: 'Aluguel' },
  }, 'u1')
  return r
}

test('dois aparelhos gerando o mesmo mês não duplicam após sincronizar', async () => {
  const a = await newRepo(), b = await newRepo()
  await b.importDoc(await a.exportDoc())
  await generateRecurrences(a, '2026-12', 'u1')
  await generateRecurrences(b, '2026-12', 'u2')
  await b.importDoc(await a.exportDoc())
  await a.importDoc(await b.exportDoc())
  const dez = (r: Transaction[]) => r.filter(t => t.recurrenceId === 'r1' && t.date.startsWith('2026-12'))
  expect(dez(await a.list<Transaction>('transactions'))).toHaveLength(1)
  expect(dez(await b.list<Transaction>('transactions'))).toHaveLength(1)
})

test('edição de um recorrente gerado vence a cópia gerada no outro aparelho', async () => {
  const a = await newRepo(), b = await newRepo()
  await generateRecurrences(a, '2026-12', 'u1')
  const [t] = (await a.list<Transaction>('transactions')).filter(x => x.recurrenceId)
  await a.put<Transaction>('transactions', { ...t, amountCents: 210000 }, 'u1')
  await generateRecurrences(b, '2026-12', 'u2')
  await b.importDoc(await a.exportDoc())
  const got = (await b.list<Transaction>('transactions')).filter(x => x.recurrenceId)
  expect(got.map(x => x.amountCents)).toEqual([210000])
})

test('recorrência de conta excluída não gera lançamento', async () => {
  const r = await newRepo()
  await r.remove('accounts', 'a1', 'u1')
  await generateRecurrences(r, '2026-12', 'u1')
  expect((await r.list<Transaction>('transactions')).filter(t => t.recurrenceId)).toHaveLength(0)
})

test('recorrente gerado chega como previsto e para no fim', async () => {
  const r = await newRepo()
  await r.put<Recurrence>('recurrences', { ...(await r.get<Recurrence>('recurrences', 'r1'))!, endMonth: '2026-12' }, 'u1')
  await generateRecurrences(r, '2026-12', 'u1')
  await generateRecurrences(r, '2027-01', 'u1')
  const got = (await r.list<Transaction>('transactions')).filter(t => t.recurrenceId)
  expect(got).toHaveLength(1)
  expect(got[0].pending).toBe(true)
})
