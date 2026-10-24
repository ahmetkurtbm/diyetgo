import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import { sql } from 'drizzle-orm'
import express from 'express'
import type { Auth } from './auth'
import type { Db } from './db/client'
import { ApiError, errorHandler } from './errors'
import { appointmentsRouter } from './routes/appointments'
import { clientsRouter } from './routes/clients'
import { foodsRouter, mealTypesRouter } from './routes/foods'
import { mealPlansRouter, planMealItemsRouter, planMealsRouter } from './routes/meal-plans'
import { conditionsRouter, goalsRouter, measurementsRouter, medicationsRouter, recommendationsRouter } from './routes/records'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]'])

export function createApp(db: Db, auth: Auth) {
  const app = express()
  app.disable('x-powered-by')
  // API henüz yayına alınmadı; yalnızca yerel adla gelen istekler kabul edilir. Bu, başka bir sitenin
  // DNS rebinding ile 127.0.0.1'e yönlenip API'yi kendi kökeninden kullanmasını engeller.
  app.use((req, _res, next) => {
    if (!LOCAL_HOSTNAMES.has(req.hostname)) throw new ApiError('forbidden', 'Bu API yalnızca yerel adresten kullanılabilir.')
    next()
  })

  // Better Auth kendi gövde ayrıştırmasını yapar; bu yüzden `express.json()`'dan önce bağlanır.
  app.all('/api/auth/*splat', toNodeHandler(auth))
  app.use(express.json())

  /** API'nin ve veritabanı bağlantısının çalıştığını doğrular; oturum gerektirmez. */
  app.get('/api/health', async (_req, res) => {
    await db.execute(sql`select 1`)
    res.json({ status: 'ok', database: 'ok' })
  })

  // Buradan sonraki tüm uçlar oturum ister; servisler yalnızca oturum sahibinin kayıtlarını görür.
  app.use('/api', async (req, res, next) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) throw new ApiError('unauthorized', 'Oturumunuz kapalı. Lütfen giriş yapın.')
    res.locals.ownerId = session.user.id
    next()
  })
  app.use('/api/clients', clientsRouter(db))
  app.use('/api/measurements', measurementsRouter(db))
  app.use('/api/goals', goalsRouter(db))
  app.use('/api/medications', medicationsRouter(db))
  app.use('/api/conditions', conditionsRouter(db))
  app.use('/api/recommendations', recommendationsRouter(db))
  app.use('/api/foods', foodsRouter(db))
  app.use('/api/meal-types', mealTypesRouter(db))
  app.use('/api/meal-plans', mealPlansRouter(db))
  app.use('/api/plan-meals', planMealsRouter(db))
  app.use('/api/plan-meal-items', planMealItemsRouter(db))
  app.use('/api/appointments', appointmentsRouter(db))

  app.use('/api', () => {
    throw new ApiError('not_found', 'İstenen API adresi bulunamadı.')
  })
  app.use(errorHandler)
  return app
}
