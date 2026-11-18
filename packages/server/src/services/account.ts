/**
 * Hesap silme: diyetisyenin tüm kayıtları tek işlemde silinir, ardından Better Auth kullanıcıyı,
 * oturumlarını ve parola kaydını siler (bkz. `auth.ts`, `user.deleteUser`). Geri alınamaz.
 */
import { eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import {
  appointments,
  clientConditions,
  clientGoals,
  clientMedications,
  clientRecommendations,
  clients,
  foods,
  mealPlans,
  mealTypes,
  measurements,
  recipeIngredients,
  users,
} from '../db/schema'

/**
 * Silme sırası `RESTRICT` bağlarına göredir: önce planlar (öğün ve içerikleri `CASCADE` ile gider) ve
 * danışana bağlı kayıtlar, sonra tarif malzemeleri, besin, öğün türü, danışanlar ve en son kullanıcı.
 *
 * Her şey tek işlemdedir: kullanıcı satırı en başta kilitlenir (aynı anda kayıt ekleyen istekler
 * bekler, `owner_id` bağı satır kilidi ister) ve kullanıcı satırı aynı işlemde silinir; oturumlar ve
 * parola kaydı `CASCADE` ile gider. Böylece silme ya tamamen olur ya hiç olmaz; veri gidip hesap
 * kilitli kalamaz. Better Auth'un sonraki silme adımları artık silinecek bir şey bulamaz.
 */
export async function deleteOwnerData(db: Db, ownerId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(sql`select id from users where id = ${ownerId} for update`)
    await tx.delete(mealPlans).where(eq(mealPlans.ownerId, ownerId))
    for (const table of [appointments, clientGoals, measurements, clientMedications, clientConditions, clientRecommendations]) {
      await tx.delete(table).where(eq(table.ownerId, ownerId))
    }
    const ownFoods = tx.select({ id: foods.id }).from(foods).where(eq(foods.ownerId, ownerId))
    await tx.delete(recipeIngredients).where(inArray(recipeIngredients.recipeId, ownFoods))
    await tx.delete(foods).where(eq(foods.ownerId, ownerId))
    await tx.delete(mealTypes).where(eq(mealTypes.ownerId, ownerId))
    await tx.delete(clients).where(eq(clients.ownerId, ownerId))
    await tx.delete(users).where(eq(users.id, ownerId))
  })
}
