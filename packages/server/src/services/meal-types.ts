import { isMealTypeNameTaken, mealTypeInputSchema, type MealType } from '@diyetgo/shared'
import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { mealTypes } from '../db/schema'
import { ApiError, isRestrictViolation, parse } from '../errors'
import { byIdAndOwner, checkId, found, lock, now, setArchivedValue, toRecord, trCollate, type Executor, type Tx } from './common'

/** Yeni diyetisyen hesabı bu öğün türleriyle başlar. */
export const DEFAULT_MEAL_TYPES = [
  { name: 'Kahvaltı', sortOrder: 10 },
  { name: 'Ara öğün (sabah)', sortOrder: 20 },
  { name: 'Öğle', sortOrder: 30 },
  { name: 'Ara öğün (ikindi)', sortOrder: 40 },
  { name: 'Akşam', sortOrder: 50 },
] as const

export async function insertDefaultMealTypes(db: Executor, ownerId: string) {
  await db.insert(mealTypes).values(DEFAULT_MEAL_TYPES.map((t) => ({ ...t, ownerId })))
}

export function createMealTypeService(db: Db, ownerId: string) {
  async function getRow(id: string) {
    checkId(id, 'Öğün türü')
    return found((await db.select().from(mealTypes).where(byIdAndOwner(mealTypes, id, ownerId)))[0], 'Öğün türü')
  }

  /** Ad kontrolü ve yazma kilitli işlemde yapılır; eşzamanlı isteklerle aynı ad iki kez eklenemez. */
  async function checkUniqueName(tx: Tx, name: string, selfId: string | null) {
    await lock(tx, `meal_types:${ownerId}`)
    const rows = await tx.select({ id: mealTypes.id, name: mealTypes.name }).from(mealTypes).where(eq(mealTypes.ownerId, ownerId))
    if (isMealTypeNameTaken(rows, name, selfId)) {
      throw new ApiError('validation', 'Bu adla bir öğün türü zaten var.', { fieldErrors: { name: 'Bu adla bir öğün türü zaten var' } })
    }
  }

  return {
    /** `sortOrder`'a göre sıralı. */
    async list({ includeArchived = false }: { includeArchived?: boolean } = {}): Promise<MealType[]> {
      const rows = await db
        .select()
        .from(mealTypes)
        .where(and(eq(mealTypes.ownerId, ownerId), includeArchived ? undefined : isNull(mealTypes.archivedAt)))
        .orderBy(asc(mealTypes.sortOrder), trCollate(mealTypes.name))
      return rows.map(toRecord)
    },

    async create(input: unknown): Promise<MealType> {
      const values = parse(mealTypeInputSchema, input)
      return db.transaction(async (tx) => {
        await checkUniqueName(tx, values.name, null)
        const [row] = await tx
          .insert(mealTypes)
          .values({ ...values, ownerId })
          .returning()
        return toRecord(row!)
      })
    },

    async update(id: string, input: unknown): Promise<MealType> {
      const values = parse(mealTypeInputSchema, input)
      await getRow(id)
      return db.transaction(async (tx) => {
        await checkUniqueName(tx, values.name, id)
        const [row] = await tx
          .update(mealTypes)
          .set({ ...values, updatedAt: now })
          .where(byIdAndOwner(mealTypes, id, ownerId))
          .returning()
        return toRecord(row!)
      })
    },

    async setArchived(id: string, archived: boolean): Promise<MealType> {
      await getRow(id)
      const [row] = await db
        .update(mealTypes)
        .set({ archivedAt: setArchivedValue(mealTypes.archivedAt, archived), updatedAt: now })
        .where(byIdAndOwner(mealTypes, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    /** Bir planda kullanılan öğün türü veritabanındaki `RESTRICT` nedeniyle silinemez. */
    async remove(id: string): Promise<void> {
      await getRow(id)
      try {
        await db.delete(mealTypes).where(byIdAndOwner(mealTypes, id, ownerId))
      } catch (error) {
        if (isRestrictViolation(error)) {
          throw new ApiError('restricted', 'Bu öğün türü bir planda kullanılıyor. Silmek yerine arşivleyin.')
        }
        throw error
      }
    },
  }
}
