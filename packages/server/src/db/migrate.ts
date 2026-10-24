/** `npm run db:migrate`: bekleyen migration'ları `DATABASE_URL` veritabanına uygular. */
import { describeDatabaseUrl, requireEnv } from '../env'
import { applyMigrations, createDb } from './client'

const url = requireEnv('DATABASE_URL')
console.log(`Migration hedefi: ${describeDatabaseUrl(url)}`)

const db = createDb(url)
try {
  await applyMigrations(db)
  console.log('Migration\'lar uygulandı.')
} finally {
  await db.$client.end()
}
