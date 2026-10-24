/** Testlerden önce bir kez: hedefi doğrular ve migration'ları test veritabanına uygular. */
import { applyMigrations, createDb } from '../db/client'
import { testDatabaseUrl } from './test-database'

export default async function setup() {
  const db = createDb(testDatabaseUrl())
  try {
    await applyMigrations(db)
  } finally {
    await db.$client.end()
  }
}
