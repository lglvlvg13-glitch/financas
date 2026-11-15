import { Repo } from '../../src/data/db'
import { AuthError, NetworkError } from '../../src/google/drive'
import { syncOnce } from '../../src/sync/sync'
import { emptyDoc, type DataDoc, type Transaction } from '../../src/domain/types'

let n = 0
const newRepo = () => new Repo(`sync-${++n}-${Math.random()}`)
const base = { kind: 'despesa' as const, amountCents: 1000, date: '2026-11-01', categoryId: 'cat-outros', accountId: 'a1' }

class FakeDrive {
  file: DataDoc = emptyDoc()
  async download() { return structuredClone(this.file) }
  async upload(_id: string, doc: DataDoc) { this.file = structuredClone(doc) }
}

test('envia lançamentos locais', async () => {
  const repo = newRepo(), drive = new FakeDrive()
  await repo.put<Transaction>('transactions', { ...base, id: 't1', profileId: 'u1' }, 'u1')
  expect(await syncOnce(repo, drive, 'F')).toBe('ok')
  expect(drive.file.records.transactions.t1).toBeDefined()
  expect(await repo.isDirty()).toBe(false)
})

test('traz lançamentos do outro aparelho', async () => {
  const repo = newRepo(), drive = new FakeDrive()
  drive.file.records.transactions.t2 = { ...base, id: 't2', profileId: 'u2', updatedAt: 5, updatedBy: 'u2' } as Transaction
  await syncOnce(repo, drive, 'F')
  expect((await repo.list('transactions')).map(t => t.id)).toEqual(['t2'])
})

test('upload concorrente é recuperado na próxima sincronização', async () => {
  const a = newRepo(), b = newRepo(), drive = new FakeDrive()
  await a.put<Transaction>('transactions', { ...base, id: 'tA', profileId: 'u1' }, 'u1')
  await b.put<Transaction>('transactions', { ...base, id: 'tB', profileId: 'u2' }, 'u2')
  // B baixa antes de A enviar; A envia; B envia por cima (sem tA).
  const snapshotForB = await drive.download()
  await syncOnce(a, drive, 'F')
  await b.importDoc(snapshotForB)
  await drive.upload('F', await b.exportDoc())
  expect(drive.file.records.transactions.tA).toBeUndefined()
  // Próxima sincronização de A devolve tA.
  await syncOnce(a, drive, 'F')
  expect(Object.keys(drive.file.records.transactions).sort()).toEqual(['tA', 'tB'])
})

test('401 marca necessidade de login e mantém dados locais', async () => {
  const repo = newRepo()
  await repo.put<Transaction>('transactions', { ...base, id: 't1', profileId: 'u1' }, 'u1')
  const drive = { download: async () => { throw new AuthError() }, upload: async () => {} }
  expect(await syncOnce(repo, drive, 'F')).toBe('precisa-login')
  expect(await repo.list('transactions')).toHaveLength(1)
  expect(await repo.isDirty()).toBe(true)
})

test('sem rede fica offline e tenta depois', async () => {
  const repo = newRepo()
  const drive = { download: async () => { throw new NetworkError() }, upload: async () => {} }
  expect(await syncOnce(repo, drive, 'F')).toBe('offline')
})

test('lançamento feito durante o envio continua marcado para enviar', async () => {
  const repo = newRepo(), drive = new FakeDrive()
  const slow = {
    download: () => drive.download(),
    upload: async (id: string, doc: DataDoc) => {
      await repo.put<Transaction>('transactions', { ...base, id: 'late', profileId: 'u1' }, 'u1')
      await drive.upload(id, doc)
    },
  }
  await syncOnce(repo, slow, 'F')
  expect(await repo.isDirty()).toBe(true)
})
