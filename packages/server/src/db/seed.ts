/**
 * `npm run db:seed`: `@diyetgo/shared/seed` içindeki kurgusal verileri `DATABASE_URL` veritabanına yükler.
 *
 * Kimlikler sabit olduğu için tekrar çalıştırıldığında mevcut kayıtlar atlanır, çoğalmaz.
 * Tarihler seed'in ilk çalıştırıldığı güne göre hesaplanır.
 */
import { istanbulDateOf } from '@diyetgo/shared'
import { createSeedData } from '@diyetgo/shared/seed'
import { describeDatabaseUrl, requireEnv } from '../env'
import { createDb } from './client'
import * as t from './schema'

const url = requireEnv('DATABASE_URL')
console.log(`Seed hedefi: ${describeDatabaseUrl(url)}`)

const seed = createSeedData(istanbulDateOf(new Date()))
const db = createDb(url)
try {
  const inserted = await db.transaction(async (tx) => {
    // Üst kayıtlar önce eklenir (yabancı anahtar sırası).
    const steps = [
      ['clients', t.clients, seed.clients],
      ['foods', t.foods, seed.foods],
      ['meal_types', t.mealTypes, seed.mealTypes],
      ['measurements', t.measurements, seed.measurements],
      ['meal_plans', t.mealPlans, seed.mealPlans],
      ['plan_meals', t.planMeals, seed.planMeals],
      ['plan_meal_items', t.planMealItems, seed.planMealItems],
      ['appointments', t.appointments, seed.appointments],
      ['client_goals', t.clientGoals, seed.clientGoals],
    ] as const
    const counts: Record<string, number> = {}
    for (const [name, table, rows] of steps) {
      const result = await tx.insert(table).values(rows).onConflictDoNothing().returning({ id: table.id })
      counts[name] = result.length
    }
    return counts
  })
  console.log('Eklenen kayıtlar (mevcut olanlar atlandı):', inserted)
} finally {
  await db.$client.end()
}
