import { addMonths, clampDay, lastDayOfMonth, monthOf } from '../../src/domain/dates'

test('datas', () => {
  expect(addMonths('2026-11', 3)).toBe('2027-02')
  expect(addMonths('2026-01', -1)).toBe('2025-12')
  expect(monthOf('2026-11-15')).toBe('2026-11')
  expect(lastDayOfMonth('2026-02')).toBe(28)
  expect(lastDayOfMonth('2028-02')).toBe(29)
  expect(clampDay('2026-02', 31)).toBe('2026-02-28')
})
