import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/styles.css'
import App from './ui/App'
import { Repo } from './data/db'
import { DriveClient } from './google/drive'
import { requestToken } from './google/auth'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App deps={{
      repo: new Repo(),
      requestToken: () => {
        if (!clientId) return Promise.reject(new Error('Falta configurar o VITE_GOOGLE_CLIENT_ID (veja o README)'))
        return requestToken(clientId)
      },
      makeDrive: getToken => new DriveClient(getToken),
    }} />
  </StrictMode>,
)
