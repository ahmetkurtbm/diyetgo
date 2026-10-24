import { isMealTypeNameTaken, mealTypeInputSchema, type MealType } from '@diyetgo/shared'
import { asc, eq, isNull } from 'drizzle-orm'
import type { Db } from '../db/client'
import { mealTypes } from '../db/schema'
import { ApiError, isRestrictViolation, parse } from '../errors'
import { checkId, found, lock, now, setArchivedValue, toRecord, trCollate, type Tx } from './common'

export function createMealTypeService(db: Db) {
  async function getRow(id: string) {
    checkId(id, 'Öğün türü')
    return found((await db.select().from(mealTypes).where(eq(mealTypes.id, id)))[0], 'Öğün türü')
  }

  /** Ad kontrolü ve yazma kilitli işlemde yapılır; eşzamanlı isteklerle aynı ad iki kez eklenemez. */
  async function checkUniqueName(tx: Tx, name: string, selfId: string | null) {
    await lock(tx, 'meal_types')
    const rows = await tx.select({ id: mealTypes.id, name: mealTypes.name }).from(mealTypes)
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
        .where(includeArchived ? undefined : isNull(mealTypes.archivedAt))
        .orderBy(asc(mealTypes.sortOrder), trCollate(mealTypes.name))
      return rows.map(toRecord)
    },

    async create(input: unknown): Promise<MealType> {
      const values = parse(mealTypeInputSchema, input)
      return db.transaction(async (tx) => {
        await checkUniqueName(tx, values.name, null)
        const [row] = await tx.insert(mealTypes).values(values).returning()
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
          .where(eq(mealTypes.id, id))
          .returning()
        return toRecord(row!)
      })
    },

    async setArchived(id: string, archived: boolean): Promise<MealType> {
      await getRow(id)
      const [row] = await db
        .update(mealTypes)
        .set({ archivedAt: setArchivedValue(mealTypes.archivedAt, archived), updatedAt: now })
        .where(eq(mealTypes.id, id))
        .returning()
      return toRecord(row!)
    },

    /** Bir planda kullanılan öğün türü veritabanındaki `RESTRICT` nedeniyle silinemez. */
    async remove(id: string): Promise<void> {
      await getRow(id)
      try {
        await db.delete(mealTypes).where(eq(mealTypes.id, id))
      } catch (error) {
        if (isRestrictViolation(error)) {
          throw new ApiError('restricted', 'Bu öğün türü bir planda kullanılıyor. Silmek yerine arşivleyin.')
        }
        throw error
      }
    },
  }
}
