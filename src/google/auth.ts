// Adaptador fino do Google Identity Services (login no navegador, sem servidor).

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

interface TokenResponse { access_token?: string; expires_in?: number; error?: string }
interface TokenClient { requestAccessToken(opts?: { prompt?: string }): void }
declare global {
  interface Window {
    google?: { accounts: { oauth2: {
      initTokenClient(cfg: {
        client_id: string; scope: string; callback: (r: TokenResponse) => void
        error_callback?: (e: { type: string }) => void
      }): TokenClient
    } } }
  }
}

let loading: Promise<void> | undefined

export function loadGis(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => { loading = undefined; reject(new Error('Não foi possível carregar o login do Google')) }
    document.head.appendChild(s)
  })
  return loading
}

export interface Token { accessToken: string; expiresAt: number }

/** Abre o login do Google e devolve um token de acesso (guardado só em memória). */
export async function requestToken(clientId: string, opts: { prompt?: '' | 'consent' } = {}): Promise<Token> {
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: r => {
        if (r.error || !r.access_token) return reject(new Error(r.error ?? 'Login cancelado'))
        resolve({ accessToken: r.access_token, expiresAt: Date.now() + (r.expires_in ?? 3600) * 1000 })
      },
      error_callback: e => reject(new Error(e.type === 'popup_closed' ? 'Login cancelado'
        : e.type === 'popup_failed_to_open' ? 'O navegador bloqueou a janela do Google. Permita pop-ups deste site' : 'Falha no login')),
    })
    client.requestAccessToken({ prompt: opts.prompt ?? '' })
  })
}
