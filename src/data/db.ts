import Dexie, { type Table } from 'dexie'
import { mergeDocs } from '../domain/merge'
import { defaultCategories, defaultProfiles } from '../domain/defaults'
import { COLLECTIONS, emptyDoc, type AnyRecord, type Collection, type DataDoc, type Meta, type ProfileId, type Recurrence, type Transaction } from '../domain/types'

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

/** Lançamentos que somem junto com a conta/cartão/categoria. Pagamentos de fatura ficam:
 *  são dinheiro que saiu de uma conta e mantêm a fatura paga. */
const linkedTo = (c: Linkable, id: string) => (t: Transaction) =>
  !t.deletedAt && !t.cardPayment && (
    c === 'accounts' ? t.accountId === id :
    c === 'cards' ? t.cardId === id :
    t.categoryId === id
  )

const recLinkedTo = (c: Linkable, id: string) => (r: Recurrence) =>
  !r.deletedAt && (
    c === 'accounts' ? r.template.accountId === id :
    c === 'cards' ? r.template.cardId === id :
    r.template.categoryId === id
  )

export type Affected = Array<[Collection, string]>

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
      const gen = ((await this.db.state.get('gen'))?.v as number | undefined) ?? 0
      await this.db.state.put({ k: 'gen', v: gen + 1 })
    })
  }

  private stamp(by: ProfileId) {
    return { updatedAt: Date.now(), updatedBy: by }
  }

  async put<T extends Meta>(c: Collection, rec: Omit<T, 'updatedAt' | 'updatedBy' | 'id'> & { id?: string }, by: ProfileId): Promise<T> {
    let full!: T & AnyRecord
    await this.db.transaction('rw', this.db.coll(c), this.db.state, async () => {
      const prev = rec.id ? await this.db.coll(c).get(rec.id) : undefined
      // updatedAt sempre maior que o anterior, mesmo com relógio igual.
      const stamp = this.stamp(by)
      if (prev && stamp.updatedAt <= prev.updatedAt) stamp.updatedAt = prev.updatedAt + 1
      full = { ...rec, id: rec.id ?? crypto.randomUUID(), ...stamp } as unknown as T & AnyRecord
      delete (full as Partial<Meta>).deletedAt
      await this.write(c, full)
    })
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

  /** Exclui o item, os lançamentos e recorrências ligados (ou move-os, para categorias).
   *  Retorna tudo o que foi excluído, para o Desfazer. */
  async removeCascade(c: Linkable, id: string, by: ProfileId, opts: { moveToCategoryId?: string } = {}): Promise<Affected> {
    const move = c === 'categories' ? opts.moveToCategoryId : undefined
    const affected: Affected = [[c, id]]
    const txs = ((await this.db.coll('transactions').toArray()) as unknown as Transaction[]).filter(linkedTo(c, id))
    for (const t of txs) {
      if (move) await this.put<Transaction>('transactions', { ...t, categoryId: move }, by)
      else { await this.setDeleted('transactions', t.id, by, true); affected.push(['transactions', t.id]) }
    }
    const recs = ((await this.db.coll('recurrences').toArray()) as unknown as Recurrence[]).filter(recLinkedTo(c, id))
    for (const r of recs) {
      if (move) await this.put<Recurrence>('recurrences', { ...r, template: { ...r.template, categoryId: move } }, by)
      else { await this.setDeleted('recurrences', r.id, by, true); affected.push(['recurrences', r.id]) }
    }
    await this.setDeleted(c, id, by, true)
    this.changed()
    return affected
  }

  async restoreAll(items: Affected, by: ProfileId): Promise<void> {
    for (const [c, id] of items) await this.setDeleted(c, id, by, false)
    this.changed()
  }

  /** Grava um registro gerado pelo app (id fixo, carimbo 0) só se ainda não existir, nem como lápide.
   *  Carimbo 0 faz qualquer edição real, de qualquer aparelho, vencer a junção. */
  async putGenerated(c: Collection, rec: AnyRecord): Promise<boolean> {
    let wrote = false
    await this.db.transaction('rw', this.db.coll(c), this.db.state, async () => {
      if (await this.db.coll(c).get(rec.id)) return
      await this.db.coll(c).put({ ...rec, updatedAt: 0 })
      const gen = ((await this.db.state.get('gen'))?.v as number | undefined) ?? 0
      await this.db.state.put({ k: 'gen', v: gen + 1 })
      wrote = true
    })
    if (wrote) this.changed()
    return wrote
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
    // Leitura, junção e gravação numa transação só: uma gravação local não pode cair no meio.
    await this.db.transaction('rw', COLLECTIONS.map(c => this.db.coll(c)), async () => {
      const local = emptyDoc()
      for (const c of COLLECTIONS) {
        for (const r of await this.db.coll(c).toArray()) local.records[c][r.id] = r
      }
      const merged = mergeDocs(local, remote)
      for (const c of COLLECTIONS) await this.db.coll(c).bulkPut(Object.values(merged.records[c]))
    })
    this.changed()
  }

  /** Contador de gravações locais; usado para saber se algo mudou durante um envio. */
  async generation(): Promise<number> {
    return ((await this.db.state.get('gen'))?.v as number | undefined) ?? 0
  }

  async isDirty(): Promise<boolean> {
    const clean = ((await this.db.state.get('cleanGen'))?.v as number | undefined) ?? 0
    return (await this.generation()) > clean
  }

  /** Marca como enviado tudo o que foi gravado até `upTo` (padrão: agora). */
  async markClean(upTo?: number): Promise<void> {
    await this.db.state.put({ k: 'cleanGen', v: upTo ?? (await this.generation()) })
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
