import { parseOfx, parseCsv, suggestCategory, toDrafts, importKey } from '../../src/domain/importer'
import type { Transaction } from '../../src/domain/types'

const OFX = `OFXHEADER:100
DATA:OFXSGML
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261105120000[-3:BRT]<TRNAMT>-2200.00<FITID>A1<MEMO>ALUGUEL IMOBILIARIA
</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261105<TRNAMT>6200,00<FITID>A2<MEMO>SALARIO EMPRESA X</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261109<TRNAMT>-61.29<FITID>A3<NAME>SUPERMERCADO BOM PRECO</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`

test('OFX: data, valor, descrição e id do banco', () => {
  const rows = parseOfx(OFX)
  expect(rows).toEqual([
    { date: '2026-11-05', amountCents: -220000, description: 'ALUGUEL IMOBILIARIA', bankId: 'A1' },
    { date: '2026-11-05', amountCents: 620000, description: 'SALARIO EMPRESA X', bankId: 'A2' },
    { date: '2026-11-09', amountCents: -6129, description: 'SUPERMERCADO BOM PRECO', bankId: 'A3' },
  ])
})

test('CSV brasileiro: ; e vírgula decimal, colunas detectadas pelo cabeçalho', () => {
  const csv = 'Data;Descrição;Valor\n05/11/2026;Padaria Pão Quente;-12,50\n06/11/2026;"Pix recebido; Ana";1.234,56\n'
  expect(parseCsv(csv)).toEqual([
    { date: '2026-11-05', amountCents: -1250, description: 'Padaria Pão Quente' },
    { date: '2026-11-06', amountCents: 123456, description: 'Pix recebido; Ana' },
  ])
})

test('CSV com vírgula e ponto decimal, data ISO e colunas em outra ordem (Nubank)', () => {
  const csv = 'date,title,amount\n2026-11-02,Netflix,39.90\n2026-11-03,Uber *Trip,23.10\n'
  // Fatura de cartão: valores positivos são compras.
  expect(parseCsv(csv)).toEqual([
    { date: '2026-11-02', amountCents: 3990, description: 'Netflix' },
    { date: '2026-11-03', amountCents: 2310, description: 'Uber *Trip' },
  ])
})

test('sugestão: primeiro aprende com lançamentos anteriores de mesma descrição, depois palavras-chave', () => {
  const hist = [{ note: 'Padaria Pão Quente', categoryId: 'cat-alimentacao', item: 'Lanches e cafés', kind: 'despesa' }] as Transaction[]
  expect(suggestCategory('PADARIA PAO QUENTE', 'despesa', hist)).toEqual({ categoryId: 'cat-alimentacao', item: 'Lanches e cafés' })
  expect(suggestCategory('SUPERMERCADO BOM PRECO', 'despesa', [])).toEqual({ categoryId: 'cat-alimentacao', item: 'Supermercado' })
  expect(suggestCategory('POSTO SHELL', 'despesa', [])).toEqual({ categoryId: 'cat-transporte', item: 'Combustível' })
  expect(suggestCategory('UBER *TRIP', 'despesa', [])).toEqual({ categoryId: 'cat-transporte', item: 'Aplicativos de transporte' })
  expect(suggestCategory('SALARIO EMPRESA X', 'receita', [])).toEqual({ categoryId: 'cat-salario-u1' })
  expect(suggestCategory('XPTO LTDA', 'despesa', [])).toEqual({ categoryId: 'cat-emergencias' })
})

test('rascunhos: conta (sinal define tipo) e cartão (fatura escolhida), sem repetir o que já foi importado', () => {
  const rows = parseOfx(OFX)
  const existing = [{ importKey: importKey('acc:a1', rows[0]) }] as Transaction[]
  const d = toDrafts(rows, { target: { accountId: 'a1' }, profileId: 'u1', existing, history: [] })
  expect(d).toHaveLength(2)
  expect(d[0].draft).toMatchObject({ kind: 'receita', amountCents: 620000, accountId: 'a1', categoryId: 'cat-salario-u1', note: 'SALARIO EMPRESA X' })
  expect(d[1].draft).toMatchObject({ kind: 'despesa', amountCents: 6129, item: 'Supermercado' })
  const card = toDrafts([{ date: '2026-11-02', amountCents: 3990, description: 'Netflix' }, { date: '2026-11-04', amountCents: -500, description: 'Estorno' }],
    { target: { cardId: 'k1', invoiceMonth: '2026-11' }, profileId: 'u2', existing: [], history: [] })
  expect(card).toHaveLength(1)
  expect(card[0].draft).toMatchObject({ cardId: 'k1', invoiceMonth: '2026-11', amountCents: 3990, profileId: 'u2', categoryId: 'cat-lazer' })
})

