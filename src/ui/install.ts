import { useEffect, useState } from 'react'

/** Navegadores embutidos em apps (Instagram, Facebook, LinkedIn, TikTok, webviews do Android):
 *  o Google não deixa fazer login neles. */
export function isInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|TikTok|musical_ly|Line\/|Snapchat|Pinterest|; wv\)/i.test(ua)
}

export function isIos(ua: string): boolean {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
}

export function isInstalled(): boolean {
  return typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
}

interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

// O navegador avisa uma vez, às vezes antes da tela montar: guardamos o aviso aqui.
let deferred: InstallEvent | null = null
const subs = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as InstallEvent; subs.forEach(f => f()) })
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach(f => f()) })
}

/** Instalar o app: botão nos navegadores que permitem (Chrome, Edge, Android) e dica no iPhone. */
export function useInstall() {
  const [, tick] = useState(0)
  useEffect(() => { const f = () => tick(n => n + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  return {
    installed: isInstalled(),
    canPrompt: !!deferred,
    ios: isIos(ua),
    inApp: isInAppBrowser(ua),
    prompt: async () => { if (!deferred) return; await deferred.prompt(); await deferred.userChoice; deferred = null; tick(n => n + 1) },
  }
}
