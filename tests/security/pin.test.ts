import { makePinLock, checkPin } from '../../src/security/pin'

test('PIN guardado como hash com sal; confere só o certo', async () => {
  const lock = await makePinLock('4821')
  expect(JSON.stringify(lock)).not.toContain('4821')
  expect(await checkPin(lock, '4821')).toBe(true)
  expect(await checkPin(lock, '4822')).toBe(false)
  const other = await makePinLock('4821')
  expect(other.hash).not.toBe(lock.hash)
})
