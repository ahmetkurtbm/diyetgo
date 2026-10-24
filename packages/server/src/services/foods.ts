import {
  foodInputSchema,
  foodKindChangeIssue,
  recipeIngredientIssue,
  recipeIngredientsInputSchema,
  type Food,
  type RecipeIngredient,
} from '@diyetgo/shared'
import { and, asc, countDistinct, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import type { Db } from '../db/client'
import { foods, planMealItems, planMeals, recipeIngredients } from '../db/schema'
import { ApiError, isRestrictViolation, parse } from '../errors'
import { byIdAndOwner, checkId, escapeLike, found, isValidId, now, setArchivedValue, toRecord, trCollate, type Executor } from './common'

export function createFoodService(db: Db, ownerId: string) {
  async function getRow(id: string, executor: Executor = db) {
    checkId(id, 'Besin')
    return found((await executor.select().from(foods).where(byIdAndOwner(foods, id, ownerId)))[0], 'Besin')
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
      return db.transaction(async (tx) => {
        const existing = await getRow(id, tx)
        const issue = foodKindChangeIssue(existing.recipeYieldG !== null, values.recipeYieldG !== null, {
          hasIngredients: (await tx.select({ id: recipeIngredients.id }).from(recipeIngredients).where(eq(recipeIngredients.recipeId, id)).limit(1)).length > 0,
          usedAsIngredient: (await tx.select({ id: recipeIngredients.id }).from(recipeIngredients).where(eq(recipeIngredients.foodId, id)).limit(1)).length > 0,
        })
        if (issue) throw new ApiError('validation', `${issue.message}.`, { fieldErrors: { [issue.field]: issue.message } })
        const [row] = await tx
          .update(foods)
          .set({ ...values, updatedAt: now })
          .where(byIdAndOwner(foods, id, ownerId))
          .returning()
        return toRecord(row!)
      })
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
          throw new ApiError('restricted', 'Bu besin bir planda veya tarifte kullanılıyor. Silmek yerine arşivleyin.')
        }
        throw error
      }
    },

    /** Diyetisyenin tüm tariflerinin malzemeleri; tarif değerleri bunlardan hesaplanır. */
    async listIngredients(): Promise<RecipeIngredient[]> {
      const rows = await db
        .select({ ingredient: recipeIngredients })
        .from(recipeIngredients)
        .innerJoin(foods, eq(foods.id, recipeIngredients.recipeId))
        .where(eq(foods.ownerId, ownerId))
        .orderBy(asc(recipeIngredients.recipeId), asc(recipeIngredients.sortOrder))
      return rows.map((r) => toRecord(r.ingredient))
    },

    /** Tarifin malzemelerini liste sırasıyla tek işlemde değiştirir. */
    async setIngredients(recipeId: string, input: unknown): Promise<RecipeIngredient[]> {
      const items = parse(recipeIngredientsInputSchema, input)
      return db.transaction(async (tx) => {
        const recipe = await getRow(recipeId, tx)
        if (recipe.recipeYieldG === null) throw new ApiError('validation', 'Malzeme yalnızca tariflere eklenebilir.')
        const current = new Set((await tx.select({ foodId: recipeIngredients.foodId }).from(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId))).map((r) => r.foodId))
        const ids = [...new Set(items.map((i) => i.foodId))]
        const ingredientFoods = ids.length === 0 ? [] : await tx.select().from(foods).where(and(eq(foods.ownerId, ownerId), inArray(foods.id, ids)))
        const byId = new Map(ingredientFoods.map((f) => [f.id, f]))
        for (const foodId of ids) {
          const food = byId.get(foodId)
          if (!food) throw new ApiError('not_found', 'Malzeme besini bulunamadı.')
          const issue = food.id === recipeId ? 'Bir tarif başka bir tarifin malzemesi olamaz' : recipeIngredientIssue(food, current)
          if (issue) throw new ApiError('validation', `${food.name}: ${issue}.`, { fieldErrors: { ingredients: `${food.name}: ${issue}` } })
        }
        await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId))
        const rows =
          items.length === 0
            ? []
            : await tx
                .insert(recipeIngredients)
                .values(items.map((i, sortOrder) => ({ recipeId, foodId: i.foodId, quantity: i.quantity, sortOrder })))
                .returning()
        await tx.update(foods).set({ updatedAt: now }).where(byIdAndOwner(foods, recipeId, ownerId))
        return rows.map(toRecord)
      })
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
