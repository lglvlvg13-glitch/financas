import { COLLECTIONS, emptyDoc, type AnyRecord, type DataDoc } from './types'

/** Escolhe a versão mais recente; empate decidido por updatedBy para ser determinístico. */
function newer(a: AnyRecord, b: AnyRecord): AnyRecord {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  if (a.updatedBy !== b.updatedBy) return a.updatedBy > b.updatedBy ? a : b
  // Mesmo carimbo e autor: escolhe pelo conteúdo, para o resultado não depender da ordem.
  return JSON.stringify(a) >= JSON.stringify(b) ? a : b
}

/** Junta dois documentos registro a registro (última alteração vence; lápides contam como alteração). */
export function mergeDocs(a: DataDoc, b: DataDoc): DataDoc {
  const out = emptyDoc()
  for (const c of COLLECTIONS) {
    const ra = a.records[c] ?? {}
    const rb = b.records[c] ?? {}
    const ids = new Set([...Object.keys(ra), ...Object.keys(rb)])
    for (const id of [...ids].sort()) {
      const x = ra[id], y = rb[id]
      out.records[c][id] = x && y ? newer(x, y) : (x ?? y)
    }
  }
  return out
}
