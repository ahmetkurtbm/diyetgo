/**
 * Danışan hedefleri. Dönem kuralları `@diyetgo/shared` içindeki `planNewGoal` ve `goalPeriodsOverlap`
 * ile uygulanır; önceki açık hedefin kapatılması yeni hedefle aynı işlemde yapılır.
 */
import { clientGoalInputSchema, goalPeriodsOverlap, planNewGoal, type ClientGoal } from '@diyetgo/shared'
import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { clientGoals } from '../db/schema'
import { ApiError, parse } from '../errors'
import { byIdAndOwner, checkId, found, getClientRow, isValidId, lock, now, toRecord, type Tx } from './common'

async function lockedClientGoals(tx: Tx, ownerId: string, clientId: string) {
  await lock(tx, `client_goals:${clientId}`)
  return (await tx.select().from(clientGoals).where(and(eq(clientGoals.ownerId, ownerId), eq(clientGoals.clientId, clientId)))).map(toRecord)
}

export function createGoalService(db: Db, ownerId: string) {
  async function requireGoal(executor: Db | Tx, id: string) {
    checkId(id, 'Hedef')
    found((await executor.select({ id: clientGoals.id }).from(clientGoals).where(byIdAndOwner(clientGoals, id, ownerId)))[0], 'Hedef')
  }

  return {
    /** En yeni dönem önce. */
    async listByClient(clientId: string): Promise<ClientGoal[]> {
      // Olmayan veya geçersiz danışan için boş liste (demo moduyla aynı).
      if (!isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(clientGoals)
        .where(and(eq(clientGoals.ownerId, ownerId), eq(clientGoals.clientId, clientId)))
        .orderBy(desc(clientGoals.validFrom))
      return rows.map(toRecord)
    },

    async create(input: unknown): Promise<{ goal: ClientGoal; closed: ClientGoal | null }> {
      const values = parse(clientGoalInputSchema, input)
      return db.transaction(async (tx) => {
        await getClientRow(tx, ownerId, values.clientId)
        const placement = planNewGoal(await lockedClientGoals(tx, ownerId, values.clientId), values)
        if (!placement.ok) {
          throw new ApiError('conflict', 'Bu dönem başka bir hedefle çakışıyor.', { conflictingIds: placement.conflictingIds })
        }
        let closed: ClientGoal | null = null
        if (placement.close) {
          const [row] = await tx
            .update(clientGoals)
            .set({ validTo: placement.close.validTo, updatedAt: now })
            .where(byIdAndOwner(clientGoals, placement.close.id, ownerId))
            .returning()
          closed = toRecord(row!)
        }
        const [goal] = await tx
          .insert(clientGoals)
          .values({ ...values, ownerId })
          .returning()
        return { goal: toRecord(goal!), closed }
      })
    },

    async update(id: string, input: unknown): Promise<ClientGoal> {
      const values = parse(clientGoalInputSchema, input)
      return db.transaction(async (tx) => {
        await requireGoal(tx, id)
        await getClientRow(tx, ownerId, values.clientId)
        const conflicts = (await lockedClientGoals(tx, ownerId, values.clientId)).filter((g) => g.id !== id && goalPeriodsOverlap(g, values))
        if (conflicts.length > 0) {
          throw new ApiError('conflict', 'Bu dönem başka bir hedefle çakışıyor.', { conflictingIds: conflicts.map((g) => g.id) })
        }
        const [row] = await tx
          .update(clientGoals)
          .set({ ...values, updatedAt: now })
          .where(byIdAndOwner(clientGoals, id, ownerId))
          .returning()
        return toRecord(row!)
      })
    },

    async remove(id: string): Promise<void> {
      await requireGoal(db, id)
      await db.delete(clientGoals).where(byIdAndOwner(clientGoals, id, ownerId))
    },
  }
}
