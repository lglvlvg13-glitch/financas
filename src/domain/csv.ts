/** CSV para Excel em português: ";" separa colunas, números (em centavos) saem com vírgula decimal. */
export type Cell = string | number | null | undefined

const cell = (v: Cell): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return (v / 100).toFixed(2).replace('.', ',')
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function toCsv(rows: Cell[][]): string {
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n')
}
