import Dexie, { type Table } from 'dexie'
import { mergeDocs } from '../domain/merge'
import { defaultCategories, defaultProfiles } from '../domain/defaults'
import { COLLECTIONS, emptyDoc, type AnyRecord, type Collection, type DataDoc, type Meta, type ProfileId, type Transaction } from '../domain/types'

export interface DeviceConfig { profileId?: ProfileId; dataFileId?: string; folderId?: string }

type Linkable = 'accounts' | 'cards' | 'categories'

class FinDB extends Dexie {
  device!: Table<{ k: string; v: DeviceConfig }, string>
  state!: Table<{ k: string; v: unknown }, string>
  constructor(name: string) {
    super(name)
    const stores: Record<string, string> = { device: 'k', state: 'k' }
    for (const c of COLLECTIONS) stores[c] = 'id'
    this.version(1).stores(stores)
  }
  coll(c: Collection): Table<AnyRecord, string> { return this.table(c) }
}

const linkedTo = (c: Linkable, id: string) => (t: Transaction) =>
  !t.deletedAt && (
    c === 'accounts' ? t.accountId === id :
    c === 'cards' ? t.cardId === id || t.cardPayment?.cardId === id :
    t.categoryId === id
  )

export class Repo {
  private db: FinDB
  private listeners = new Set<() => void>()

  constructor(dbName = 'financas-familia') { this.db = new FinDB(dbName) }

  /** Avisa quem desenha a tela que os dados mudaram. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private changed() { this.listeners.forEach(f => f()) }

  private async write(c: Collection, rec: AnyRecord) {
    await this.db.transaction('rw', this.db.coll(c), this.db.state, async () => {
      await this.db.coll(c).put(rec)
      await this.db.state.put({ k: 'dirty', v: true })
    })
  }

  private stamp(by: ProfileId) {
    return { updatedAt: Date.now(), updatedBy: by }
  }

  async put<T extends Meta>(c: Collection, rec: Omit<T, 'updatedAt' | 'updatedBy' | 'id'> & { id?: string }, by: ProfileId): Promise<T> {
    const prev = rec.id ? await this.db.coll(c).get(rec.id) : undefined
    // updatedAt sempre maior que o anterior, mesmo com relógio igual.
    const stamp = this.stamp(by)
    if (prev && stamp.updatedAt <= prev.updatedAt) stamp.updatedAt = prev.updatedAt + 1
    const full = { ...rec, id: rec.id ?? crypto.randomUUID(), ...stamp } as unknown as T & AnyRecord
    delete (full as Partial<Meta>).deletedAt
    await this.write(c, full)
    this.changed()
    return full
  }

  async get<T extends Meta>(c: Collection, id: string): Promise<T | undefined> {
    const r = await this.db.coll(c).get(id)
    return r && !r.deletedAt ? (r as unknown as T) : undefined
  }

  private async setDeleted(c: Collection, id: string, by: ProfileId, deleted: boolean) {
    const prev = await this.db.coll(c).get(id)
    if (!prev) return
    const stamp = this.stamp(by)
    if (stamp.updatedAt <= prev.updatedAt) stamp.updatedAt = prev.updatedAt + 1
    const next: AnyRecord = { ...prev, ...stamp }
    if (deleted) next.deletedAt = stamp.updatedAt
    else delete next.deletedAt
    await this.write(c, next)
  }

  async remove(c: Collection, id: string, by: ProfileId): Promise<void> {
    await this.setDeleted(c, id, by, true)
    this.changed()
  }

  async restore(c: Collection, id: string, by: ProfileId): Promise<void> {
    await this.setDeleted(c, id, by, false)
    this.changed()
  }

  async countLinked(c: Linkable, id: string): Promise<number> {
    const txs = (await this.db.coll('transactions').toArray()) as unknown as Transaction[]
    return txs.filter(linkedTo(c, id)).length
  }

  /** Exclui o item e os lançamentos ligados (ou move-os, para categorias). Retorna os ids afetados. */
  async removeCascade(c: Linkable, id: string, by: ProfileId, opts: { moveToCategoryId?: string } = {}): Promise<string[]> {
    const txs = ((await this.db.coll('transactions').toArray()) as unknown as Transaction[]).filter(linkedTo(c, id))
    const affected: string[] = [id]
    for (const t of txs) {
      if (c === 'categories' && opts.moveToCategoryId) {
        await this.put<Transaction>('transactions', { ...t, categoryId: opts.moveToCategoryId }, by)
      } else {
        await this.setDeleted('transactions', t.id, by, true)
        affected.push(t.id)
      }
    }
    await this.setDeleted(c, id, by, true)
    this.changed()
    return affected
  }

  async list<T extends Meta = AnyRecord>(c: Collection): Promise<T[]> {
    const all = await this.db.coll(c).toArray()
    return all.filter(r => !r.deletedAt) as unknown as T[]
  }

  async exportDoc(): Promise<DataDoc> {
    const doc = emptyDoc()
    for (const c of COLLECTIONS) {
      for (const r of await this.db.coll(c).toArray()) doc.records[c][r.id] = r
    }
    return doc
  }

  async importDoc(remote: DataDoc): Promise<void> {
    const merged = mergeDocs(await this.exportDoc(), remote)
    await this.db.transaction('rw', COLLECTIONS.map(c => this.db.coll(c)), async () => {
      for (const c of COLLECTIONS) await this.db.coll(c).bulkPut(Object.values(merged.records[c]))
    })
    this.changed()
  }

  async isDirty(): Promise<boolean> {
    return (await this.db.state.get('dirty'))?.v === true
  }

  async markClean(): Promise<void> {
    await this.db.state.put({ k: 'dirty', v: false })
  }

  async ensureDefaults(by: ProfileId): Promise<void> {
    // Carimbo 0: os padrões sempre perdem para qualquer edição real vinda de outro aparelho.
    const now = 0
    for (const p of defaultProfiles(now)) {
      if (!(await this.db.coll('profiles').get(p.id))) await this.write('profiles', { ...p, updatedBy: by })
    }
    for (const cat of defaultCategories(now)) {
      if (!(await this.db.coll('categories').get(cat.id))) await this.write('categories', { ...cat, updatedBy: by })
    }
    this.changed()
  }

  async getDevice(): Promise<DeviceConfig> {
    return (await this.db.device.get('cfg'))?.v ?? {}
  }

  async setDevice(patch: DeviceConfig): Promise<void> {
    await this.db.device.put({ k: 'cfg', v: { ...(await this.getDevice()), ...patch } })
    this.changed()
  }
}
