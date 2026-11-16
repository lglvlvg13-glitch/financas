import type { Category, Profile } from './types'

export function defaultProfiles(now: number): Profile[] {
  return [
    { id: 'u1', name: 'Usuário 1', updatedAt: now, updatedBy: 'u1' },
    { id: 'u2', name: 'Usuário 2', updatedAt: now, updatedBy: 'u1' },
  ]
}

export const PAYMENT_CATEGORY_ID = 'cat-pagamento-fatura'

type Def = { id: string; name: string; kind: Category['kind']; group?: Category['group']; system?: true; examples?: string[] }

/** Categorias da planilha (aba CONFIGURAÇÕES), com os exemplos do LANÇADOR e a classificação do 50/30/20. */
export const DEFAULT_CATEGORIES: Def[] = [
  { id: 'cat-salario-u1', name: 'Salário Usuário 1', kind: 'receita' },
  { id: 'cat-salario-u2', name: 'Salário Usuário 2', kind: 'receita' },
  { id: 'cat-comissoes', name: 'Comissões', kind: 'receita' },
  { id: 'cat-outras-receitas', name: 'Outras receitas', kind: 'receita' },

  { id: 'cat-moradia', name: 'Moradia', kind: 'despesa', group: 'necessidade', examples: ['Aluguel / financiamento', 'Condomínio', 'IPTU / taxas municipais', 'Seguro residencial', 'Manutenção e reparos', 'Mobília e decoração', 'Jardinagem / paisagismo', 'Piscina e manutenção', 'Segurança residencial'] },
  { id: 'cat-servicos', name: 'Contas de serviços', kind: 'despesa', group: 'necessidade', examples: ['Energia elétrica', 'Água e esgoto', 'Gás', 'Internet / TV / streaming', 'Telefone fixo / celular', 'Serviços de limpeza ou zeladoria'] },
  { id: 'cat-alimentacao', name: 'Alimentação', kind: 'despesa', group: 'necessidade', examples: ['Supermercado', 'Feiras e hortifrúti', 'Restaurantes e delivery', 'Lanches e cafés', 'Bebidas alcoólicas / vinhos', 'Assinaturas de cestas ou kits de refeição'] },
  { id: 'cat-transporte', name: 'Transporte', kind: 'despesa', group: 'necessidade', examples: ['Combustível', 'Transporte público', 'Manutenção do carro', 'Seguro do veículo', 'Estacionamento e pedágios', 'Aplicativos de transporte', 'Transporte escolar', 'Licenciamento de veículos', 'Manutenção de bicicletas ou scooters'] },
  { id: 'cat-saude', name: 'Saúde e bem-estar', kind: 'despesa', group: 'necessidade', examples: ['Plano de saúde', 'Consultas médicas e odontológicas', 'Medicamentos', 'Exames e tratamentos', 'Terapias', 'Vacinação', 'Produtos de higiene pessoal', 'Cosméticos e estética', 'Academia / esportes', 'Suplementos / produtos naturais'] },
  { id: 'cat-educacao', name: 'Educação e desenvolvimento', kind: 'despesa', group: 'necessidade', examples: ['Mensalidades escolares / universitárias', 'Material escolar', 'Cursos extracurriculares', 'Livros e assinaturas educacionais', 'Cursos online / apps educacionais', 'Eventos, feiras e congressos', 'Preparação para concursos ou certificações'] },
  { id: 'cat-lazer', name: 'Lazer e entretenimento', kind: 'despesa', group: 'desejo', examples: ['Streaming', 'Cinema / teatro', 'Viagens e hospedagem', 'Hobbies e atividades recreativas', 'Equipamentos esportivos', 'Jogos e videogames', 'Clubes ou associações', 'Eventos culturais e esportivos'] },
  { id: 'cat-vestuario', name: 'Vestuário', kind: 'despesa', group: 'desejo', examples: ['Roupas', 'Calçados', 'Acessórios', 'Lavanderia e ajustes'] },
  { id: 'cat-poupanca', name: 'Poupança e investimentos', kind: 'despesa', group: 'necessidade', examples: ['Reserva de emergência', 'Previdência privada', 'Investimentos financeiros', 'Aportes para aposentadoria'] },
  { id: 'cat-seguros', name: 'Seguros e impostos', kind: 'despesa', group: 'necessidade', examples: ['Seguro de vida', 'Seguro de veículo', 'Seguro residencial', 'Impostos sobre bens', 'Taxas bancárias'] },
  { id: 'cat-filhos', name: 'Filhos e dependentes', kind: 'despesa', group: 'necessidade', examples: ['Fraldas e alimentação infantil', 'Brinquedos e livros', 'Atividades extracurriculares', 'Babá ou creche', 'Festas de aniversário'] },
  { id: 'cat-pets', name: 'Animais de estimação', kind: 'despesa', group: 'necessidade', examples: ['Ração', 'Veterinário e vacinas', 'Higiene e acessórios', 'Seguro pet', 'Adestramento', 'Dog walker / passeios'] },
  { id: 'cat-familia', name: 'Família e social', kind: 'despesa', group: 'desejo', examples: ['Eventos familiares', 'Presentes comemorativos', 'Presentes em geral'] },
  { id: 'cat-doacoes', name: 'Doações e caridade', kind: 'despesa', group: 'necessidade', examples: ['Contribuições religiosas', 'Doações para instituições', 'Custos de voluntariado'] },
  { id: 'cat-emergencias', name: 'Emergenciais / imprevistos', kind: 'despesa', group: 'necessidade', examples: ['Despesas inesperadas'] },
  { id: PAYMENT_CATEGORY_ID, name: 'Pagamento de fatura', kind: 'despesa', system: true },

  { id: 'cat-inv-caixinha-1', name: 'Caixinha 1', kind: 'investimento' },
  { id: 'cat-inv-caixinha-2', name: 'Caixinha 2', kind: 'investimento' },
  { id: 'cat-inv-poupanca', name: 'Poupança', kind: 'investimento' },
  { id: 'cat-inv-corretora', name: 'Corretora', kind: 'investimento' },
]

/** Padrões da versão anterior que saem quando ninguém os usa nem os editou. */
export const LEGACY_DEFAULT_IDS = ['cat-salario', 'cat-assinaturas', 'cat-outros']

export const EXAMPLES: Record<string, string[]> = Object.fromEntries(
  DEFAULT_CATEGORIES.filter(d => d.examples).map(d => [d.id, d.examples!]))

/** Ids fixos: dois aparelhos que criam os padrões não geram duplicatas. */
export function defaultCategories(now: number): Category[] {
  return DEFAULT_CATEGORIES.map(({ examples: _e, ...d }) => ({ ...d, updatedAt: now, updatedBy: 'u1' as const }))
}
