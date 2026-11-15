import type { Category, Profile } from './types'

export function defaultProfiles(now: number): Profile[] {
  return [
    { id: 'u1', name: 'Usuário 1', updatedAt: now, updatedBy: 'u1' },
    { id: 'u2', name: 'Usuário 2', updatedAt: now, updatedBy: 'u1' },
  ]
}

export const PAYMENT_CATEGORY_ID = 'cat-pagamento-fatura'

const CATS: Array<[string, string, Category['kind'], boolean?]> = [
  ['cat-salario', 'Salário', 'receita'],
  ['cat-outras-receitas', 'Outras receitas', 'receita'],
  ['cat-moradia', 'Moradia', 'despesa'],
  ['cat-alimentacao', 'Alimentação', 'despesa'],
  ['cat-transporte', 'Transporte', 'despesa'],
  ['cat-saude', 'Saúde', 'despesa'],
  ['cat-educacao', 'Educação', 'despesa'],
  ['cat-lazer', 'Lazer', 'despesa'],
  ['cat-assinaturas', 'Assinaturas', 'despesa'],
  ['cat-outros', 'Outros', 'despesa'],
  [PAYMENT_CATEGORY_ID, 'Pagamento de fatura', 'despesa', true],
]

/** Ids fixos: dois aparelhos que criam os padrões não geram duplicatas. */
export function defaultCategories(now: number): Category[] {
  return CATS.map(([id, name, kind, system]) => ({
    id, name, kind, updatedAt: now, updatedBy: 'u1', ...(system ? { system: true } : {}),
  }))
}
