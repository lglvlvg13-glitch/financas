import type { ProfileId, Transaction, TransactionDraft } from './types'

/** Uma linha do extrato do banco ou da fatura. amountCents negativo = saída (no extrato da conta). */
export interface BankRow { date: string; amountCents: number; description: string; bankId?: string }

const pad = (n: number) => String(n).padStart(2, '0')

/** "−1.234,56", "1234.56", "-2200.00", "R$ 12,50" → centavos. */
function toCents(raw: string): number | null {
  let s = raw.replace(/R\$|\s/g, '').trim().toUpperCase()
  if (!s) return null
  // "50,00 D" (débito) / "80,00 C" (crédito), usado por alguns bancos.
  let neg = /^-|^\(.*\)$|-$/.test(s)
  if (/D$/.test(s)) { neg = true; s = s.slice(0, -1) } else if (/C$/.test(s)) s = s.slice(0, -1)
  s = s.replace(/[()\-+]/g, '')
  const lastComma = s.lastIndexOf(','), lastDot = s.lastIndexOf('.')
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
  else if (lastComma < 0 && /^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '') // "1.500" = mil e quinhentos
  else s = s.replace(/,/g, '')
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const v = Math.round(parseFloat(s) * 100)
  return neg ? -v : v
}

/** "05/11/2026", "05/11/26", "2026-11-05", "20261105" → ISO. */
function toDate(raw: string): string | null {
  const s = raw.trim()
  let m = /^(\d{4})-?(\d{2})-?(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(\s|$)/.exec(s)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    return `${y}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`
  }
  return null
}

/** OFX (SGML ou XML), o formato que quase todo banco brasileiro exporta. */
export function parseOfx(text: string): BankRow[] {
  const out: BankRow[] = []
  // Fatura de cartão em OFX traz compras negativas; aqui compra fica positiva, como no CSV das faturas.
  const isCard = /<CCSTMTRS>|<CREDITCARDMSGSRSV1>/i.test(text)
  const tag = (block: string, name: string) => {
    const m = new RegExp(`<${name}>([^<\\r\\n]*)`, 'i').exec(block)
    return m ? m[1].trim() : ''
  }
  for (const block of text.split(/<STMTTRN>/i).slice(1)) {
    const body = block.split(/<\/STMTTRN>/i)[0]
    const date = toDate(tag(body, 'DTPOSTED').slice(0, 8))
    const cents = toCents(tag(body, 'TRNAMT'))
    if (!date || cents === null) continue
    const description = (tag(body, 'MEMO') || tag(body, 'NAME') || 'Sem descrição').replace(/\s+/g, ' ')
    const bankId = tag(body, 'FITID')
    out.push({ date, amountCents: isCard ? -cents : cents, description, ...(bankId ? { bankId } : {}) })
  }
  return out
}

/** Lê o arquivo como UTF-8; se não for UTF-8 válido (OFX costuma vir em Windows-1252), usa Windows-1252. */
export function decodeStatement(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf) }
  catch { return new TextDecoder('windows-1252').decode(buf) }
}

function splitLine(line: string, sep: string): string[] {
  const cells: string[] = []
  let cur = '', quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') { if (quoted && line[i + 1] === '"') { cur += '"'; i++ } else quoted = !quoted }
    else if (ch === sep && !quoted) { cells.push(cur); cur = '' }
    else cur += ch
  }
  cells.push(cur)
  return cells.map(c => c.trim())
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/** CSV de banco ou de fatura: acha as colunas de data, descrição e valor pelo cabeçalho. */
export function parseCsv(text: string): BankRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim())
  if (lines.length < 2) return []
  const head = lines[0]
  const sep = (head.match(/;/g)?.length ?? 0) >= (head.match(/,/g)?.length ?? 0) ? ';' : ','
  const cols = splitLine(head, sep).map(norm)
  const find = (...names: string[]) => cols.findIndex(c => names.some(n => c.includes(n)))
  const iDate = find('DATA', 'DATE', 'LANCAMENTO')
  const iDesc = find('DESCRI', 'HISTORICO', 'TITLE', 'TITULO', 'ESTABELECIMENTO', 'LANCAMENTO DETALHE', 'MEMO')
  const iVal = find('VALOR', 'AMOUNT', 'QUANTIA')
  const iId = cols.findIndex(c => c === 'ID' || c.includes('IDENTIFICADOR'))
  if (iDate < 0 || iVal < 0) return []
  const out: BankRow[] = []
  for (const line of lines.slice(1)) {
    const c = splitLine(line, sep)
    const date = toDate(c[iDate] ?? '')
    const cents = toCents(c[iVal] ?? '')
    if (!date || cents === null) continue
    const bankId = iId >= 0 ? c[iId] : ''
    out.push({ date, amountCents: cents, description: (iDesc >= 0 ? c[iDesc] : '') || 'Sem descrição', ...(bankId ? { bankId } : {}) })
  }
  return out
}

