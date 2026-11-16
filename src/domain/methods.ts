/** As 17 variações do método 50/30/20 da planilha (aba RELATÓRIO FINANCEIRO). */
export interface Method { id: string; label: string; need: number; want: number; invest: number }

const RAW: Array<[string, number, number, number]> = [
  ['50/30/20 – Modelo tradicional', 50, 30, 20],
  ['70/20/10 – Quem está começando', 70, 20, 10],
  ['60/20/20 – Quer investir mais', 60, 20, 20],
  ['80/20 – Orçamento simples', 80, 0, 20],
  ['60/30/10 – Muitas despesas fixas', 60, 30, 10],
  ['40/30/30 – Alta capacidade de poupança', 40, 30, 30],
  ['50/20/30 – Foco em patrimônio', 50, 20, 30],
  ['30/30/40 – Independência financeira', 30, 30, 40],
  ['75/15/10 – Renda apertada', 75, 15, 10],
  ['65/15/20 – Organização financeira', 65, 15, 20],
  ['55/25/20 – Equilíbrio', 55, 25, 20],
  ['45/25/30 – Acelerar patrimônio', 45, 25, 30],
  ['50/20/30 – Quitação de dívidas', 50, 20, 30],
  ['60/10/30 – Endividamento grave', 60, 10, 30],
  ['70/5/25 – Endividamento extremo', 70, 5, 25],
  ['40/20/40 – Construção rápida', 40, 20, 40],
  ['25/25/50 – Aposentadoria antecipada', 25, 25, 50],
]

export const METHODS: Method[] = RAW.map(([label, need, want, invest], i) => ({ id: `m${i + 1}`, label, need, want, invest }))

export const methodById = (id?: string): Method => METHODS.find(m => m.id === id) ?? METHODS[0]
