import type { Category, Profile } from './types'

export function defaultProfiles(now: number): Profile[] {
  return [
    { id: 'u1', name: 'Usuário 1', updatedAt: now, updatedBy: 'u1' },
    { id: 'u2', name: 'Usuário 2', updatedAt: now, updatedBy: 'u1' },
  ]
}

export const PAYMENT_CATEGORY_ID = 'cat-pagamento-fatura'

type Item = NonNullable<Category['items']>[number]
type Def = { id: string; name: string; kind: Category['kind']; group?: Category['group']; system?: true; items?: Item[] }

const n = 'necessidade' as const, d = 'desejo' as const
const i = (name: string, group: Item['group']): Item => ({ name, group })

/** Categorias da planilha (aba CONFIGURAÇÕES), com os itens do LANÇADOR. Cada item tem sua classificação
 *  no 50/30/20: Necessidade (despesa fixa, sem ela a casa não funciona) ou Desejo (dá para cortar ou adiar). */
export const DEFAULT_CATEGORIES: Def[] = [
  { id: 'cat-salario-u1', name: 'Salário Usuário 1', kind: 'receita' },
  { id: 'cat-salario-u2', name: 'Salário Usuário 2', kind: 'receita' },
  { id: 'cat-comissoes', name: 'Comissões', kind: 'receita' },
  { id: 'cat-outras-receitas', name: 'Outras receitas', kind: 'receita' },

  { id: 'cat-moradia', name: 'Moradia', kind: 'despesa', group: 'necessidade', items: [i('Aluguel / financiamento', n), i('Condomínio', n), i('IPTU / taxas municipais', n), i('Seguro residencial', n), i('Manutenção e reparos', n), i('Mobília e decoração', d), i('Jardinagem / paisagismo', d), i('Piscina e manutenção', d), i('Segurança residencial', n)] },
  { id: 'cat-servicos', name: 'Contas de serviços', kind: 'despesa', group: 'necessidade', items: [i('Energia elétrica', n), i('Água e esgoto', n), i('Gás', n), i('Internet', n), i('TV por assinatura / streaming', d), i('Telefone fixo / celular', n), i('Serviços de limpeza ou zeladoria', d)] },
  { id: 'cat-alimentacao', name: 'Alimentação', kind: 'despesa', group: 'necessidade', items: [i('Supermercado', n), i('Feiras e hortifrúti', n), i('Restaurantes e delivery', d), i('Lanches e cafés', d), i('Bebidas alcoólicas / vinhos', d), i('Assinaturas de cestas ou kits de refeição', d)] },
  { id: 'cat-transporte', name: 'Transporte', kind: 'despesa', group: 'necessidade', items: [i('Combustível', n), i('Transporte público', n), i('Manutenção do carro', n), i('Seguro do veículo', n), i('Estacionamento e pedágios', n), i('Aplicativos de transporte', d), i('Transporte escolar', n), i('Licenciamento de veículos', n), i('Manutenção de bicicletas ou scooters', d)] },
  { id: 'cat-saude', name: 'Saúde e bem-estar', kind: 'despesa', group: 'necessidade', items: [i('Plano de saúde', n), i('Consultas médicas e odontológicas', n), i('Medicamentos', n), i('Exames e tratamentos', n), i('Terapias', n), i('Vacinação', n), i('Produtos de higiene pessoal', n), i('Cosméticos e estética', d), i('Academia / esportes', d), i('Suplementos / produtos naturais', d)] },
  { id: 'cat-educacao', name: 'Educação e desenvolvimento', kind: 'despesa', group: 'necessidade', items: [i('Mensalidades escolares / universitárias', n), i('Material escolar', n), i('Cursos extracurriculares', d), i('Livros e assinaturas educacionais', d), i('Cursos online / apps educacionais', d), i('Eventos, feiras e congressos', d), i('Preparação para concursos ou certificações', n)] },
  { id: 'cat-lazer', name: 'Lazer e entretenimento', kind: 'despesa', group: 'desejo', items: [i('Streaming', d), i('Cinema / teatro', d), i('Viagens e hospedagem', d), i('Hobbies e atividades recreativas', d), i('Equipamentos esportivos', d), i('Jogos e videogames', d), i('Clubes ou associações', d), i('Eventos culturais e esportivos', d)] },
  { id: 'cat-vestuario', name: 'Vestuário', kind: 'despesa', group: 'desejo', items: [i('Roupas básicas / uniforme', n), i('Roupas', d), i('Calçados', d), i('Acessórios', d), i('Lavanderia e ajustes', n)] },
  { id: 'cat-poupanca', name: 'Poupança e investimentos', kind: 'despesa', group: 'necessidade', items: [i('Reserva de emergência', n), i('Previdência privada', n), i('Investimentos financeiros', n), i('Aportes para aposentadoria', n)] },
  { id: 'cat-seguros', name: 'Seguros e impostos', kind: 'despesa', group: 'necessidade', items: [i('Seguro de vida', n), i('Seguro de veículo', n), i('Seguro residencial', n), i('Impostos sobre bens', n), i('Taxas bancárias', n)] },
  { id: 'cat-filhos', name: 'Filhos e dependentes', kind: 'despesa', group: 'necessidade', items: [i('Fraldas e alimentação infantil', n), i('Babá ou creche', n), i('Brinquedos e livros', d), i('Atividades extracurriculares', d), i('Festas de aniversário', d)] },
  { id: 'cat-pets', name: 'Animais de estimação', kind: 'despesa', group: 'necessidade', items: [i('Ração', n), i('Veterinário e vacinas', n), i('Higiene e acessórios', n), i('Seguro pet', d), i('Adestramento', d), i('Dog walker / passeios', d)] },
  { id: 'cat-familia', name: 'Família e social', kind: 'despesa', group: 'desejo', items: [i('Eventos familiares', d), i('Presentes comemorativos', d), i('Presentes em geral', d)] },
  { id: 'cat-doacoes', name: 'Doações e caridade', kind: 'despesa', group: 'necessidade', items: [i('Contribuições religiosas', n), i('Doações para instituições', n), i('Custos de voluntariado', n)] },
  { id: 'cat-emergencias', name: 'Emergenciais / imprevistos', kind: 'despesa', group: 'necessidade', items: [i('Despesas inesperadas', n)] },
  { id: PAYMENT_CATEGORY_ID, name: 'Pagamento de fatura', kind: 'despesa', system: true },

  { id: 'cat-inv-caixinha-1', name: 'Caixinha 1', kind: 'investimento' },
  { id: 'cat-inv-caixinha-2', name: 'Caixinha 2', kind: 'investimento' },
  { id: 'cat-inv-poupanca', name: 'Poupança', kind: 'investimento' },
  { id: 'cat-inv-corretora', name: 'Corretora', kind: 'investimento' },
]

/** Carimbo dos padrões desta versão. Maior que o da Fase 1 (0), para a migração vencer a junção com o Drive,
 *  e muito menor que qualquer edição real (Date.now()). Carimbo ≤ isto = padrão nunca editado. */
export const DEFAULTS_VERSION = 1

/** Nomes dos itens de cada categoria padrão (usado nas dicas). */
export const EXAMPLES: Record<string, string[]> = Object.fromEntries(
  DEFAULT_CATEGORIES.filter(c => c.items).map(c => [c.id, c.items!.map(x => x.name)]))

/** Ids fixos: dois aparelhos que criam os padrões não geram duplicatas. */
export function defaultCategories(now: number): Category[] {
  return DEFAULT_CATEGORIES.map(c => ({ ...c, updatedAt: now, updatedBy: 'u1' as const }))
}
