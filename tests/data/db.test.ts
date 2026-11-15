import { Repo } from '../../src/data/db'
import { emptyDoc, type Account, type Transaction } from '../../src/domain/types'

let n = 0
const newRepo = () => new Repo(`test-${++n}-${Math.random()}`)

const txBase = { kind: 'despesa' as const, amountCents: 1000, date: '2026-11-01', categoryId: 'cat-outros', profileId: 'u1' as const }

test('put gera id e carimbo', async () => {
  const repo = newRepo()
  const acc = await repo.put<Account>('accounts', { name: 'Nubank', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  expect(acc.id).toBeTruthy()
  expect(acc.updatedBy).toBe('u1')
  expect(await repo.isDirty()).toBe(true)
})

test('remove esconde da lista mas exporta lápide', async () => {
  const repo = newRepo()
  const acc = await repo.put<Account>('accounts', { name: 'X', kind: 'carteira', initialBalanceCents: 0 }, 'u1')
  await repo.remove('accounts', acc.id, 'u2')
  expect(await repo.list('accounts')).toHaveLength(0)
  const doc = await repo.exportDoc()
  expect(doc.records.accounts[acc.id].deletedAt).toBeTypeOf('number')
  expect(doc.records.accounts[acc.id].updatedBy).toBe('u2')
})

test('restore traz o item de volta', async () => {
  const repo = newRepo()
  const acc = await repo.put<Account>('accounts', { name: 'X', kind: 'carteira', initialBalanceCents: 0 }, 'u1')
  await repo.remove('accounts', acc.id, 'u1')
  await repo.restore('accounts', acc.id, 'u1')
  const list = await repo.list<Account>('accounts')
  expect(list).toHaveLength(1)
  expect(list[0].deletedAt).toBeUndefined()
})

test('editar mantém o id e atualiza o carimbo', async () => {
  const repo = newRepo()
  const t1 = await repo.put<Transaction>('transactions', { ...txBase, accountId: 'a1' }, 'u1')
  await new Promise(r => setTimeout(r, 2))
  const t2 = await repo.put<Transaction>('transactions', { ...t1, amountCents: 7000 }, 'u1')
  const list = await repo.list<Transaction>('transactions')
  expect(list).toHaveLength(1)
  expect(t2.id).toBe(t1.id)
  expect(list[0].amountCents).toBe(7000)
  expect(t2.updatedAt).toBeGreaterThan(t1.updatedAt)
})

test('importDoc junta com o local', async () => {
  const repo = newRepo()
  await repo.put<Transaction>('transactions', { ...txBase, id: 't1', accountId: 'a1' }, 'u1')
  const remote = emptyDoc()
  remote.records.transactions.t2 = { ...txBase, id: 't2', accountId: 'a1', updatedAt: 5, updatedBy: 'u2' }
  await repo.importDoc(remote)
  const ids = (await repo.list('transactions')).map(t => t.id).sort()
  expect(ids).toEqual(['t1', 't2'])
})

test('ensureDefaults é idempotente', async () => {
  const repo = newRepo()
  await repo.ensureDefaults('u1')
  await repo.ensureDefaults('u1')
  expect(await repo.list('profiles')).toHaveLength(2)
  expect(await repo.list('categories')).toHaveLength(11)
})

test('padrões criados offline não apagam um nome editado em outro aparelho', async () => {
  const repo = newRepo()
  await repo.ensureDefaults('u1')
  const remote = emptyDoc()
  remote.records.profiles.u1 = { id: 'u1', name: 'Ana', updatedAt: 5, updatedBy: 'u2' }
  await repo.importDoc(remote)
  const p = await repo.get<{ id: string; name: string } & import('../../src/domain/types').Meta>('profiles', 'u1')
  expect(p?.name).toBe('Ana')
})

test('device não entra no exportDoc', async () => {
  const repo = newRepo()
  await repo.setDevice({ profileId: 'u2', dataFileId: 'F' })
  expect(await repo.getDevice()).toEqual({ profileId: 'u2', dataFileId: 'F' })
  const doc = await repo.exportDoc()
  expect(JSON.stringify(doc)).not.toContain('dataFileId')
})

test('removeCascade de conta exclui seus lançamentos', async () => {
  const repo = newRepo()
  const acc = await repo.put<Account>('accounts', { name: 'C', kind: 'corrente', initialBalanceCents: 0 }, 'u1')
  await repo.put<Transaction>('transactions', { ...txBase, accountId: acc.id }, 'u1')
  await repo.put<Transaction>('transactions', { ...txBase, accountId: acc.id }, 'u1')
  const ids = await repo.removeCascade('accounts', acc.id, 'u1')
  expect(ids).toHaveLength(3)
  expect(await repo.list('transactions')).toHaveLength(0)
})

test('removeCascade de categoria com moveTo regrava os lançamentos', async () => {
  const repo = newRepo()
  await repo.ensureDefaults('u1')
  await repo.put<Transaction>('transactions', { ...txBase, categoryId: 'cat-lazer', accountId: 'a1' }, 'u1')
  await repo.removeCascade('categories', 'cat-lazer', 'u1', { moveToCategoryId: 'cat-outros' })
  const txs = await repo.list<Transaction>('transactions')
  expect(txs).toHaveLength(1)
  expect(txs[0].categoryId).toBe('cat-outros')
})

test('countLinked ignora lançamentos já excluídos', async () => {
  const repo = newRepo()
  const t = await repo.put<Transaction>('transactions', { ...txBase, cardId: 'k1' }, 'u1')
  await repo.put<Transaction>('transactions', { ...txBase, accountId: 'a1', cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' } }, 'u1')
  expect(await repo.countLinked('cards', 'k1')).toBe(2)
  await repo.remove('transactions', t.id, 'u1')
  expect(await repo.countLinked('cards', 'k1')).toBe(1)
})
