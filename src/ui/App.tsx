import { useState } from 'react'
import { AppProvider, useApp, type AppDeps } from './context'
import { Welcome, WhoAreYou } from './Onboarding'
import { Settings } from './Settings'
import { SyncBanner } from './SyncBanner'
import { UndoProvider } from './UndoToast'
import { Pages, type Page } from './pages'
import { LockScreen, useLockState } from './Lock'
import { useDueNotifications } from './Reminders'

const NAV: Array<[Page, string]> = [
  ['painel', 'Painel'],
  ['resumo', 'Resumo'],
  ['lancamentos', 'Lançamentos'],
  ['cartoes', 'Cartões'],
  ['mais', 'Mais'],
]

/** Telas que ficam dentro de "Mais". */
const UNDER_MAIS: Page[] = ['contas', 'relatorio', 'ajustes', 'categorias', 'recorrentes']

function Shell() {
  const { device } = useApp()
  const [page, setPage] = useState<Page>('painel')
  const [locked, unlock] = useLockState()
  useDueNotifications()

  if (!device) return null
  if (!device.dataFileId) return <Welcome />
  if (!device.profileId) return <WhoAreYou />
  if (locked) return <LockScreen onUnlock={unlock} />

  const navPage: Page = UNDER_MAIS.includes(page) ? 'mais' : page === 'importar' ? 'lancamentos' : page
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
