import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
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
