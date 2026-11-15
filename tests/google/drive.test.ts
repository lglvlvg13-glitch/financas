import { AuthError, DriveClient, NetworkError } from '../../src/google/drive'
import { emptyDoc } from '../../src/domain/types'

type Call = { url: string; init?: RequestInit }

function fakeFetch(responses: Array<{ status?: number; body?: unknown } | Error>) {
  const calls: Call[] = []
  const fn = async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const r = responses.shift()
    if (!r) throw new Error('unexpected call ' + url)
    if (r instanceof Error) throw r
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status ?? 200 })
  }
  return { fn: fn as typeof fetch, calls }
}

const client = (f: typeof fetch) => new DriveClient(async () => 'TOKEN', f)

test('ensureFolder reutiliza pasta existente', async () => {
  const f = fakeFetch([{ body: { files: [{ id: 'F1' }] } }])
  expect(await client(f.fn).ensureFolder()).toBe('F1')
  expect(f.calls).toHaveLength(1)
  expect(f.calls[0].init?.method ?? 'GET').toBe('GET')
})

test('ensureFolder cria quando não existe', async () => {
  const f = fakeFetch([{ body: { files: [] } }, { body: { id: 'NEW' } }])
  expect(await client(f.fn).ensureFolder()).toBe('NEW')
  expect(f.calls[1].init?.method).toBe('POST')
  const body = JSON.parse(String(f.calls[1].init?.body))
  expect(body).toEqual({ name: 'Finanças da Família', mimeType: 'application/vnd.google-apps.folder' })
})

test('upload envia JSON com token', async () => {
  const f = fakeFetch([{ body: {} }])
  const doc = emptyDoc()
  await client(f.fn).upload('FILE', doc)
  expect(f.calls[0].url).toContain('/upload/drive/v3/files/FILE?uploadType=media')
  expect(f.calls[0].init?.method).toBe('PATCH')
  expect(new Headers(f.calls[0].init?.headers).get('Authorization')).toBe('Bearer TOKEN')
  expect(f.calls[0].init?.body).toBe(JSON.stringify(doc))
})

test('download lê o documento', async () => {
  const doc = emptyDoc()
  const f = fakeFetch([{ body: doc }])
  expect(await client(f.fn).download('FILE')).toEqual(doc)
  expect(f.calls[0].url).toContain('/drive/v3/files/FILE?alt=media')
})

test('findOrCreateFile cria o arquivo com o documento inicial dentro da pasta', async () => {
  const f = fakeFetch([{ body: { files: [] } }, { body: { id: 'D1' } }])
  expect(await client(f.fn).findOrCreateFile('F1', 'financas.json', emptyDoc())).toBe('D1')
  expect(f.calls[0].url).toContain(encodeURIComponent("'F1' in parents"))
  expect(f.calls[1].url).toContain('uploadType=multipart')
  expect(String(f.calls[1].init?.body)).toContain('"parents":["F1"]')
})

test('401 vira AuthError', async () => {
  const f = fakeFetch([{ status: 401, body: {} }])
  await expect(client(f.fn).download('X')).rejects.toBeInstanceOf(AuthError)
})

test('fetch rejeitado vira NetworkError', async () => {
  const f = fakeFetch([new TypeError('Failed to fetch')])
  await expect(client(f.fn).download('X')).rejects.toBeInstanceOf(NetworkError)
})

test("nome da pasta com apóstrofo é escapado na busca", async () => {
  const f = fakeFetch([{ body: { files: [{ id: 'F' }] } }])
  await client(f.fn).ensureFolder("D'Ávila")
  expect(decodeURIComponent(f.calls[0].url)).toContain("name='D\\'Ávila'")
})
