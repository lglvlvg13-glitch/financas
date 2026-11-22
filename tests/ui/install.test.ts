import { isInAppBrowser } from '../../src/ui/install'

test('reconhece navegadores embutidos onde o Google bloqueia o login', () => {
  expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0')).toBe(true)
  expect(isInAppBrowser('Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 [FBAN/FBIOS;FBAV/440.0]')).toBe(true)
  expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36')).toBe(true)
  // Navegadores comuns: o login funciona.
  expect(isInAppBrowser('Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36')).toBe(false)
  expect(isInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')).toBe(false)
  expect(isInAppBrowser('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0')).toBe(false)
})
