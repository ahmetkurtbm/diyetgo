/**
 * `npm run db:seed`: demo diyetisyen hesabını ve `@diyetgo/shared/seed` içindeki kurgusal verileri
 * `DATABASE_URL` veritabanına yükler.
 *
 * - Hesap: `diyetisyen@example.com`; parola .env içindeki `SEED_DIETITIAN_PASSWORD`'dür. Parola her
 *   çalıştırmada bu değere eşitlenir; Better Auth'un parola özeti (scrypt) saklanır.
 * - Veriler bu hesaba aittir. Kimlikler sabit olduğu için tekrar çalıştırıldığında mevcut kayıtlar
 *   atlanır, çoğalmaz. Tarihler seed'in ilk çalıştırıldığı güne göre hesaplanır.
 */
import { istanbulDateOf } from '@diyetgo/shared'
import { createSeedData } from '@diyetgo/shared/seed'
import { hashPassword } from 'better-auth/crypto'
import { and, eq } from 'drizzle-orm'
import { MIN_PASSWORD_LENGTH } from '../auth'
import { describeDatabaseUrl, requireEnv } from '../env'
import { createDb } from './client'
import * as t from './schema'

/** `0001_multi_dietitian_auth` migration'ının mevcut kayıtları bağladığı hesapla aynıdır. */
const DEMO_DIETITIAN = { id: '0000000a-0000-4000-8000-000000000001', name: 'Demo Diyetisyen', email: 'diyetisyen@example.com' }

const url = requireEnv('DATABASE_URL')
const password = requireEnv('SEED_DIETITIAN_PASSWORD')
if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`SEED_DIETITIAN_PASSWORD en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`)
console.log(`Seed hedefi: ${describeDatabaseUrl(url)}`)

const seed = createSeedData(istanbulDateOf(new Date()))
const ownerId = DEMO_DIETITIAN.id
const owned = <T extends object>(rows: T[]) => rows.map((row) => ({ ...row, ownerId }))
const db = createDb(url)
try {
  const passwordHash = await hashPassword(password)
  const inserted = await db.transaction(async (tx) => {
    await tx
      .insert(t.users)
      .values({ ...DEMO_DIETITIAN, emailVerified: true })
      .onConflictDoNothing()
    const [credential] = await tx
      .select({ id: t.accounts.id })
      .from(t.accounts)
      .where(and(eq(t.accounts.userId, ownerId), eq(t.accounts.providerId, 'credential')))
    if (credential) {
      await tx.update(t.accounts).set({ password: passwordHash, updatedAt: new Date() }).where(eq(t.accounts.id, credential.id))
    } else {
      await tx.insert(t.accounts).values({ userId: ownerId, accountId: ownerId, providerId: 'credential', password: passwordHash })
    }

    // Üst kayıtlar önce eklenir (yabancı anahtar sırası). Plan öğünleri ve içerikleri planın sahibine aittir.
    const steps = [
      ['clients', t.clients, owned(seed.clients)],
      ['foods', t.foods, owned(seed.foods)],
      ['meal_types', t.mealTypes, owned(seed.mealTypes)],
      ['measurements', t.measurements, owned(seed.measurements)],
      ['meal_plans', t.mealPlans, owned(seed.mealPlans)],
      ['plan_meals', t.planMeals, seed.planMeals],
      ['plan_meal_items', t.planMealItems, seed.planMealItems],
      ['appointments', t.appointments, owned(seed.appointments)],
      ['client_goals', t.clientGoals, owned(seed.clientGoals)],
    ] as const
    const counts: Record<string, number> = {}
    for (const [name, table, rows] of steps) {
      const result = await tx.insert(table).values(rows).onConflictDoNothing().returning({ id: table.id })
      counts[name] = result.length
    }
    return counts
  })
  console.log('Eklenen kayıtlar (mevcut olanlar atlandı):', inserted)
  console.log(`Demo hesabı: ${DEMO_DIETITIAN.email} (parola: .env içindeki SEED_DIETITIAN_PASSWORD)`)
} finally {
  await db.$client.end()
}
