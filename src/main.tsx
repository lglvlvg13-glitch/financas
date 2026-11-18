import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles.css'
import App from './ui/App'
import { Repo } from './data/db'
import { DriveClient } from './google/drive'
import { requestToken } from './google/auth'
import type { AppDeps } from './ui/context'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const demo = import.meta.env.VITE_DEMO === '1'

async function start() {
  let deps: AppDeps
  if (demo) {
    const { DemoDrive, seedDemo } = await import('./demo')
    const repo = new Repo('financas-familia-demo-6')
    await seedDemo(repo)
    const drive = new DemoDrive()
    deps = {
      repo,
      requestToken: async () => ({ accessToken: 'demo', expiresAt: Date.now() + 365 * 86_400_000 }),
      makeDrive: () => drive,
    }
  } else {
    deps = {
      repo: new Repo(),
      requestToken: () => {
        if (!clientId) return Promise.reject(new Error('Falta configurar o VITE_GOOGLE_CLIENT_ID (veja o README)'))
        return requestToken(clientId)
      },
      makeDrive: getToken => new DriveClient(getToken),
    }
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {demo && <div className="demo-bar" role="note">Demonstração com dados de exemplo. Nada vai para o Google Drive; o que você lançar fica só neste navegador.</div>}
      <App deps={deps} />
    </StrictMode>,
  )
}
void start()
