import { sql } from 'drizzle-orm'
import { createDb } from '../db/client'
import { testDatabaseUrl } from './test-database'

// `testDatabaseUrl()` adı doğrulamadan geçmezse bağlantı hiç kurulmaz.
export const db = createDb(testDatabaseUrl())

/** Tüm tabloları boşaltır. Yalnızca doğrulanmış test veritabanında çalışır. */
export async function resetDatabase() {
  await db.execute(sql`
    truncate table recipe_ingredients, plan_meal_items, plan_meals, meal_plans, appointments, client_goals,
      measurements, client_medications, client_conditions, client_recommendations, clients, foods, meal_types,
      sessions, accounts, verifications, users
  `)
}
