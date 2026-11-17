import type { Repo } from './data/db'
import type { DriveLike } from './ui/context'
import { addMonths, clampDay, monthOf, today } from './domain/dates'
import { buildInstallments, invoiceMonthFor } from './domain/invoice'
import { emptyDoc, type Account, type Card, type Category, type DataDoc, type Profile, type Recurrence, type Transaction } from './domain/types'

/** Drive de mentira para a demonstração: guarda o arquivo na memória. */
export class DemoDrive implements DriveLike {
  private file: DataDoc = emptyDoc()
  async ensureFolder() { return 'DEMO' }
  async findOrCreateFile() { return 'DEMO' }
  async download() { return structuredClone(this.file) }
  async upload(_id: string, doc: DataDoc) { this.file = structuredClone(doc) }
  blobs = new Map<string, Blob>()
  async uploadBlob(_folder: string, _name: string, blob: Blob) { const id = `B${this.blobs.size + 1}`; this.blobs.set(id, blob); return id }
  async downloadBlob(id: string) { const b = this.blobs.get(id); if (!b) throw new Error('Arquivo não encontrado'); return b }
  async trash(id: string) { this.blobs.delete(id) }
}

/** Dados de exemplo, gravados só na primeira abertura deste navegador: o ano até hoje, com contas pagas, previstas e atrasadas. */
export async function seedDemo(repo: Repo): Promise<void> {
  if ((await repo.getDevice()).dataFileId) return
  await repo.ensureDefaults('u1')
  await repo.put<Profile>('profiles', { id: 'u1', name: 'Ana' }, 'u1')
  await repo.put<Profile>('profiles', { id: 'u2', name: 'Bruno' }, 'u1')
  for (const [id, name] of [['cat-salario-u1', 'Salário Ana'], ['cat-salario-u2', 'Salário Bruno']] as const) {
    const c = await repo.get<Category>('categories', id)
    if (c) await repo.put<Category>('categories', { ...c, name }, 'u1')
  }
  for (const [id, b] of [['cat-alimentacao', 150000], ['cat-moradia', 230000], ['cat-lazer', 50000], ['cat-servicos', 70000]] as const) {
    const c = await repo.get<Category>('categories', id)
    if (c) await repo.put<Category>('categories', { ...c, monthlyBudgetCents: b }, 'u1')
  }
  await repo.put<Account>('accounts', { id: 'demo-itau', name: 'Itaú', kind: 'corrente', initialBalanceCents: 350000 }, 'u1')
  await repo.put<Account>('accounts', { id: 'demo-pix', name: 'Pix Bruno', kind: 'pix', initialBalanceCents: 80000 }, 'u1')
  const card = await repo.put<Card>('cards', { id: 'demo-nu', name: 'Nubank', limitCents: 800000, closingDay: 28, dueDay: 5 }, 'u1')

  const now = today()
  const thisMonth = monthOf(now)
  const todayDay = Number(now.slice(8, 10))
  const year = now.slice(0, 4)
  const put = (t: Partial<Transaction>) => repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 0, date: now, categoryId: 'cat-emergencias', profileId: 'u1', accountId: 'demo-itau', ...t,
  } as Transaction, 'u1')
  const wobble = (base: number, i: number, amp: number) => Math.round(base + Math.sin(i * 1.7) * amp)

  // Meses anteriores do ano: tudo pago.
  let i = 0
  for (let m = `${year}-01`; m < thisMonth; m = addMonths(m, 1), i++) {
    const d = (day: number) => clampDay(m, day)
    await put({ kind: 'receita', amountCents: 620000, categoryId: 'cat-salario-u1', date: d(5), note: 'Salário' })
    await put({ kind: 'receita', amountCents: 450000, categoryId: 'cat-salario-u2', date: d(5), profileId: 'u2', accountId: 'demo-pix', note: 'Salário' })
    await put({ amountCents: 220000, categoryId: 'cat-moradia', date: d(5), note: 'Aluguel' })
    await put({ amountCents: wobble(26000, i, 4000), categoryId: 'cat-servicos', item: 'Energia elétrica', date: d(10) })
    await put({ amountCents: wobble(118000, i, 18000), categoryId: 'cat-alimentacao', item: 'Supermercado', date: d(12), profileId: i % 2 ? 'u2' : 'u1' })
    await put({ amountCents: wobble(21000, i + 1, 8000), categoryId: 'cat-alimentacao', item: 'Restaurantes e delivery', date: d(18), profileId: 'u2', cardId: undefined })
    await put({ amountCents: wobble(31000, i + 2, 9000), categoryId: 'cat-transporte', date: d(15), profileId: 'u2', accountId: 'demo-pix', note: 'Combustível' })
    await put({ amountCents: 98000, categoryId: 'cat-educacao', date: d(25), note: 'Escola' })
    await put({ amountCents: wobble(38000, i + 4, 20000), categoryId: 'cat-lazer', date: d(20), profileId: 'u2', note: 'Passeio' })
    await put({ kind: 'investimento', amountCents: 50000, categoryId: 'cat-inv-caixinha-1', date: d(6), note: 'Reserva' })
    if (i % 3 === 0) await put({ kind: 'investimento', amountCents: 30000, categoryId: 'cat-inv-poupanca', date: d(7), profileId: 'u2', accountId: 'demo-pix' })
  }

  // Mês atual: pago, previsto e atrasado, como na planilha.
  const d = (day: number) => clampDay(thisMonth, day)
  const past = (day: number) => d(Math.min(day, todayDay))
  await put({ kind: 'receita', amountCents: 620000, categoryId: 'cat-salario-u1', date: past(5), note: 'Salário' })
  await put({ kind: 'receita', amountCents: 450000, categoryId: 'cat-salario-u2', date: past(5), profileId: 'u2', accountId: 'demo-pix', note: 'Salário' })
  await put({ amountCents: 220000, categoryId: 'cat-moradia', date: past(5), note: 'Aluguel' })
  await put({ amountCents: 28740, categoryId: 'cat-servicos', item: 'Energia elétrica', date: d(Math.max(1, todayDay - 3)), pending: true })
  await put({ amountCents: 41200, categoryId: 'cat-seguros', date: d(Math.max(1, todayDay - 1)), profileId: 'u2', pending: true, note: 'IPVA' })
  await put({ amountCents: 61290, categoryId: 'cat-alimentacao', item: 'Supermercado', date: past(9), profileId: 'u2' })
  await put({ amountCents: 14890, categoryId: 'cat-alimentacao', item: 'Restaurantes e delivery', date: past(7), profileId: 'u2', note: 'Pizza' })
  await put({ amountCents: 15400, categoryId: 'cat-saude', date: past(8), note: 'Farmácia' })
  await put({ amountCents: 98000, categoryId: 'cat-educacao', date: d(Math.min(28, todayDay + 9)), pending: true, note: 'Escola' })
  await put({ kind: 'investimento', amountCents: 50000, categoryId: 'cat-inv-caixinha-1', date: d(Math.min(28, todayDay + 4)), pending: true, note: 'Reserva' })
  await put({ amountCents: 3990, categoryId: 'cat-lazer', date: past(2), accountId: undefined, cardId: card.id, invoiceMonth: invoiceMonthFor(past(2), card.closingDay), note: 'Streaming' })
  await put({ amountCents: 18500, categoryId: 'cat-lazer', date: past(10), profileId: 'u2', accountId: undefined, cardId: card.id, invoiceMonth: invoiceMonthFor(past(10), card.closingDay), note: 'Cinema e jantar' })
  for (const p of buildInstallments({ kind: 'despesa', amountCents: 240000, date: past(5), categoryId: 'cat-moradia', profileId: 'u1', cardId: card.id, note: 'Geladeira' }, card, 6, 'demo-geladeira')) {
    await repo.put<Transaction>('transactions', p, 'u1')
  }

  // Recorrentes a partir do mês que vem (chegam como Previsto).
  const next = addMonths(thisMonth, 1)
  const rec = (id: string, dia: number, t: Recurrence['template'], months?: number) =>
    repo.put<Recurrence>('recurrences', { id, dayOfMonth: dia, startMonth: next, ...(months ? { endMonth: addMonths(next, months - 1) } : {}), template: t }, 'u1')
  await rec('demo-sal-ana', 5, { kind: 'receita', amountCents: 620000, categoryId: 'cat-salario-u1', profileId: 'u1', accountId: 'demo-itau', note: 'Salário' })
  await rec('demo-sal-bruno', 5, { kind: 'receita', amountCents: 450000, categoryId: 'cat-salario-u2', profileId: 'u2', accountId: 'demo-pix', note: 'Salário' })
  await rec('demo-aluguel', 5, { kind: 'despesa', amountCents: 220000, categoryId: 'cat-moradia', profileId: 'u1', accountId: 'demo-itau', note: 'Aluguel' })
  await rec('demo-escola', 25, { kind: 'despesa', amountCents: 98000, categoryId: 'cat-educacao', profileId: 'u1', accountId: 'demo-itau', note: 'Escola' }, 12)
  await rec('demo-reserva', 6, { kind: 'investimento', amountCents: 50000, categoryId: 'cat-inv-caixinha-1', profileId: 'u1', accountId: 'demo-itau', note: 'Reserva' })
  await repo.setDevice({ dataFileId: 'DEMO', folderId: 'DEMO', profileId: 'u1' })
}
