import { Accounts } from './Accounts'
import { Cards } from './Cards'
import { Categories } from './Categories'
import { Recurrences } from './Recurrences'
import { Summary } from './Summary'
import { Transactions } from './Transactions'
import { Dashboard } from './Dashboard'
import { YearReport } from './YearReport'
import { Import } from './Import'
import { Icon, type IconName } from './Icons'

export type Page = 'importar' | 'resumo' | 'lancamentos' | 'painel' | 'cartoes' | 'mais' | 'contas' | 'relatorio' | 'ajustes' | 'categorias' | 'recorrentes'

function More({ go }: { go: (p: Page) => void }) {
  const items: Array<[Page, string, string, IconName]> = [
    ['contas', 'Contas', 'Saldos das contas, poupança e Pix', 'conta'],
    ['relatorio', 'Relatório do ano', 'Cada categoria mês a mês, como na planilha', 'relatorio'],
    ['importar', 'Importar extrato', 'OFX ou CSV do banco e da fatura do cartão', 'importar'],
    ['ajustes', 'Ajustes', 'Perfis, categorias, recorrentes, bloqueio e tema', 'ajustes'],
  ]
  return (
    <>
      <h1>Mais</h1>
      <ul className="list more-list">
        {items.map(([id, label, sub, icon]) => (
          <li key={id}>
            <button className="row" aria-label={label} onClick={() => go(id)}>
              <span className="ico"><Icon name={icon} size={21} /></span>
              <strong>{label}</strong>
              <span className="chev"><Icon name="seta" size={18} /></span>
              <span className="sub">{sub}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}

export function Pages({ page, go }: { page: Exclude<Page, 'ajustes'>; go: (p: Page) => void }) {
  switch (page) {
    case 'lancamentos': return <Transactions go={go} />
    case 'importar': return <Import onDone={() => go('lancamentos')} />
    case 'painel': return <Dashboard go={go} />
    case 'cartoes': return <Cards />
    case 'mais': return <More go={go} />
    case 'contas': return <Accounts />
    case 'relatorio': return <YearReport />
    case 'categorias': return <Categories />
    case 'recorrentes': return <Recurrences />
    case 'resumo': return <Summary go={go} />
    default: return <Dashboard go={go} />
  }
}
