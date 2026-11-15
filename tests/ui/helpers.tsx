import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Repo } from '../../src/data/db'
import { emptyDoc, type DataDoc } from '../../src/domain/types'
import App from '../../src/ui/App'
import type { AppDeps, DriveLike } from '../../src/ui/context'

let n = 0

export class FakeDrive implements DriveLike {
  file: DataDoc = emptyDoc()
  async ensureFolder() { return 'FOLDER' }
  async findOrCreateFile() { return 'FILE' }
  async download() { return structuredClone(this.file) }
  async upload(_id: string, doc: DataDoc) { this.file = structuredClone(doc) }
}

/** Monta o app com Google e Drive falsos. `ready` = já configurado e com perfil escolhido. */
export async function setup(opts: { ready?: boolean } = {}) {
  const repo = new Repo(`ui-${++n}-${Math.random()}`)
  const drive = new FakeDrive()
  if (opts.ready) {
    await repo.setDevice({ dataFileId: 'FILE', folderId: 'FOLDER', profileId: 'u1' })
    await repo.ensureDefaults('u1')
  }
  const deps: AppDeps = {
    repo,
    requestToken: async () => ({ accessToken: 'T', expiresAt: Date.now() + 3_600_000 }),
    makeDrive: () => drive,
  }
  const user = userEvent.setup()
  const utils = render(<App deps={deps} />)
  return { repo, drive, user, ...utils }
}
