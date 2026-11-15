const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM" + n meses. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

export function monthOf(date: string): string {
  return date.slice(0, 7)
}

export function dayOf(date: string): number {
  return Number(date.slice(8, 10))
}

export function lastDayOfMonth(month: string): number {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Data do dia `day` no mês, limitada ao último dia do mês. */
export function clampDay(month: string, day: number): string {
  return `${month}-${pad(Math.min(day, lastDayOfMonth(month)))}`
}

/** Hoje no fuso local, "YYYY-MM-DD". */
export function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
