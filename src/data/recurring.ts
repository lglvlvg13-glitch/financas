import type { Repo } from './db'
import { dueRecurrences } from '../domain/summary'
import type { Account, Card, Category, ProfileId, Recurrence, Transaction } from '../domain/types'

/** Id fixo por recorrência e mês: dois aparelhos geram o mesmo registro, e a junção fica com um só. */
export const generatedId = (recurrenceId: string, month: string) => `rec:${recurrenceId}:${month}`

/** Gera os lançamentos recorrentes que faltam no mês. Ignora recorrências cuja conta, cartão ou categoria foi excluída. */
export async function generateRecurrences(repo: Repo, month: string, by: ProfileId): Promise<number> {
  const all = Object.values((await repo.exportDoc()).records.transactions) as Transaction[]
  const live = new Set([
    ...(await repo.list<Account>('accounts')).map(x => x.id),
    ...(await repo.list<Card>('cards')).map(x => x.id),
    ...(await repo.list<Category>('categories')).map(x => x.id),
  ])
  const recs = (await repo.list<Recurrence>('recurrences')).filter(r =>
    live.has(r.template.categoryId) &&
    (!r.template.accountId || live.has(r.template.accountId)) &&
    (!r.template.cardId || live.has(r.template.cardId)))
  let n = 0
  for (const d of dueRecurrences(recs, month, all)) {
    const id = generatedId(d.recurrenceId!, month)
    if (await repo.putGenerated('transactions', { ...d, id, updatedAt: 0, updatedBy: by } as Transaction)) n++
  }
  return n
}
