import { Accounts } from './Accounts'
import { Cards } from './Cards'
import { Categories } from './Categories'
import { Recurrences } from './Recurrences'
import { Summary } from './Summary'
import { Transactions } from './Transactions'
import { Dashboard } from './Dashboard'
import { YearReport } from './YearReport'
import { Import } from './Import'

export type Page = 'importar' | 'resumo' | 'lancamentos' | 'painel' | 'cartoes' | 'mais' | 'contas' | 'relatorio' | 'ajustes' | 'categorias' | 'recorrentes'

function More({ go }: { go: (p: Page) => void }) {
  return (
    <>
      <h1>Mais</h1>
      <ul className="list" style={{ marginTop: 16 }}>
        <li><button className="row" aria-label="Contas" onClick={() => go('contas')}><strong>Contas</strong><span className="sub">Saldos das contas, poupança e Pix</span></button></li>
        <li><button className="row" aria-label="Relatório do ano" onClick={() => go('relatorio')}><strong>Relatório do ano</strong><span className="sub">Cada categoria mês a mês, como na planilha</span></button></li>
        <li><button className="row" aria-label="Ajustes" onClick={() => go('ajustes')}><strong>Ajustes</strong><span className="sub">Perfis, categorias, recorrentes e sincronização</span></button></li>
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
