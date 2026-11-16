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
}

/** Dados de exemplo, gravados só na primeira abertura deste navegador. */
export async function seedDemo(repo: Repo): Promise<void> {
  if ((await repo.getDevice()).dataFileId) return
  await repo.ensureDefaults('u1')
  await repo.put<Profile>('profiles', { id: 'u1', name: 'Ana' }, 'u1')
  await repo.put<Profile>('profiles', { id: 'u2', name: 'Bruno' }, 'u1')
  for (const [id, b] of [['cat-alimentacao', 150000], ['cat-moradia', 230000], ['cat-lazer', 50000]] as const) {
    const c = await repo.get<Category>('categories', id)
    if (c) await repo.put<Category>('categories', { ...c, monthlyBudgetCents: b }, 'u1')
  }
  await repo.put<Account>('accounts', { id: 'demo-itau', name: 'Itaú', kind: 'corrente', initialBalanceCents: 350000 }, 'u1')
  await repo.put<Account>('accounts', { id: 'demo-poup', name: 'Poupança', kind: 'poupanca', initialBalanceCents: 1200000 }, 'u1')
  const card = await repo.put<Card>('cards', { id: 'demo-nu', name: 'Nubank', limitCents: 800000, closingDay: 28, dueDay: 5 }, 'u1')

  const m = monthOf(today())
  const day = (d: number) => clampDay(m, Math.min(d, Number(today().slice(8, 10))))
  const tx = (t: Partial<Transaction>) => repo.put<Transaction>('transactions', {
    kind: 'despesa', amountCents: 0, date: day(1), categoryId: 'cat-outros', profileId: 'u1', accountId: 'demo-itau', ...t,
  } as Transaction, 'u1')

  const rec = (id: string, dia: number, t: Recurrence['template']) =>
    repo.put<Recurrence>('recurrences', { id, dayOfMonth: dia, startMonth: addMonths(m, -2), template: t }, 'u1')
  await rec('demo-sal-ana', 1, { kind: 'receita', amountCents: 620000, categoryId: 'cat-salario', profileId: 'u1', accountId: 'demo-itau', note: 'Salário Ana' })
  await rec('demo-sal-bruno', 1, { kind: 'receita', amountCents: 450000, categoryId: 'cat-salario', profileId: 'u2', accountId: 'demo-itau', note: 'Salário Bruno' })
  await rec('demo-aluguel', 1, { kind: 'despesa', amountCents: 220000, categoryId: 'cat-moradia', profileId: 'u1', accountId: 'demo-itau', note: 'Aluguel' })

  await tx({ amountCents: 48730, categoryId: 'cat-alimentacao', date: day(3), note: 'Mercado' })
  await tx({ amountCents: 61290, categoryId: 'cat-alimentacao', date: day(9), profileId: 'u2', note: 'Mercado' })
  await tx({ amountCents: 9800, categoryId: 'cat-transporte', date: day(6), profileId: 'u2', note: 'Combustível' })
  await tx({ amountCents: 15400, categoryId: 'cat-saude', date: day(8), note: 'Farmácia' })
  await tx({ amountCents: 3990, categoryId: 'cat-assinaturas', date: day(2), accountId: undefined, cardId: card.id, invoiceMonth: invoiceMonthFor(day(2), card.closingDay), note: 'Streaming' })
  await tx({ amountCents: 18500, categoryId: 'cat-lazer', date: day(10), profileId: 'u2', accountId: undefined, cardId: card.id, invoiceMonth: invoiceMonthFor(day(10), card.closingDay), note: 'Cinema e jantar' })
  for (const p of buildInstallments({ kind: 'despesa', amountCents: 240000, date: day(5), categoryId: 'cat-outros', profileId: 'u1', cardId: card.id, note: 'Geladeira' }, card, 6, 'demo-geladeira')) {
    await repo.put<Transaction>('transactions', p, 'u1')
  }
  await repo.setDevice({ dataFileId: 'DEMO', folderId: 'DEMO', profileId: 'u1' })
}
