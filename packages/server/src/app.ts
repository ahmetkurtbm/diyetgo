import express from 'express'
import { sql } from 'drizzle-orm'
import type { Db } from './db/client'
import { ApiError, errorHandler } from './errors'
import { clientsRouter } from './routes/clients'

export function createApp(db: Db) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json())

  /** API'nin ve veritabanı bağlantısının çalıştığını doğrular. */
  app.get('/api/health', async (_req, res) => {
    await db.execute(sql`select 1`)
    res.json({ status: 'ok', database: 'ok' })
  })
  app.use('/api/clients', clientsRouter(db))

  app.use('/api', () => {
    throw new ApiError('not_found', 'İstenen API adresi bulunamadı.')
  })
  app.use(errorHandler)
  return app
}
