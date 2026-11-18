import { describe, expect, it, vi } from 'vitest'
import { keepUpdated } from './pwa'

function fakeSw(controller: object | null) {
  const listeners: Record<string, () => void> = {}
  const update = vi.fn().mockResolvedValue(undefined)
  const sw = {
    controller,
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn },
    getRegistration: vi.fn().mockResolvedValue({ update }),
  } as unknown as ServiceWorkerContainer
  return { sw, update, fire: (type: string) => listeners[type]?.() }
}

describe('keepUpdated', () => {
  it('procura atualização ao abrir e recarrega uma vez quando a versão nova assume', async () => {
    const { sw, update, fire } = fakeSw({})
    const reload = vi.fn()
    keepUpdated(sw, reload)
    await Promise.resolve(); await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(1)
    fire('controllerchange'); fire('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('não recarrega na primeira instalação', () => {
    const { sw, fire } = fakeSw(null)
    const reload = vi.fn()
    keepUpdated(sw, reload)
    fire('controllerchange')
    expect(reload).not.toHaveBeenCalled()
  })

  it('procura de novo quando o app volta para a tela', async () => {
    const { sw, update } = fakeSw({})
    keepUpdated(sw, vi.fn())
    await Promise.resolve(); await Promise.resolve()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve(); await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(2)
  })
})
