import type { SyncStatus } from '../sync/sync'
import { useApp } from './context'

export const SYNC_TEXT: Record<SyncStatus, string> = {
  ok: 'Sincronizado.',
  sincronizando: 'Sincronizando…',
  offline: 'Sem internet — o que você lançar fica salvo no aparelho e é enviado depois.',
  'precisa-login': 'Entre de novo para sincronizar. Nada do que foi lançado se perde.',
  erro: 'O Google Drive não respondeu. O app tenta de novo em 1 minuto.',
}

/** Aviso no topo só quando a sincronização precisa de atenção. */
export function SyncBanner() {
  const { syncStatus, signIn } = useApp()
  if (syncStatus !== 'precisa-login' && syncStatus !== 'offline' && syncStatus !== 'erro') return null
  return (
    <div className="banner aviso" role="status">
      <span>{SYNC_TEXT[syncStatus]}</span>
      {syncStatus === 'precisa-login' && <button onClick={() => void signIn()}>Entrar</button>}
    </div>
  )
}
