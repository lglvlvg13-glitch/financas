import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { DeviceConfig, Repo } from '../data/db'
import { AuthError, type DriveClient } from '../google/drive'
import type { Token } from '../google/auth'
import { syncOnce, startAutoSync, type SyncStatus } from '../sync/sync'
import { emptyDoc, type Collection, type Meta, type Profile, type ProfileId } from '../domain/types'

export type DriveLike = Pick<DriveClient, 'ensureFolder' | 'findOrCreateFile' | 'download' | 'upload' | 'uploadBlob' | 'downloadBlob' | 'trash'>

/** Comprovantes guardados no Drive. Falha com AuthError (entrar de novo) ou NetworkError (sem internet). */
export interface Files {
  upload(name: string, blob: Blob): Promise<string>
  open(fileId: string): Promise<Blob>
  remove(fileId: string): Promise<void>
}

export interface AppDeps {
  repo: Repo
  requestToken: () => Promise<Token>
  makeDrive: (getToken: () => Promise<string>) => DriveLike
}

interface Ctx {
  repo: Repo
  device: DeviceConfig | undefined
  me: ProfileId
  syncStatus: SyncStatus | undefined
  signIn: () => Promise<void>
  syncNow: () => Promise<void>
  setMe: (p: ProfileId) => Promise<void>
  files: Files
}

const AppCtx = createContext<Ctx | null>(null)

export function useApp(): Ctx {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp fora do AppProvider')
  return c
}

/** Lê dados do banco local e relê sempre que algo muda. */
export function useLive<T>(load: (repo: Repo) => Promise<T>, deps: unknown[] = []): T | undefined {
  const { repo } = useApp()
  const [value, setValue] = useState<T>()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(() => load(repo), [repo, ...deps])
  useEffect(() => {
    let alive = true
    const refresh = () => { void run().then(v => { if (alive) setValue(v) }) }
    refresh()
    const unsub = repo.subscribe(refresh)
    return () => { alive = false; unsub() }
  }, [repo, run])
  return value
}

export function useList<T extends Meta>(c: Collection): T[] | undefined {
  return useLive(r => r.list<T>(c), [c])
}

export function useProfiles(): Record<ProfileId, string> {
  const list = useList<Profile>('profiles')
  const names: Record<ProfileId, string> = { u1: 'Usuário 1', u2: 'Usuário 2' }
  for (const p of list ?? []) names[p.id] = p.name
  return names
}

export function AppProvider({ deps, children }: { deps: AppDeps; children: ReactNode }) {
  const { repo } = deps
  const [device, setDevice] = useState<DeviceConfig>()
  const [syncStatus, setSyncStatus] = useState<SyncStatus>()
  const token = useRef<Token | undefined>(undefined)

  const getToken = useCallback(async () => {
    const t = token.current
    if (!t || t.expiresAt - 60_000 < Date.now()) throw new AuthError()
    return t.accessToken
  }, [])
  const drive = useRef(deps.makeDrive(getToken)).current

  useEffect(() => {
    const load = () => { void repo.getDevice().then(setDevice) }
    load()
    return repo.subscribe(load)
  }, [repo])

  const fileId = device?.dataFileId
  useEffect(() => {
    if (!fileId) return
    return startAutoSync(repo, () => syncOnce(repo, drive, fileId), setSyncStatus)
  }, [repo, drive, fileId])

  const signIn = useCallback(async () => {
    token.current = await deps.requestToken()
    let dev = await repo.getDevice()
    if (!dev.dataFileId) {
      const folderId = await drive.ensureFolder()
      const dataFileId = await drive.findOrCreateFile(folderId, 'financas.json', emptyDoc())
      await repo.setDevice({ folderId, dataFileId })
      dev = await repo.getDevice()
    }
    setSyncStatus(await syncOnce(repo, drive, dev.dataFileId!))
    await repo.ensureDefaults(dev.profileId ?? 'u1')
  }, [deps, repo, drive])

  const syncNow = useCallback(async () => {
    if (!fileId) return
    setSyncStatus('sincronizando')
    setSyncStatus(await syncOnce(repo, drive, fileId))
  }, [repo, drive, fileId])

  const setMe = useCallback((p: ProfileId) => repo.setDevice({ profileId: p }), [repo])

  const folderId = device?.folderId
  const files = useMemo<Files>(() => ({
    upload: async (name, blob) => {
      if (!folderId) throw new Error('Pasta do Drive ainda não configurada')
      return drive.uploadBlob(folderId, name, blob)
    },
    open: id => drive.downloadBlob(id),
    remove: id => drive.trash(id),
  }), [drive, folderId])

  return (
    <AppCtx.Provider value={{ repo, device, me: device?.profileId ?? 'u1', syncStatus, signIn, syncNow, setMe, files }}>
      {children}
    </AppCtx.Provider>
  )
}
