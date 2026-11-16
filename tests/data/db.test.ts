import { Repo } from '../../src/data/db'
import { defaultCategories } from '../../src/domain/defaults'
import { accountBalanceCents } from '../../src/domain/summary'
import type { Category, Settings } from '../../src/domain/types'
import { emptyDoc, type Account, type Profile, type Recurrence, type Transaction } from '../../src/domain/types'

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
  remote.records.transactions.t2 = { ...txBase, id: 't2', accountId: 'a1', updatedAt: 5, updatedBy: 'u2' } as Transaction
  await repo.importDoc(remote)
  const ids = (await repo.list('transactions')).map(t => t.id).sort()
  expect(ids).toEqual(['t1', 't2'])
})

test('ensureDefaults é idempotente', async () => {
  const repo = newRepo()
  await repo.ensureDefaults('u1')
  await repo.ensureDefaults('u1')
  expect(await repo.list('profiles')).toHaveLength(2)
  expect(await repo.list('categories')).toHaveLength(defaultCategories(0).length)
})

test('padrões criados offline não apagam um nome editado em outro aparelho', async () => {
  const repo = newRepo()
  await repo.ensureDefaults('u1')
  const remote = emptyDoc()
  remote.records.profiles.u1 = { id: 'u1', name: 'Ana', updatedAt: 5, updatedBy: 'u2' } as Profile
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
  const affected = await repo.removeCascade('accounts', acc.id, 'u1')
  expect(affected).toHaveLength(3)
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
  await repo.put<Transaction>('transactions', { ...txBase, cardId: 'k1' }, 'u1')
  expect(await repo.countLinked('cards', 'k1')).toBe(2)
  await repo.remove('transactions', t.id, 'u1')
  expect(await repo.countLinked('cards', 'k1')).toBe(1)
})

test('edição feita durante a importação não é perdida', async () => {
  const repo = newRepo()
  const t = await repo.put<Transaction>('transactions', { ...txBase, id: 't1', accountId: 'a1' }, 'u1')
  const remote = await repo.exportDoc()
  // Força a edição a cair entre a leitura e a gravação da importação, se a importação ainda ler fora da transação.
  let edited = false
  const orig = repo.exportDoc.bind(repo)
  vi.spyOn(repo, 'exportDoc').mockImplementation(async () => {
    const d = await orig()
    if (!edited) { edited = true; await repo.put<Transaction>('transactions', { ...t, amountCents: 7000 }, 'u1') }
    return d
  })
  await repo.importDoc(remote)
  if (!edited) await repo.put<Transaction>('transactions', { ...t, amountCents: 7000 }, 'u1')
  expect((await repo.get<Transaction>('transactions', 't1'))?.amountCents).toBe(7000)
})

