import { defineConfig } from 'drizzle-kit'

// Yalnızca `drizzle-kit generate` için kullanılır; veritabanına bağlanmaz.
// Migration'lar `npm run db:migrate` ile, hedef veritabanı yazdırılarak uygulanır.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
