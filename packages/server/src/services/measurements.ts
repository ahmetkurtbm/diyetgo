import { measurementInputSchema, type Measurement } from '@diyetgo/shared'
import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { measurements } from '../db/schema'
import { parse } from '../errors'
import { byIdAndOwner, checkId, found, getClientRow, isValidId, now, toRecord } from './common'

export function createMeasurementService(db: Db, ownerId: string) {
  async function getRow(id: string) {
    checkId(id, 'Ölçüm')
    return found((await db.select().from(measurements).where(byIdAndOwner(measurements, id, ownerId)))[0], 'Ölçüm')
  }

  return {
    /** En yeni ölçüm önce. */
    async listByClient(clientId: string): Promise<Measurement[]> {
      // Olmayan, geçersiz veya başka diyetisyene ait danışan için boş liste (demo moduyla aynı).
      if (!isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(measurements)
        .where(and(eq(measurements.ownerId, ownerId), eq(measurements.clientId, clientId)))
        .orderBy(desc(measurements.measuredOn), desc(measurements.createdAt))
      return rows.map(toRecord)
    },

    async create(input: unknown): Promise<Measurement> {
      const values = parse(measurementInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      const [row] = await db
        .insert(measurements)
        .values({ ...values, ownerId })
        .returning()
      return toRecord(row!)
    },

    async update(id: string, input: unknown): Promise<Measurement> {
      const values = parse(measurementInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      await getRow(id)
      const [row] = await db
        .update(measurements)
        .set({ ...values, updatedAt: now })
        .where(byIdAndOwner(measurements, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    async remove(id: string): Promise<void> {
      await getRow(id)
      await db.delete(measurements).where(byIdAndOwner(measurements, id, ownerId))
    },
  }
}
