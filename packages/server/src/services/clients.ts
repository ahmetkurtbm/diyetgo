import { clientInputSchema, type Client } from '@diyetgo/shared'
import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '../db/client'
import { clients } from '../db/schema'
import { ApiError, isRestrictViolation, parse } from '../errors'
import { escapeLike, getClientRow, now, setArchivedValue, toRecord, trCollate } from './common'

export function createClientService(db: Db) {
  return {
    async list({ includeArchived = false, search }: { includeArchived?: boolean; search?: string } = {}): Promise<Client[]> {
      const term = search?.trim()
      const pattern = term ? `%${escapeLike(term)}%` : undefined
      const rows = await db
        .select()
        .from(clients)
        .where(
          and(
            includeArchived ? undefined : isNull(clients.archivedAt),
            pattern ? or(ilike(sql`${clients.firstName} || ' ' || ${clients.lastName}`, pattern), ilike(clients.email, pattern)) : undefined,
          ),
        )
        .orderBy(trCollate(clients.lastName), trCollate(clients.firstName))
      return rows.map(toRecord)
    },

    async get(id: string): Promise<Client> {
      return toRecord(await getClientRow(db, id))
    },

    async create(input: unknown): Promise<Client> {
      const [row] = await db.insert(clients).values(parse(clientInputSchema, input)).returning()
      return toRecord(row!)
    },

    async update(id: string, input: unknown): Promise<Client> {
      const values = parse(clientInputSchema, input)
      await getClientRow(db, id)
      const [row] = await db
        .update(clients)
        .set({ ...values, updatedAt: now })
        .where(eq(clients.id, id))
        .returning()
      return toRecord(row!)
    },

    async setArchived(id: string, archived: boolean): Promise<Client> {
      await getClientRow(db, id)
      const [row] = await db
        .update(clients)
        .set({ archivedAt: setArchivedValue(clients.archivedAt, archived), updatedAt: now })
        .where(eq(clients.id, id))
        .returning()
      return toRecord(row!)
    },

    /** İlişkili kayıtları olan danışan veritabanındaki `RESTRICT` nedeniyle silinemez. */
    async remove(id: string): Promise<void> {
      await getClientRow(db, id)
      try {
        await db.delete(clients).where(eq(clients.id, id))
      } catch (error) {
        if (isRestrictViolation(error)) {
          throw new ApiError('restricted', 'Bu danışanın ölçüm, plan, randevu veya hedef kayıtları var. Silmek yerine arşivleyin.')
        }
        throw error
      }
    },
  }
}
