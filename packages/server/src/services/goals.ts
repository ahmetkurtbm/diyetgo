/**
 * Danışan hedefleri. Dönem kuralları `@diyetgo/shared` içindeki `planNewGoal` ve `goalPeriodsOverlap`
 * ile uygulanır; önceki açık hedefin kapatılması yeni hedefle aynı işlemde yapılır.
 */
import { clientGoalInputSchema, goalPeriodsOverlap, planNewGoal, type ClientGoal } from '@diyetgo/shared'
import { desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { clientGoals } from '../db/schema'
import { ApiError, parse } from '../errors'
import { checkId, found, getClientRow, isValidId, lock, now, toRecord, type Tx } from './common'

async function lockedClientGoals(tx: Tx, clientId: string) {
  await lock(tx, `client_goals:${clientId}`)
  return (await tx.select().from(clientGoals).where(eq(clientGoals.clientId, clientId))).map(toRecord)
}

export function createGoalService(db: Db) {
  return {
    /** En yeni dönem önce. */
    async listByClient(clientId: string): Promise<ClientGoal[]> {
      // Olmayan veya geçersiz danışan için boş liste (demo moduyla aynı).
      if (!isValidId(clientId)) return []
      const rows = await db.select().from(clientGoals).where(eq(clientGoals.clientId, clientId)).orderBy(desc(clientGoals.validFrom))
      return rows.map(toRecord)
    },

    async create(input: unknown): Promise<{ goal: ClientGoal; closed: ClientGoal | null }> {
      const values = parse(clientGoalInputSchema, input)
      return db.transaction(async (tx) => {
        await getClientRow(tx, values.clientId)
        const placement = planNewGoal(await lockedClientGoals(tx, values.clientId), values)
        if (!placement.ok) {
          throw new ApiError('conflict', 'Bu dönem başka bir hedefle çakışıyor.', { conflictingIds: placement.conflictingIds })
        }
        let closed: ClientGoal | null = null
        if (placement.close) {
          const [row] = await tx
            .update(clientGoals)
            .set({ validTo: placement.close.validTo, updatedAt: now })
            .where(eq(clientGoals.id, placement.close.id))
            .returning()
          closed = toRecord(row!)
        }
        const [goal] = await tx.insert(clientGoals).values(values).returning()
        return { goal: toRecord(goal!), closed }
      })
    },

    async update(id: string, input: unknown): Promise<ClientGoal> {
      const values = parse(clientGoalInputSchema, input)
      return db.transaction(async (tx) => {
        checkId(id, 'Hedef')
        found((await tx.select({ id: clientGoals.id }).from(clientGoals).where(eq(clientGoals.id, id)))[0], 'Hedef')
        await getClientRow(tx, values.clientId)
        const conflicts = (await lockedClientGoals(tx, values.clientId)).filter((g) => g.id !== id && goalPeriodsOverlap(g, values))
        if (conflicts.length > 0) {
          throw new ApiError('conflict', 'Bu dönem başka bir hedefle çakışıyor.', { conflictingIds: conflicts.map((g) => g.id) })
        }
        const [row] = await tx
          .update(clientGoals)
          .set({ ...values, updatedAt: now })
          .where(eq(clientGoals.id, id))
          .returning()
        return toRecord(row!)
      })
    },

    async remove(id: string): Promise<void> {
      checkId(id, 'Hedef')
      found((await db.select({ id: clientGoals.id }).from(clientGoals).where(eq(clientGoals.id, id)))[0], 'Hedef')
      await db.delete(clientGoals).where(eq(clientGoals.id, id))
    },
  }
}
