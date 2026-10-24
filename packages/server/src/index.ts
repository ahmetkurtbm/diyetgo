import { createApp } from './app'
import { createAuth } from './auth'
import { createDb } from './db/client'
import { describeDatabaseUrl, requireEnv } from './env'

const databaseUrl = requireEnv('DATABASE_URL')
const port = Number(process.env.PORT ?? 3001)
// Henüz yayına alınmadı; yalnızca bu makineden erişilir (CLAUDE.md §9).
const host = '127.0.0.1'

const db = createDb(databaseUrl)
const auth = createAuth(db, {
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
  secret: requireEnv('BETTER_AUTH_SECRET'),
})

createApp(db, auth).listen(port, host, () => {
  console.log(`Diyetgo API: http://${host}:${port}/api (veritabanı: ${describeDatabaseUrl(databaseUrl)})`)
})
