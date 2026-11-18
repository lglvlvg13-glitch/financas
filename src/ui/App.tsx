import { useEffect, useState } from 'react'
import { AppProvider, useApp, type AppDeps } from './context'
import { Welcome, WhoAreYou } from './Onboarding'
import { AppMark } from './AppMark'
import { Settings } from './Settings'
import { SyncBanner } from './SyncBanner'
import { UndoProvider } from './UndoToast'
import { Pages, type Page } from './pages'
import { LockScreen, useLockState } from './Lock'
import { useDueNotifications } from './Reminders'
import { TransactionForm } from './TransactionForm'
import { Icon, type IconName } from './Icons'
import { useProfiles } from './context'

const NAV: Array<[Page, string, IconName]> = [
  ['painel', 'Painel', 'painel'],
  ['resumo', 'Resumo', 'resumo'],
  ['lancamentos', 'Lançamentos', 'lancamentos'],
  ['cartoes', 'Cartões', 'cartoes'],
  ['mais', 'Mais', 'mais'],
]

/** Telas que ficam dentro de "Mais". */
const UNDER_MAIS: Page[] = ['contas', 'relatorio', 'ajustes', 'categorias', 'recorrentes']

function Shell() {
  const { device, me, syncStatus } = useApp()
  const names = useProfiles()
  // Atalhos do ícone do app: ?abrir=novo ou ?abrir=importar.
  const shortcut = new URLSearchParams(window.location.search).get('abrir')
  const [page, setPage] = useState<Page>(shortcut === 'importar' ? 'importar' : 'painel')
  const [adding, setAdding] = useState(shortcut === 'novo')
  const [locked, unlock] = useLockState()
  useDueNotifications(!!device?.profileId && !locked)
  useEffect(() => {
    const theme = device?.theme ?? 'auto'
    document.documentElement.dataset.theme = theme
    const dark = theme === 'escuro' || (theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0d110a' : '#f5f6f0')
  }, [device?.theme])

  if (!device) return null
  if (!device.dataFileId) return <Welcome />
  if (!device.profileId) return <WhoAreYou />
  if (locked) return <LockScreen onUnlock={unlock} />

  const navPage: Page = UNDER_MAIS.includes(page) ? 'mais' : page === 'importar' ? 'lancamentos' : page
  const syncOk = !syncStatus || syncStatus === 'ok' || syncStatus === 'sincronizando'
  return (
    <div className="shell">
      <div className="tabbar">
        <div className="brand mark"><AppMark className="mark-ico" />Finanças da Família</div>
        <button className="add-btn" aria-label="Novo lançamento" onClick={() => setAdding(true)}>
          <Icon name="plus" size={26} strokeWidth={2.4} /><span className="add-label">Novo lançamento</span>
        </button>
        <nav className="nav" aria-label="Seções">
          {NAV.map(([id, label, icon]) => (
            <button key={id} aria-current={navPage === id ? 'page' : undefined} onClick={() => setPage(id)}>
              <Icon name={icon} size={22} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
      <header className="appbar">
        <span className="mark mobile-only"><AppMark className="mark-ico" />Finanças</span>
        <span />
        <button className="who-chip" onClick={() => setPage('ajustes')} aria-label={`${names[me]} neste aparelho. Abrir Ajustes`}>
          <span className="av">{names[me].trim().charAt(0).toUpperCase()}</span>
          {names[me]}
          <span className={`sync-dot ${syncOk ? '' : 'warn'}`} title={syncOk ? 'Sincronizado' : 'Sincronização pendente'} />
        </button>
      </header>
      <main className="main">
        <SyncBanner />
        {page === 'ajustes' ? <Settings go={setPage} /> : <Pages page={page} go={setPage} />}
      </main>
      {adding && <TransactionForm onClose={() => setAdding(false)} />}
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
