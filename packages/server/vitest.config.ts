import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globalSetup: ['./src/test/global-setup.ts'],
    // Test dosyaları aynı veritabanını kullandığı için sırayla çalışır.
    fileParallelism: false,
  },
})
