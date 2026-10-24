import { clientInputSchema, type Client } from '@diyetgo/shared'
import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { clients } from '../db/schema'
import { ApiError, isRestrictViolation, parse } from '../errors'
import { byIdAndOwner, escapeLike, getClientRow, now, setArchivedValue, toRecord, trCollate } from './common'

export function createClientService(db: Db, ownerId: string) {
  return {
    async list({ includeArchived = false, search }: { includeArchived?: boolean; search?: string } = {}): Promise<Client[]> {
      const term = search?.trim()
      const pattern = term ? `%${escapeLike(term)}%` : undefined
      const rows = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.ownerId, ownerId),
            includeArchived ? undefined : isNull(clients.archivedAt),
            pattern ? or(ilike(sql`${clients.firstName} || ' ' || ${clients.lastName}`, pattern), ilike(clients.email, pattern)) : undefined,
          ),
        )
        .orderBy(trCollate(clients.lastName), trCollate(clients.firstName))
      return rows.map(toRecord)
    },

    async get(id: string): Promise<Client> {
      return toRecord(await getClientRow(db, ownerId, id))
    },

    async create(input: unknown): Promise<Client> {
      const [row] = await db
        .insert(clients)
        .values({ ...parse(clientInputSchema, input), ownerId })
        .returning()
      return toRecord(row!)
    },

    async update(id: string, input: unknown): Promise<Client> {
      const values = parse(clientInputSchema, input)
      await getClientRow(db, ownerId, id)
      const [row] = await db
        .update(clients)
        .set({ ...values, updatedAt: now })
        .where(byIdAndOwner(clients, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    async setArchived(id: string, archived: boolean): Promise<Client> {
      await getClientRow(db, ownerId, id)
      const [row] = await db
        .update(clients)
        .set({ archivedAt: setArchivedValue(clients.archivedAt, archived), updatedAt: now })
        .where(byIdAndOwner(clients, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    /** İlişkili kayıtları olan danışan veritabanındaki `RESTRICT` nedeniyle silinemez. */
    async remove(id: string): Promise<void> {
      await getClientRow(db, ownerId, id)
      try {
        await db.delete(clients).where(byIdAndOwner(clients, id, ownerId))
      } catch (error) {
        if (isRestrictViolation(error)) {
          throw new ApiError('restricted', 'Bu danışanın ölçüm, plan, randevu, hedef, ilaç, hastalık veya öneri kayıtları var. Silmek yerine arşivleyin.')
        }
        throw error
      }
    },
  }
}
