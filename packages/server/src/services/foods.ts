import { foodInputSchema, type Food } from '@diyetgo/shared'
import { and, countDistinct, eq, ilike, isNull, or } from 'drizzle-orm'
import type { Db } from '../db/client'
import { foods, planMealItems, planMeals } from '../db/schema'
import { ApiError, isRestrictViolation, parse } from '../errors'
import { byIdAndOwner, checkId, escapeLike, found, isValidId, now, setArchivedValue, toRecord, trCollate } from './common'

export function createFoodService(db: Db, ownerId: string) {
  async function getRow(id: string) {
    checkId(id, 'Besin')
    return found((await db.select().from(foods).where(byIdAndOwner(foods, id, ownerId)))[0], 'Besin')
  }

  return {
    async list({ includeArchived = false, search }: { includeArchived?: boolean; search?: string } = {}): Promise<Food[]> {
      const term = search?.trim()
      const pattern = term ? `%${escapeLike(term)}%` : undefined
      const rows = await db
        .select()
        .from(foods)
        .where(
          and(
            eq(foods.ownerId, ownerId),
            includeArchived ? undefined : isNull(foods.archivedAt),
            pattern ? or(ilike(foods.name, pattern), ilike(foods.brand, pattern)) : undefined,
          ),
        )
        .orderBy(trCollate(foods.name))
      return rows.map(toRecord)
    },

    async get(id: string): Promise<Food> {
      return toRecord(await getRow(id))
    },

    async create(input: unknown): Promise<Food> {
      const [row] = await db
        .insert(foods)
        .values({ ...parse(foodInputSchema, input), ownerId })
        .returning()
      return toRecord(row!)
    },

    async update(id: string, input: unknown): Promise<Food> {
      const values = parse(foodInputSchema, input)
      await getRow(id)
      const [row] = await db
        .update(foods)
        .set({ ...values, updatedAt: now })
        .where(byIdAndOwner(foods, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    async setArchived(id: string, archived: boolean): Promise<Food> {
      await getRow(id)
      const [row] = await db
        .update(foods)
        .set({ archivedAt: setArchivedValue(foods.archivedAt, archived), updatedAt: now })
        .where(byIdAndOwner(foods, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    /** Bir öğün içeriğinde kullanılan besin veritabanındaki `RESTRICT` nedeniyle silinemez. */
    async remove(id: string): Promise<void> {
      await getRow(id)
      try {
        await db.delete(foods).where(byIdAndOwner(foods, id, ownerId))
      } catch (error) {
        if (isRestrictViolation(error)) {
          throw new ApiError('restricted', 'Bu besin bir planda kullanılıyor. Silmek yerine arşivleyin.')
        }
        throw error
      }
    },

    /** Besini kullanan plan sayısı. */
    async countPlansUsing(id: string): Promise<number> {
      // Olmayan, geçersiz veya başka diyetisyene ait besin hiçbir planda kullanılmaz (demo moduyla aynı).
      if (!isValidId(id)) return 0
      const [row] = await db
        .select({ count: countDistinct(planMeals.mealPlanId) })
        .from(planMealItems)
        .innerJoin(planMeals, eq(planMeals.id, planMealItems.planMealId))
        .innerJoin(foods, eq(foods.id, planMealItems.foodId))
        .where(and(eq(planMealItems.foodId, id), eq(foods.ownerId, ownerId)))
      return row?.count ?? 0
    },
  }
}
