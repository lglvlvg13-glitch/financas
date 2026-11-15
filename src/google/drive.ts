import type { DataDoc } from '../domain/types'

export class AuthError extends Error { constructor(msg = 'Login expirado') { super(msg); this.name = 'AuthError' } }
export class NetworkError extends Error { constructor(msg = 'Sem conexão') { super(msg); this.name = 'NetworkError' } }

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

const quote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

export class DriveClient {
  private getToken: () => Promise<string>
  private fetchFn: typeof fetch
  constructor(getToken: () => Promise<string>, fetchFn: typeof fetch = fetch.bind(globalThis)) {
    this.getToken = getToken
    this.fetchFn = fetchFn
  }

  private async req(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${await this.getToken()}`)
    let res: Response
    try {
      res = await this.fetchFn(url, { ...init, headers })
    } catch {
      throw new NetworkError()
    }
    if (res.status === 401) throw new AuthError()
    if (res.status === 403) {
      // 403 também é usado para limite de uso; só pede login quando é falta de permissão.
      const body = await res.clone().json().catch(() => ({})) as { error?: { errors?: Array<{ reason?: string }> } }
      const reason = body.error?.errors?.[0]?.reason ?? ''
      if (/authError|insufficientPermissions|forbidden|appNotAuthorized/i.test(reason) || !reason) throw new AuthError()
    }
    if (!res.ok) throw new Error(`Drive respondeu ${res.status}`)
    return res
  }

  private async search(q: string): Promise<string | undefined> {
    const url = `${API}/files?q=${encodeURIComponent(q)}&fields=${encodeURIComponent('files(id)')}&spaces=drive`
    const data = await (await this.req(url)).json() as { files: Array<{ id: string }> }
    return data.files[0]?.id
  }

  async ensureFolder(name = 'Finanças da Família'): Promise<string> {
    const found = await this.search(`name=${quote(name)} and mimeType='${FOLDER_MIME}' and trashed=false`)
    if (found) return found
    const res = await this.req(`${API}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME }),
    })
    return ((await res.json()) as { id: string }).id
  }

  async findOrCreateFile(folderId: string, name: string, initial: DataDoc): Promise<string> {
    const found = await this.search(`name=${quote(name)} and ${quote(folderId)} in parents and trashed=false`)
    if (found) return found
    const boundary = 'financas' + Math.random().toString(36).slice(2)
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' }) +
      `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify(initial) +
      `\r\n--${boundary}--`
    const res = await this.req(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    })
    return ((await res.json()) as { id: string }).id
  }

  async download(fileId: string): Promise<DataDoc> {
    return (await this.req(`${API}/files/${fileId}?alt=media`)).json() as Promise<DataDoc>
  }

  async upload(fileId: string, doc: DataDoc): Promise<void> {
    await this.req(`${UPLOAD}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
  }
}