type Rule = [RegExp, string, string?]
/** Palavras comuns em extratos brasileiros → categoria e item da planilha. */
const RULES: Rule[] = [
  [/IFOOD|RAPPI|RESTAUR|PIZZ|BURGER|MCDONALD|OUTBACK|SUSHI|CHURRASC/, 'cat-alimentacao', 'Restaurantes e delivery'],
  [/PADARIA|PANIFICADORA|CAFE|STARBUCKS|LANCHONETE|DOCERIA/, 'cat-alimentacao', 'Lanches e cafés'],
  [/HORTIFRUTI|SACOLAO|FEIRA/, 'cat-alimentacao', 'Feiras e hortifrúti'],
  [/SUPERMERC|MERCADO|ATACAD|ASSAI|CARREFOUR|PAO DE ACUCAR|\bEXTRA\b|\bDIA\b/, 'cat-alimentacao', 'Supermercado'],
  [/\bPOSTO\b|SHELL|IPIRANGA|PETROBRAS|COMBUST|\bAUTO POSTO/, 'cat-transporte', 'Combustível'],
  [/\bUBER\b|\b99\s?(APP|POP|TAXI)?\b|CABIFY|INDRIVE/, 'cat-transporte', 'Aplicativos de transporte'],
  [/ESTACION|SEM PARAR|CONECTCAR|VELOE|PEDAGIO/, 'cat-transporte', 'Estacionamento e pedágios'],
  [/METRO|\bSPTRANS|BILHETE UNICO|RECARGA TRANSP/, 'cat-transporte', 'Transporte público'],
  [/DROGA|FARMA|\bRAIA\b|PACHECO|PAGUE MENOS/, 'cat-saude', 'Medicamentos'],
  [/UNIMED|\bAMIL\b|BRADESCO SAUDE|SULAMERICA|HAPVIDA|NOTREDAME/, 'cat-saude', 'Plano de saúde'],
  [/ACADEMIA|SMART ?FIT|GYMPASS|WELLHUB|BLUEFIT/, 'cat-saude', 'Academia / esportes'],
  [/\bENEL\b|CEMIG|\bLIGHT\b|COPEL|CELESC|ENERGIA|EQUATORIAL|NEOENERGIA|CPFL|COELBA/, 'cat-servicos', 'Energia elétrica'],
  [/SABESP|CEDAE|COPASA|SANEPAR|EMBASA|\bAGUA\b|SANEAMENTO/, 'cat-servicos', 'Água e esgoto'],
  [/COMGAS|NATURGY|\bGAS\b|ULTRAGAZ|SUPERGASBRAS/, 'cat-servicos', 'Gás'],
  [/\bVIVO\b|\bCLARO\b|\bTIM\b|\bOI\b|INTERNET|FIBRA/, 'cat-servicos', 'Internet'],
  [/NETFLIX|SPOTIFY|DISNEY|PRIME ?VIDEO|AMAZON PRIME|\bHBO\b|\bMAX\b|GLOBOPLAY|YOUTUBE|DEEZER|APPLE\.COM/, 'cat-lazer', 'Streaming'],
  [/CINEMA|CINEMARK|INGRESSO|TEATRO|SHOW/, 'cat-lazer', 'Cinema / teatro'],
  [/HOTEL|AIRBNB|BOOKING|LATAM|\bGOL\b|\bAZUL\b|DECOLAR|POUSADA/, 'cat-lazer', 'Viagens e hospedagem'],
  [/ALUGUEL|IMOBILI/, 'cat-moradia', 'Aluguel / financiamento'],
  [/CONDOMINIO/, 'cat-moradia', 'Condomínio'],
  [/\bIPTU\b/, 'cat-moradia', 'IPTU / taxas municipais'],
  [/ESCOLA|COLEGIO|FACULDADE|UNIVERSIDADE|MENSALIDADE/, 'cat-educacao', 'Mensalidades escolares / universitárias'],
  [/CURSO|UDEMY|ALURA|COURSERA/, 'cat-educacao', 'Cursos online / apps educacionais'],
  [/RENNER|\bC&A\b|RIACHUELO|ZARA|HERING|CENTAURO|NETSHOES|SHEIN/, 'cat-vestuario', 'Roupas'],
  [/\bPET\b|COBASI|PETZ|VETERIN/, 'cat-pets'],
  [/\bIPVA\b|LICENCIAMENTO|DETRAN/, 'cat-transporte', 'Licenciamento de veículos'],
  [/SEGURO/, 'cat-seguros'],
  [/TARIFA|ANUIDADE|\bIOF\b|CESTA DE SERVICOS/, 'cat-seguros', 'Taxas bancárias'],
]

export interface Suggestion { categoryId: string; item?: string }

