import { createApp } from './app'
import { createDb } from './db/client'
import { describeDatabaseUrl, requireEnv } from './env'

const databaseUrl = requireEnv('DATABASE_URL')
const port = Number(process.env.PORT ?? 3001)
// Kimlik doğrulama olmadığı için yalnızca bu makineden erişilir (CLAUDE.md §9).
const host = '127.0.0.1'

createApp(createDb(databaseUrl)).listen(port, host, () => {
  console.log(`Dietgo API: http://${host}:${port}/api (veritabanı: ${describeDatabaseUrl(databaseUrl)})`)
})
