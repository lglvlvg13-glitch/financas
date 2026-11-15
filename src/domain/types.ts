export type ProfileId = 'u1' | 'u2'

/** Campos que todo registro sincronizado carrega. */
export interface Meta {
  id: string
  updatedAt: number
  updatedBy: ProfileId
  deletedAt?: number
}

export interface Profile extends Meta { id: ProfileId; name: string }

export interface Account extends Meta {
  name: string
  kind: 'corrente' | 'poupanca' | 'carteira'
  initialBalanceCents: number
}

export interface Category extends Meta {
  name: string
  kind: 'receita' | 'despesa'
  monthlyBudgetCents?: number
  system?: boolean
}

export interface Card extends Meta {
  name: string
  limitCents: number
  closingDay: number
  dueDay: number
}

export interface Transaction extends Meta {
  kind: 'receita' | 'despesa'
  /** Sempre positivo. */
  amountCents: number
  /** Data da compra ou do lançamento, YYYY-MM-DD. */
  date: string
  categoryId: string
  profileId: ProfileId
  /** Obrigatório quando não há cardId. */
  accountId?: string
  /** Compra no cartão. */
  cardId?: string
  /** Mês (YYYY-MM) em que a fatura fecha; só para compras no cartão. */
  invoiceMonth?: string
  installment?: { groupId: string; n: number; total: number }
  /** Pagamento de fatura. */
  cardPayment?: { cardId: string; invoiceMonth: string }
  recurrenceId?: string
  note?: string
}

export type TransactionDraft = Omit<Transaction, keyof Meta>

export interface Recurrence extends Meta {
  template: Omit<Transaction, keyof Meta | 'date' | 'recurrenceId' | 'invoiceMonth' | 'installment'>
  dayOfMonth: number
  startMonth: string
  endMonth?: string
}

export type Collection = 'profiles' | 'accounts' | 'categories' | 'cards' | 'transactions' | 'recurrences'

export const COLLECTIONS: Collection[] = ['profiles', 'accounts', 'categories', 'cards', 'transactions', 'recurrences']

export type AnyRecord = Meta & Record<string, unknown>

export interface DataDoc {
  schemaVersion: 1
  records: { [C in Collection]: Record<string, AnyRecord> }
}

export const emptyDoc = (): DataDoc => ({
  schemaVersion: 1,
  records: { profiles: {}, accounts: {}, categories: {}, cards: {}, transactions: {}, recurrences: {} },
})