test('excluir cartão mantém os pagamentos de fatura (dinheiro que saiu da conta)', async () => {
  const repo = newRepo()
  await repo.put<Transaction>('transactions', { ...txBase, cardId: 'k1' }, 'u1')
  await repo.put<Transaction>('transactions', { ...txBase, accountId: 'a1', cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' } }, 'u1')
  expect(await repo.countLinked('cards', 'k1')).toBe(1)
  await repo.removeCascade('cards', 'k1', 'u1')
  const left = await repo.list<Transaction>('transactions')
  expect(left).toHaveLength(1)
  expect(left[0].cardPayment).toBeDefined()
})

test('excluir conta mantém pagamentos de fatura feitos por ela (a fatura continua paga)', async () => {
  const repo = newRepo()
  await repo.put<Transaction>('transactions', { ...txBase, accountId: 'a1' }, 'u1')
  await repo.put<Transaction>('transactions', { ...txBase, accountId: 'a1', cardPayment: { cardId: 'k1', invoiceMonth: '2026-11' } }, 'u1')
  expect(await repo.countLinked('accounts', 'a1')).toBe(1)
  await repo.removeCascade('accounts', 'a1', 'u1')
  expect((await repo.list<Transaction>('transactions')).map(t => !!t.cardPayment)).toEqual([true])
})

const rec = (o: Partial<Recurrence['template']>) => ({
  id: 'r1', dayOfMonth: 5, startMonth: '2026-01',
  template: { kind: 'receita' as const, amountCents: 500000, categoryId: 'cat-salario', profileId: 'u1' as const, accountId: 'a1', ...o },
})

test('excluir conta exclui suas recorrências e Desfazer devolve tudo', async () => {
  const repo = newRepo()
  await repo.put<Recurrence>('recurrences', rec({}), 'u1')
  const affected = await repo.removeCascade('accounts', 'a1', 'u1')
  expect(await repo.list('recurrences')).toHaveLength(0)
  await repo.restoreAll(affected, 'u1')
  expect(await repo.list('recurrences')).toHaveLength(1)
})

test('mover categoria também muda as recorrências', async () => {
  const repo = newRepo()
  await repo.ensureDefaults('u1')
  await repo.put<Recurrence>('recurrences', rec({ categoryId: 'cat-outras-receitas' }), 'u1')
  await repo.removeCascade('categories', 'cat-outras-receitas', 'u1', { moveToCategoryId: 'cat-salario' })
  expect((await repo.get<Recurrence>('recurrences', 'r1'))?.template.categoryId).toBe('cat-salario')
})

test('padrão antigo nunca editado ganha o nome novo; editado pelo usuário fica', async () => {
  const repo = newRepo()
  const old = { kind: 'despesa' as const, updatedAt: 0, updatedBy: 'u1' as const }
  const doc = emptyDoc()
  doc.records.categories['cat-saude'] = { id: 'cat-saude', name: 'Saúde', ...old } as Category
  doc.records.categories['cat-lazer'] = { id: 'cat-lazer', name: 'Diversão', ...old, updatedAt: 5 } as Category
  doc.records.categories['cat-outros'] = { id: 'cat-outros', name: 'Outros', ...old } as Category
  doc.records.categories['cat-assinaturas'] = { id: 'cat-assinaturas', name: 'Assinaturas', ...old } as Category
  await repo.importDoc(doc)
  await repo.put<Transaction>('transactions', { ...txBase, categoryId: 'cat-assinaturas', accountId: 'a1' }, 'u1')
  await repo.ensureDefaults('u1')
  expect((await repo.get<Category>('categories', 'cat-saude'))).toMatchObject({ name: 'Saúde e bem-estar', group: 'necessidade' })
  // Editada na Fase 1: o nome fica, mas ganha a classificação e os itens.
  expect((await repo.get<Category>('categories', 'cat-lazer'))).toMatchObject({ name: 'Diversão', group: 'desejo' })
  expect((await repo.get<Category>('categories', 'cat-lazer'))?.items?.length).toBeGreaterThan(0)
  // Categorias antigas não são apagadas (o outro aparelho pode estar usando).
  expect((await repo.get<Category>('categories', 'cat-outros'))?.name).toBe('Outros')
  expect((await repo.get<Category>('categories', 'cat-assinaturas'))?.name).toBe('Assinaturas')
  // A próxima sincronização traz de volta o documento antigo do Drive: a migração não pode ser desfeita.
  await repo.importDoc(doc)
  expect((await repo.get<Category>('categories', 'cat-saude'))?.name).toBe('Saúde e bem-estar')
  expect(await repo.isDirty()).toBe(true)
  await repo.markClean()
  await repo.ensureDefaults('u1')
  expect(await repo.isDirty()).toBe(false)
})

test('preferências (método) sincronizam como coleção', async () => {
  const a = newRepo(), b = newRepo()
  await a.put<Settings>('settings', { id: 'app', methodId: 'm2' }, 'u1')
  await b.importDoc(await a.exportDoc())
  expect((await b.get<Settings>('settings', 'app'))?.methodId).toBe('m2')
})

test('saldo da conta conta só o que foi pago; investimento sai da conta', () => {
  const acc = { id: 'a1', name: 'C', kind: 'corrente' as const, initialBalanceCents: 10000, updatedAt: 1, updatedBy: 'u1' as const }
  const t = (o: Partial<Transaction>) => ({ id: Math.random().toString(), ...txBase, accountId: 'a1', updatedAt: 1, updatedBy: 'u1' as const, ...o }) as Transaction
  expect(accountBalanceCents(acc, [t({ amountCents: 1000 }), t({ amountCents: 500, pending: true }), t({ kind: 'investimento', amountCents: 2000 })])).toBe(7000)
})

import Dexie from 'dexie'
test('banco de uma versão anterior (sem settings) abre e mantém os dados', async () => {
  const name = `old-${Math.random()}`
  const old = new Dexie(name)
  old.version(1).stores({ device: 'k', state: 'k', profiles: 'id', accounts: 'id', categories: 'id', cards: 'id', transactions: 'id', recurrences: 'id' })
  await old.table('transactions').put({ id: 't1', ...txBase, accountId: 'a1', updatedAt: 1, updatedBy: 'u1' })
  old.close()
  const repo = new Repo(name)
  expect(await repo.list('transactions')).toHaveLength(1)
  await repo.put<Settings>('settings', { id: 'app', methodId: 'm3' }, 'u1')
  expect((await repo.get<Settings>('settings', 'app'))?.methodId).toBe('m3')
})