test('fatura de cartão em OFX: compras vêm negativas e viram positivas; pagamento fica de fora', () => {
  const ofx = `<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20261102<TRNAMT>-39.90<FITID>C1<MEMO>NETFLIX</STMTTRN>
<STMTTRN><DTPOSTED>20261103<TRNAMT>1500.00<FITID>C2<MEMO>PAGAMENTO RECEBIDO</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`
  const d = toDrafts(parseOfx(ofx), { target: { cardId: 'k1', invoiceMonth: '2026-11' }, profileId: 'u1', existing: [], history: [] })
  expect(d.map(x => [x.draft.note, x.draft.amountCents])).toEqual([['NETFLIX', 3990]])
})

test('linhas iguais no mesmo arquivo (dois Pix de R$ 10 no mesmo dia) não se perdem', () => {
  const csv = 'Data;Descrição;Valor\n05/11/2026;Pix Maria;-10,00\n05/11/2026;Pix Maria;-10,00\n'
  const d = toDrafts(parseCsv(csv), { target: { accountId: 'a1' }, profileId: 'u1', existing: [], history: [] })
  expect(d).toHaveLength(2)
  expect(new Set(d.map(x => x.key)).size).toBe(2)
})

test('coluna Identificador do Nubank vira o id do banco', () => {
  const csv = 'Data,Valor,Identificador,Descrição\n05/11/2026,-10.00,abc-1,Pix Maria\n'
  expect(parseCsv(csv)[0].bankId).toBe('abc-1')
})

test('pagamento de fatura e transferências vêm desmarcados para conferir', () => {
  const csv = 'Data;Descrição;Valor\n05/11/2026;PAGAMENTO DE FATURA NUBANK;-1500,00\n06/11/2026;TRANSF ENTRE CONTAS;-300,00\n07/11/2026;MERCADO;-50,00\n'
  const d = toDrafts(parseCsv(csv), { target: { accountId: 'a1' }, profileId: 'u1', existing: [], history: [] })
  expect(d.map(x => x.review)).toEqual(['fatura', 'transferencia', undefined])
})

test('linha apagada de propósito não volta ao importar de novo', () => {
  const rows = parseCsv('Data;Descrição;Valor\n05/11/2026;Padaria;-12,50\n')
  const key = toDrafts(rows, { target: { accountId: 'a1' }, profileId: 'u1', existing: [], history: [] })[0].key
  const d = toDrafts(rows, { target: { accountId: 'a1' }, profileId: 'u1', existing: [{ importKey: key, deletedAt: 5 } as Transaction], history: [] })
  expect(d).toHaveLength(0)
})

test('valores e datas em formatos comuns de banco', () => {
  const csv = 'Data;Histórico;Valor\n05/11/2026 10:30;Aluguel;1.500\n06/11/2026;Compra;50,00 D\n07/11/2026;Depósito;80,00 C\n'
  expect(parseCsv(csv).map(r => [r.date, r.amountCents])).toEqual([['2026-11-05', 150000], ['2026-11-06', -5000], ['2026-11-07', 8000]])
})

import { importId, decodeStatement } from '../../src/domain/importer'
test('id do lançamento importado vem da linha: dois celulares geram o mesmo', () => {
  expect(importId('acc:a1|X1')).toBe(importId('acc:a1|X1'))
  expect(importId('acc:a1|X1')).not.toBe(importId('acc:a1|X2'))
})

test('arquivo em Windows-1252 (comum em OFX) é lido com acentos', () => {
  const bytes = new Uint8Array([0x4d, 0x45, 0x52, 0x43, 0x41, 0x44, 0xc3, 0x4f]) // "MERCADÃO" em 1252 (Ã = 0xC3)... e 'O'
  expect(decodeStatement(bytes.buffer)).toBe('MERCADÃO')
})
