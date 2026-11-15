import type { Repo } from '../data/db'
import { AuthError, NetworkError, type DriveClient } from '../google/drive'

export type SyncStatus = 'ok' | 'offline' | 'precisa-login' | 'sincronizando' | 'erro'

/** Baixa o arquivo do Drive, junta com o local e regrava. Nunca descarta dados locais. */
export async function syncOnce(repo: Repo, drive: Pick<DriveClient, 'download' | 'upload'>, fileId: string): Promise<SyncStatus> {
  try {
    const remote = await drive.download(fileId)
    await repo.importDoc(remote)
    const gen = await repo.generation()
    await drive.upload(fileId, await repo.exportDoc())
    await repo.markClean(gen)
    return 'ok'
  } catch (e) {
    if (e instanceof AuthError) return 'precisa-login'
    if (e instanceof NetworkError) return 'offline'
    console.error(e)
    return 'erro'
  }
}

/** Sincroniza ao iniciar, a cada 60 s, ao voltar a internet e 2 s depois de cada gravação. */
export function startAutoSync(repo: Repo, run: () => Promise<SyncStatus>, onStatus: (s: SyncStatus) => void): () => void {
  let running = false, again = false, debounce: ReturnType<typeof setTimeout> | undefined
  const go = async () => {
    if (running) { again = true; return }
    running = true
    onStatus('sincronizando')
    try { onStatus(await run()) } finally {
      running = false
      if (again) { again = false; void go() }
    }
  }
  // Só sincroniza após mudança se houver gravação local pendente (evita laço com a própria importação).
  const soon = () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => { void repo.isDirty().then(d => { if (d) void go() }) }, 2000)
  }
  const interval = setInterval(go, 60_000)
  window.addEventListener('online', go)
  const unsub = repo.subscribe(soon)
  void go()
  return () => {
    clearInterval(interval); clearTimeout(debounce)
    window.removeEventListener('online', go); unsub()
  }
}
