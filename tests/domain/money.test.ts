import { formatBRL, parseBRL, splitCents } from '../../src/domain/money'

test('formata centavos em reais', () => {
  expect(formatBRL(123456)).toBe('R$ 1.234,56')
  expect(formatBRL(-500)).toBe('-R$ 5,00')
  expect(formatBRL(0)).toBe('R$ 0,00')
})

test('lê texto digitado', () => {
  expect(parseBRL('1.234,56')).toBe(123456)
  expect(parseBRL('R$ 10')).toBe(1000)
  expect(parseBRL('10,5')).toBe(1050)
  expect(parseBRL('abc')).toBeNull()
})

test('splitCents põe a sobra nas primeiras partes', () => {
  expect(splitCents(10000, 3)).toEqual([3334, 3333, 3333])
  expect(splitCents(9, 2)).toEqual([5, 4])
})
