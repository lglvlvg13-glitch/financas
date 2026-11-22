import { AREAS, DEFAULT_PCT, areaOf, areaPlan, goalProgress, goalId, isGoalId, planPct, termFor } from '../../src/domain/goals'
import type { Goal } from '../../src/domain/goals'
import type { Category, Transaction } from '../../src/domain/types'

const meta = { updatedAt: 1, updatedBy: 'u1' as const }
const tx = (p: Partial<Transaction> & { id: string }): Transaction => ({
  kind: 'despesa', amountCents: 10000, date: '2026-11-10', categoryId: 'cat-alimentacao', profileId: 'u1', accountId: 'a1', ...meta, ...p,
})
const cats: Category[] = [
  { id: 'cat-alimentacao', name: 'Alimentação', kind: 'despesa', group: 'necessidade', items: [{ name: 'Restaurantes e delivery', group: 'desejo' }], ...meta },
  { id: 'cat-lazer', name: 'Lazer', kind: 'despesa', group: 'desejo', ...meta },
  { id: 'cat-doacoes', name: 'Generosidade', kind: 'despesa', group: 'necessidade', ...meta },
  { id: 'cat-poupanca', name: 'Poupança e investimentos', kind: 'despesa', group: 'necessidade', ...meta },
  { id: 'cat-inv-corretora', name: 'Corretora', kind: 'investimento', ...meta },
  { id: 'cat-salario-u1', name: 'Salário', kind: 'receita', ...meta },
]
const goal = (p: Partial<Goal> & { id: string }): Goal => ({ name: 'Meta', area: 'desejos', term: 'curto', ...meta, ...p })

test('as 5 áreas, na ordem pedida, com as subáreas', () => {
  expect(AREAS.map(a => a.name)).toEqual(['Generosidade', 'Necessidades', 'Desejos', 'Poupanças', 'Investimentos'])
  expect(AREAS.find(a => a.id === 'generosidade')!.subs).toEqual(['Dízimos', 'Ofertas', 'Doações'])
  expect(AREAS.find(a => a.id === 'desejos')!.subs).toEqual(['Física', 'Mental', 'Família', 'Financeira', 'Social'])
  expect(AREAS.find(a => a.id === 'poupancas')!.subs).toEqual(['Reserva de emergência', 'Curto prazo', 'Objetivos'])
  expect(AREAS.find(a => a.id === 'investimentos')!.subs).toEqual(['Aposentadoria', 'Patrimônio', 'Educação dos filhos'])
  expect(Object.values(DEFAULT_PCT).reduce((s, v) => s + v, 0)).toBe(100)
})

test('prazo pela data: até 1 ano é curto, até 5 anos médio, depois longo', () => {
  expect(termFor('2027-11-22', '2026-11-22')).toBe('curto')
  expect(termFor('2027-12-01', '2026-11-22')).toBe('medio')
  expect(termFor('2031-11-22', '2026-11-22')).toBe('medio')
  expect(termFor('2031-12-01', '2026-11-22')).toBe('longo')
})

test('ids das metas ficam junto das preferências sem se misturar com elas', () => {
  expect(isGoalId(goalId('abc'))).toBe(true)
  expect(isGoalId('app')).toBe(false)
  expect(isGoalId('plan')).toBe(false)
})

test('plano: usa o salvo e completa o que faltar com o padrão', () => {
  expect(planPct(undefined)).toEqual(DEFAULT_PCT)
  expect(planPct({ id: 'plan', pct: { generosidade: 15 }, ...meta })).toEqual({ ...DEFAULT_PCT, generosidade: 15 })
})

test('área de cada lançamento', () => {
  const byCat = new Map(cats.map(c => [c.id, c]))
  const goals = new Map([['goal:viagem', goal({ id: 'goal:viagem', area: 'poupancas' })]])
  const area = (t: Transaction) => areaOf(t, byCat, goals)
  expect(area(tx({ id: '1' }))).toBe('necessidades')
  expect(area(tx({ id: '2', item: 'Restaurantes e delivery' }))).toBe('desejos')
  expect(area(tx({ id: '3', categoryId: 'cat-lazer', group: 'necessidade' }))).toBe('necessidades')
  expect(area(tx({ id: '4', categoryId: 'cat-doacoes' }))).toBe('generosidade')
  expect(area(tx({ id: '5', categoryId: 'cat-poupanca' }))).toBe('poupancas')
  expect(area(tx({ id: '6', kind: 'investimento', categoryId: 'cat-inv-corretora' }))).toBe('investimentos')
  expect(area(tx({ id: '7', kind: 'receita', categoryId: 'cat-salario-u1' }))).toBeNull()
  // A meta escolhida no lançamento decide a área.
  expect(area(tx({ id: '8', categoryId: 'cat-lazer', goalId: 'goal:viagem' }))).toBe('poupancas')
  // Meta excluída: volta para a regra da categoria.
  expect(area(tx({ id: '9', categoryId: 'cat-lazer', goalId: 'goal:apagada' }))).toBe('desejos')
})

