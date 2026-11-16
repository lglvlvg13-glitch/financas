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
  kind: 'corrente' | 'poupanca' | 'carteira' | 'pix'
  initialBalanceCents: number
}

export type TxKind = 'receita' | 'despesa' | 'investimento'

export interface Category extends Meta {
  name: string
  kind: TxKind
  /** Classificação do método 50/30/20 (só despesas). Sem valor = Desejo, como na planilha. */
  group?: 'necessidade' | 'desejo'
  /** Itens da categoria (ex.: Supermercado, Restaurantes), cada um com sua classificação no 50/30/20. */
  items?: Array<{ name: string; group: 'necessidade' | 'desejo' }>
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
  kind: TxKind
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
  /** Ainda não pago/recebido: `date` é o vencimento. Sem este campo o lançamento está pago. */
  pending?: true
  /** Data em que foi pago, quando diferente do vencimento. */
  paidDate?: string
  /** Necessidade ou Desejo só deste lançamento (ex.: mercado x restaurante, ambos em Alimentação).
   *  Sem valor, vale o da categoria. */
  group?: 'necessidade' | 'desejo'
  /** Item da categoria escolhido (ex.: "Restaurantes e delivery"). */
  item?: string
}

export type TransactionDraft = Omit<Transaction, keyof Meta>

export interface Recurrence extends Meta {
  template: Omit<Transaction, keyof Meta | 'date' | 'recurrenceId' | 'invoiceMonth' | 'installment'>
  dayOfMonth: number
  startMonth: string
  endMonth?: string
}

/** Preferências da família, sincronizadas (registro único id 'app'). */
export interface Settings extends Meta {
  methodId?: string
}

export type Collection = 'profiles' | 'accounts' | 'categories' | 'cards' | 'transactions' | 'recurrences' | 'settings'

export const COLLECTIONS: Collection[] = ['profiles', 'accounts', 'categories', 'cards', 'transactions', 'recurrences', 'settings']

/** Qualquer registro sincronizado (os campos extras variam por coleção). */
export type AnyRecord = Meta

export interface DataDoc {
  schemaVersion: 1
  records: { [C in Collection]: Record<string, AnyRecord> }
}

export const emptyDoc = (): DataDoc => ({
  schemaVersion: 1,
  records: { profiles: {}, accounts: {}, categories: {}, cards: {}, transactions: {}, recurrences: {}, settings: {} },
})
