import { mergeDocs } from '../../src/domain/merge'
import { emptyDoc, type DataDoc, type Transaction } from '../../src/domain/types'
import { defaultCategories } from '../../src/domain/defaults'

const tx = (id: string, over: Partial<Transaction> = {}): Transaction => ({
  id, kind: 'despesa', amountCents: 100, date: '2026-11-01', categoryId: 'cat-outros',
  profileId: 'u1', accountId: 'a1', updatedAt: 1, updatedBy: 'u1', ...over,
})

const docWith = (...txs: Transaction[]): DataDoc => {
  const d = emptyDoc()
  for (const t of txs) d.records.transactions[t.id] = t
  return d
}

test('registros novos dos dois lados sobrevivem', () => {
  const r = mergeDocs(docWith(tx('t1')), docWith(tx('t2')))
  expect(Object.keys(r.records.transactions).sort()).toEqual(['t1', 't2'])
})

test('vence a alteração mais recente', () => {
  const r = mergeDocs(
    docWith(tx('t1', { updatedAt: 100, amountCents: 500 })),
    docWith(tx('t1', { updatedAt: 200, amountCents: 900 })),
  )
  expect((r.records.transactions.t1 as Transaction).amountCents).toBe(900)
})

test('exclusão mais recente vence edição antiga', () => {
  const r = mergeDocs(
    docWith(tx('t1', { updatedAt: 300, deletedAt: 300 })),
    docWith(tx('t1', { updatedAt: 200, amountCents: 999 })),
  )
  expect(r.records.transactions.t1.deletedAt).toBe(300)
})

test('edição posterior à exclusão revive o registro', () => {
  const r = mergeDocs(
    docWith(tx('t1', { updatedAt: 300, deletedAt: 300 })),
    docWith(tx('t1', { updatedAt: 400 })),
  )
  expect(r.records.transactions.t1.deletedAt).toBeUndefined()
})

test('merge é comutativo', () => {
  const a = docWith(tx('t1', { updatedAt: 50, updatedBy: 'u1', amountCents: 1 }), tx('t2'))
  const b = docWith(tx('t1', { updatedAt: 50, updatedBy: 'u2', amountCents: 2 }), tx('t3'))
  expect(mergeDocs(a, b)).toEqual(mergeDocs(b, a))
})

test('categorias padrão têm ids fixos', () => {
  const a = emptyDoc(), b = emptyDoc()
  for (const c of defaultCategories(10)) a.records.categories[c.id] = c
  for (const c of defaultCategories(20)) b.records.categories[c.id] = c
  expect(Object.keys(mergeDocs(a, b).records.categories)).toHaveLength(11)
})
