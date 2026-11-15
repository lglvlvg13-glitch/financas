const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

/** Centavos inteiros → "R$ 1.234,56". */
export function formatBRL(cents: number): string {
  const s = fmt.format(Math.abs(cents) / 100).replace(/ | /g, ' ')
  return cents < 0 ? `-${s}` : s
}

/** Texto digitado ("1.234,56", "R$ 10", "10,5") → centavos, ou null se inválido. */
export function parseBRL(text: string): number | null {
  const t = text.replace(/R\$/i, '').replace(/\s/g, '')
  if (!/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(t)) return null
  const [int, dec = ''] = t.replace(/\./g, '').split(',')
  const neg = int.startsWith('-')
  const cents = Math.abs(Number(int)) * 100 + Number(dec.padEnd(2, '0'))
  return neg ? -cents : cents
}

/** Divide um total em partes inteiras; a sobra de centavos vai para as primeiras partes. */
export function splitCents(total: number, parts: number): number[] {
  const base = Math.floor(total / parts)
  const rest = total - base * parts
  return Array.from({ length: parts }, (_, i) => base + (i < rest ? 1 : 0))
}