/** Categoria sugerida: igual à da última vez que a mesma descrição foi lançada; senão por palavras-chave. */
export function suggestCategory(description: string, kind: 'receita' | 'despesa', history: Transaction[], profile: ProfileId = 'u1'): Suggestion {
  const d = norm(description)
  const same = history.filter(t => !t.deletedAt && t.kind === kind && t.note && norm(t.note) === d).at(-1)
  if (same) return { categoryId: same.categoryId, ...(same.item ? { item: same.item } : {}) }
  if (kind === 'receita') {
    if (/SALARIO|FOLHA|PROVENTOS|PAGTO SAL/.test(d)) return { categoryId: `cat-salario-${profile}` }
    if (/COMISS/.test(d)) return { categoryId: 'cat-comissoes' }
    return { categoryId: 'cat-outras-receitas' }
  }
  for (const [re, categoryId, item] of RULES) if (re.test(d)) return { categoryId, ...(item ? { item } : {}) }
  return { categoryId: 'cat-emergencias' }
}

export type ImportTarget = { accountId: string } | { cardId: string; invoiceMonth: string }

/** Identidade da linha importada: id do banco, ou data+valor+descrição (+ nº da repetição no arquivo).
 *  Evita importar duas vezes, sem perder duas linhas iguais de verdade (ex.: dois Pix de R$ 10 no mesmo dia). */
export function importKey(scope: string, r: BankRow, occurrence = 1): string {
  return `${scope}|${r.bankId ?? `${r.date}|${r.amountCents}|${norm(r.description)}`}${occurrence > 1 ? `#${occurrence}` : ''}`
}

/** Id do lançamento importado, derivado da linha: se os dois celulares importarem o mesmo extrato,
 *  os registros têm o mesmo id e a sincronização fica com um só. */
export function importId(key: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0
  }
  return `imp-${h1.toString(36)}${h2.toString(36)}`
}

/** Linha que pede conferência: já entra por outro caminho ou pode não ser despesa. */
export type Review = 'fatura' | 'transferencia'
const PAYS_INVOICE = /PAG(AMEN)?TO?\b.*FATURA|PAG\.? FATURA|FATURA CART|PAGTO CART/
const TRANSFER = /TRANSF.*(ENTRE|MESMA|PROPRIA)|ENTRE CONTAS|APLICACAO|APLIC\b|RESGATE|\bCDB\b|POUPANCA|INVEST/

export interface DraftRow { row: BankRow; draft: TransactionDraft; key: string; review?: Review }

/** Linhas do extrato → lançamentos prontos para revisar. Linhas já importadas ficam de fora.
 *  Conta: negativo = despesa, positivo = receita. Fatura: positivo = compra; negativo (estorno, pagamento) fica de fora. */
export function toDrafts(rows: BankRow[], o: { target: ImportTarget; profileId: ProfileId; existing: Transaction[]; history: Transaction[] }): DraftRow[] {
  const scope = 'accountId' in o.target ? `acc:${o.target.accountId}` : `card:${o.target.cardId}`
  // Inclui as apagadas: uma linha excluída de propósito não volta ao importar um extrato que a repete.
  const seen = new Set(o.existing.filter(t => t.importKey).map(t => t.importKey!))
  const count = new Map<string, number>()
  const out: DraftRow[] = []
  for (const row of rows) {
    const base = importKey(scope, row)
    const n = (count.get(base) ?? 0) + 1
    count.set(base, n)
    const key = row.bankId ? base : importKey(scope, row, n)
    if (seen.has(key)) continue
    seen.add(key)
    if ('cardId' in o.target) {
      if (row.amountCents <= 0) continue
      const s = suggestCategory(row.description, 'despesa', o.history, o.profileId)
      out.push({ row, key, draft: {
        kind: 'despesa', amountCents: row.amountCents, date: row.date, categoryId: s.categoryId, ...(s.item ? { item: s.item } : {}),
        profileId: o.profileId, cardId: o.target.cardId, invoiceMonth: o.target.invoiceMonth, note: row.description, importKey: key,
      } })
    } else {
      if (row.amountCents === 0) continue
      const kind = row.amountCents < 0 ? 'despesa' : 'receita'
      const s = suggestCategory(row.description, kind, o.history, o.profileId)
      const d = norm(row.description)
      const review: Review | undefined = kind === 'despesa' && PAYS_INVOICE.test(d) ? 'fatura' : TRANSFER.test(d) ? 'transferencia' : undefined
      out.push({ row, key, ...(review ? { review } : {}), draft: {
        kind, amountCents: Math.abs(row.amountCents), date: row.date, categoryId: s.categoryId, ...(s.item ? { item: s.item } : {}),
        profileId: o.profileId, accountId: o.target.accountId, note: row.description, importKey: key,
      } })
    }
  }
  return out
}