test('divisão da renda: planejado pela % da renda e realizado por área', () => {
  const txs = [
    tx({ id: 'r', kind: 'receita', categoryId: 'cat-salario-u1', amountCents: 1000000 }),
    tx({ id: 'd', categoryId: 'cat-doacoes', amountCents: 100000 }),
    tx({ id: 'n', amountCents: 450000 }),
    tx({ id: 'w', categoryId: 'cat-lazer', amountCents: 250000 }),
    tx({ id: 'p', categoryId: 'cat-poupanca', amountCents: 50000 }),
    tx({ id: 'i', kind: 'investimento', categoryId: 'cat-inv-corretora', amountCents: 150000 }),
    tx({ id: 'fora', date: '2026-10-31', amountCents: 999900 }),
  ]
  const r = areaPlan({ from: '2026-11-01', to: '2026-11-30' }, { transactions: txs, categories: cats, cards: [] }, { today: '2026-11-22' }, DEFAULT_PCT, [])
  expect(r.incomeCents).toBe(1000000)
  const by = Object.fromEntries(r.rows.map(x => [x.area, x]))
  expect(by.generosidade).toMatchObject({ pct: 10, plannedCents: 100000, realCents: 100000, inside: true })
  expect(by.necessidades).toMatchObject({ pct: 50, plannedCents: 500000, realCents: 450000, inside: true })
  // Desejos acima do planejado está fora do plano.
  expect(by.desejos).toMatchObject({ plannedCents: 200000, realCents: 250000, inside: false, diffCents: -50000 })
  // Poupanças abaixo do planejado também está fora (o plano é juntar pelo menos isso).
  expect(by.poupancas).toMatchObject({ plannedCents: 100000, realCents: 50000, inside: false })
  expect(by.investimentos).toMatchObject({ plannedCents: 100000, realCents: 150000, inside: true })
  expect(r.totalPct).toBe(100)
})

test('progresso da meta com valor: soma os lançamentos pagos ligados a ela', () => {
  const g = goal({ id: 'goal:carro', area: 'poupancas', targetCents: 1200000, deadline: '2027-11-30' })
  const txs = [
    tx({ id: 'a', goalId: g.id, amountCents: 300000, date: '2026-09-10' }),
    tx({ id: 'b', goalId: g.id, amountCents: 100000, date: '2026-10-10' }),
    tx({ id: 'c', goalId: g.id, amountCents: 100000, date: '2026-12-10', pending: true }),
    tx({ id: 'x', goalId: g.id, amountCents: 999900, deletedAt: 5 }),
    tx({ id: 'y', amountCents: 500000 }),
  ]
  const p = goalProgress(g, txs, '2026-11-22')
  expect(p).toMatchObject({ doneCents: 400000, pendingCents: 100000, remainingCents: 800000, pct: 33, monthsLeft: 12, perMonthCents: 66667 })
  expect(p.reached).toBe(false)
})

test('meta alcançada e meta sem valor', () => {
  const g = goal({ id: 'goal:x', targetCents: 100000 })
  expect(goalProgress(g, [tx({ id: 'a', goalId: g.id, amountCents: 150000 })], '2026-11-22')).toMatchObject({ pct: 100, remainingCents: 0, reached: true })
  const semValor = goal({ id: 'goal:correr', area: 'desejos', sub: 'Física' })
  expect(goalProgress(semValor, [], '2026-11-22')).toMatchObject({ reached: false, pct: undefined })
  expect(goalProgress({ ...semValor, doneAt: '2026-11-20' }, [], '2026-11-22').reached).toBe(true)
})

test('prazo vencido: não pede valor por mês negativo', () => {
  const g = goal({ id: 'goal:v', targetCents: 100000, deadline: '2026-10-31' })
  expect(goalProgress(g, [], '2026-11-22')).toMatchObject({ monthsLeft: 0, perMonthCents: undefined, late: true })
})
