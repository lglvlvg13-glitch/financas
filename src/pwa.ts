/**
 * Mantém o app instalado sempre na versão mais nova.
 * Procura atualização ao abrir o app e sempre que ele volta para a tela;
 * quando a versão nova assume (skipWaiting + clientsClaim), recarrega uma vez.
 */
export function keepUpdated(sw: ServiceWorkerContainer | undefined = navigator.serviceWorker, reload = () => location.reload()) {
  if (!sw) return
  const hadController = !!sw.controller
  let reloading = false
  sw.addEventListener('controllerchange', () => {
    // Na primeira instalação não há versão antiga para trocar.
    if (!hadController || reloading) return
    reloading = true
    reload()
  })
  const check = () => { sw.getRegistration().then(r => r?.update()).catch(() => {}) }
  check()
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check() })
}
