import { Accounts } from './Accounts'
import { Categories } from './Categories'
import { Recurrences } from './Recurrences'
import { Transactions } from './Transactions'

export type Page = 'resumo' | 'lancamentos' | 'cartoes' | 'contas' | 'ajustes' | 'categorias' | 'recorrentes'

export function Pages({ page }: { page: Exclude<Page, 'ajustes'>; go: (p: Page) => void }) {
  switch (page) {
    case 'lancamentos': return <Transactions />
    case 'contas': return <Accounts />
    case 'categorias': return <Categories />
    case 'recorrentes': return <Recurrences />
    default: return <h1>{page}</h1>
  }
}
