import type { ReactNode } from 'react'
import type { Category } from '../domain/types'

/** Ícones de traço (24×24), desenhados aqui para o app funcionar sem internet. */
const P: Record<string, ReactNode> = {
  painel: <><rect x="3" y="3" width="7" height="9" rx="2" /><rect x="14" y="3" width="7" height="5" rx="2" /><rect x="14" y="12" width="7" height="9" rx="2" /><rect x="3" y="16" width="7" height="5" rx="2" /></>,
  resumo: <><path d="M21 12A9 9 0 1 1 12 3v9z" /><path d="M15 3.5A9 9 0 0 1 20.5 9H15z" /></>,
  lancamentos: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
  cartoes: <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></>,
  mais: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  busca: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  filtro: <path d="M4 5h16l-6 7.5V19l-4 1v-7.5z" />,
  importar: <><path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5" /><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17" /></>,
  sino: <><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  calendario: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></>,
  seta: <path d="m9 6 6 6-6 6" />,
  voltar: <path d="m15 6-6 6 6 6" />,
  conta: <><path d="M3 10 12 4l9 6" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></>,
  relatorio: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  ajustes: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  // Categorias
  casa: <><path d="M3 11 12 4l9 7" /><path d="M5.5 9.5V20h13V9.5M10 20v-5h4v5" /></>,
  raio: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  carrinho: <><path d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1L21 8H6.2" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>,
  carro: <><path d="M5 16h14v-4l-2-5H7l-2 5z" /><path d="M5 16v2.5M19 16v2.5M3 12h18" /><circle cx="8" cy="14" r=".6" /><circle cx="16" cy="14" r=".6" /></>,
  coracao: <path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.6 3.6 4.5 6.8 4.5c2 0 3.4 1.1 5.2 3 1.8-1.9 3.2-3 5.2-3 3.2 0 5.1 3.1 4 6.2C19.5 15.4 12 20 12 20z" />,
  livro: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></>,
  ticket: <><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M14 6v12" strokeDasharray="2 2" /></>,
  camisa: <path d="M8 3 3.5 6l2 4L8 9v12h8V9l2.5 1 2-4L16 3a4 4 0 0 1-8 0z" />,
  cofrinho: <><path d="M5 11a7 6 0 0 1 12.6-3.4L20 7l-.6 3.4A6.5 6 0 0 1 19 15l-1 1.5V20h-3v-2h-4v2H8v-3A6 6 0 0 1 5 11z" /><circle cx="15.5" cy="10.5" r=".7" /><path d="M9.5 6.5h3" /></>,
  escudo: <><path d="M12 3 4.5 6v5.5c0 4.6 3.2 8 7.5 9.5 4.3-1.5 7.5-4.9 7.5-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  bebe: <><circle cx="12" cy="8" r="4.5" /><path d="M5 21a7 7 0 0 1 14 0" /><path d="M10.3 8.2h.01M13.7 8.2h.01" /></>,
  pata: <><circle cx="6" cy="10" r="1.8" /><circle cx="10" cy="6" r="1.8" /><circle cx="14" cy="6" r="1.8" /><circle cx="18" cy="10" r="1.8" /><path d="M12 11c-3 0-5.5 4.2-5.5 6.5 0 1.6 1.4 2.5 3 2.5 1 0 1.7-.5 2.5-.5s1.5.5 2.5.5c1.6 0 3-.9 3-2.5 0-2.3-2.5-6.5-5.5-6.5z" /></>,
  pessoas: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.8" /><path d="M16 14a5 5 0 0 1 5.5 5" /></>,
  presente: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v9h14v-9M12 8v13M12 8S10.5 3.5 8 4s-1.5 4 4 4c5.5 0 6.5-3.5 4-4S12 8 12 8z" /></>,
  alerta: <><path d="M12 3 2 20h20z" /><path d="M12 10v4.5M12 17.5h.01" /></>,
  maleta: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" /></>,
  porcento: <><path d="M19 5 5 19" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  entrada: <><path d="M12 4v12m0 0-5-5m5 5 5-5" /><path d="M5 20h14" /></>,
  grafico: <><path d="M3 17l6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  etiqueta: <><path d="M3 12V4h8l10 10-8 8z" /><circle cx="7.5" cy="8.5" r="1.2" /></>,
}

export type IconName = keyof typeof P

export function Icon({ name, size = 22, label, strokeWidth = 1.9 }: { name: IconName | string; size?: number; label?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })} focusable="false">
      {P[name] ?? P.etiqueta}
    </svg>
  )
}

/** Ícone e cor de cada categoria padrão; categorias novas usam a etiqueta na cor do tipo. */
const CAT: Record<string, [IconName, string]> = {
  'cat-moradia': ['casa', '#0E7C86'],
  'cat-servicos': ['raio', '#C98A12'],
  'cat-alimentacao': ['carrinho', '#E0702F'],
  'cat-transporte': ['carro', '#3F6FD8'],
  'cat-saude': ['coracao', '#D9465B'],
  'cat-educacao': ['livro', '#7A55C9'],
  'cat-lazer': ['ticket', '#C2449A'],
  'cat-vestuario': ['camisa', '#8B6BB8'],
  'cat-poupanca': ['cofrinho', '#2C8C5A'],
  'cat-seguros': ['escudo', '#4F6475'],
  'cat-filhos': ['bebe', '#E58A4E'],
  'cat-pets': ['pata', '#A0703A'],
  'cat-familia': ['pessoas', '#B85C8A'],
  'cat-doacoes': ['presente', '#3C9C8E'],
  'cat-emergencias': ['alerta', '#C2493B'],
  'cat-pagamento-fatura': ['cartoes', '#5B6A74'],
  'cat-salario-u1': ['maleta', '#17955F'],
  'cat-salario-u2': ['maleta', '#17955F'],
  'cat-comissoes': ['porcento', '#17955F'],
  'cat-outras-receitas': ['entrada', '#17955F'],
}
const KIND_COLOR: Record<Category['kind'], string> = { receita: '#17955F', despesa: '#5B6A74', investimento: '#4E6BF5' }

export function catLook(c?: Pick<Category, 'id' | 'kind'>): [IconName, string] {
  if (!c) return ['etiqueta', '#5B6A74']
  if (CAT[c.id]) return CAT[c.id]
  return [c.kind === 'investimento' ? 'grafico' : c.kind === 'receita' ? 'entrada' : 'etiqueta', KIND_COLOR[c.kind]]
}

/** Círculo colorido com o ícone da categoria. */
export function CatIcon({ category, size = 40 }: { category?: Pick<Category, 'id' | 'kind'>; size?: number }) {
  const [icon, color] = catLook(category)
  return (
    <span className="cat-ico" style={{ width: size, height: size, color, background: `color-mix(in srgb, ${color} 14%, transparent)` }} aria-hidden="true">
      <Icon name={icon} size={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  )
}
