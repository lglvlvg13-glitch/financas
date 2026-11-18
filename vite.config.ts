import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// No GitHub Pages o app fica em /<nome-do-repositório>/; o workflow passa BASE_PATH.
const base = process.env.BASE_PATH ?? '/'
const demo = process.env.VITE_DEMO === '1'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      disable: demo,
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Finanças da Família',
        short_name: 'Finanças',
        description: 'Controle financeiro da família, guardado no Google Drive de vocês.',
        lang: 'pt-BR',
        display: 'standalone',
        start_url: base,
        scope: base,
        background_color: '#f5f6f0',
        theme_color: '#1f2a12',
        // Atalhos ao segurar o ícone do app no celular.
        shortcuts: [
          { name: 'Novo lançamento', short_name: 'Lançar', url: `${base}?abrir=novo`, icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
          { name: 'Importar extrato', short_name: 'Importar', url: `${base}?abrir=importar`, icons: [{ src: 'icon-192.png', sizes: '192x192' }] },
        ],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        navigateFallback: 'index.html',
        // Chamadas ao Google nunca vão para o cache.
        navigateFallbackDenylist: [/^\/__/],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    testTimeout: 20000,
  },
})
