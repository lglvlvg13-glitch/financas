import { useState } from 'react'
import { AppProvider, useApp, type AppDeps } from './context'
import { Welcome, WhoAreYou } from './Onboarding'
import { Settings } from './Settings'
import { SyncBanner } from './SyncBanner'
import { UndoProvider } from './UndoToast'
import { Pages, type Page } from './pages'

const NAV: Array<[Page, string]> = [
  ['resumo', 'Resumo'],
  ['lancamentos', 'Lançamentos'],
  ['cartoes', 'Cartões'],
  ['contas', 'Contas'],
  ['ajustes', 'Ajustes'],
]

function Shell() {
  const { device } = useApp()
  const [page, setPage] = useState<Page>('resumo')

  if (!device) return null
  if (!device.dataFileId) return <Welcome />
  if (!device.profileId) return <WhoAreYou />

  const navPage: Page = page === 'categorias' || page === 'recorrentes' ? 'ajustes' : page
  return (
    <div className="shell">
      <nav className="nav" aria-label="Seções">
        <div className="brand">Finanças da Família</div>
        {NAV.map(([id, label]) => (
          <button key={id} aria-current={navPage === id ? 'page' : undefined} onClick={() => setPage(id)}>{label}</button>
        ))}
      </nav>
      <main className="main">
        <SyncBanner />
        {page === 'ajustes' ? <Settings go={setPage} /> : <Pages page={page} go={setPage} />}
      </main>
    </div>
  )
}

export default function App({ deps }: { deps: AppDeps }) {
  return (
    <AppProvider deps={deps}>
      <UndoProvider>
        <Shell />
      </UndoProvider>
    </AppProvider>
  )
}
