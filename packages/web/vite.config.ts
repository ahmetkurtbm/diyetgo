import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Ana ekrana eklenebilen uygulama (PWA). Service worker yalnızca derlenmiş uygulamada çalışır;
    // uygulama dosyalarını önbelleğe alır, veriyi (localStorage veya API) önbelleğe almaz.
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Dietgo',
        short_name: 'Dietgo',
        description: 'Diyetisyenler için danışan, beslenme planı ve randevu yönetimi (demo).',
        lang: 'tr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#047857',
        background_color: '#f8fafc',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // Tek sayfalı uygulama: çevrimdışı açılan her adres index.html'e düşer; API istekleri hariç.
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  // API modunda (`VITE_DATA_MODE=api`) geliştirme sunucusu `/api` isteklerini yerel Express'e iletir.
  // Port, server ile aynı şekilde kökteki .env dosyasındaki `PORT`'tan okunur; yalnızca bu yapılandırmada kullanılır.
  server: {
    proxy: { '/api': `http://127.0.0.1:${loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), 'PORT').PORT ?? '3001'}` },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./src/test-setup.ts'],
  },
}))
