import { clientInputSchema, idSchema, type Client } from '@diyetgo/shared'
import { and, eq, ilike, isNull, or, sql, type SQLWrapper } from 'drizzle-orm'
import type { Db } from '../db/client'
import { clients } from '../db/schema'
import { ApiError, isRestrictViolation, parse } from '../errors'

/** Sürücüden gelen `timestamptz` metnini (`2026-10-24 07:00:00+00`) UTC ISO 8601'e çevirir. */
const iso = (value: string) => new Date(value).toISOString()

function toClient(row: typeof clients.$inferSelect): Client {
  return {
    ...row,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    archivedAt: row.archivedAt === null ? null : iso(row.archivedAt),
  }
}

const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)
const trCollate = (column: SQLWrapper) => sql`${column} collate "tr-x-icu"`

export function createClientService(db: Db) {
  async function get(id: string): Promise<Client> {
    const row = idSchema.safeParse(id).success ? (await db.select().from(clients).where(eq(clients.id, id)))[0] : undefined
    if (!row) throw new ApiError('not_found', 'Danışan bulunamadı.')
    return toClient(row)
  }

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
      return rows.map(toClient)
    },

    get,

    async create(input: unknown): Promise<Client> {
      const [row] = await db.insert(clients).values(parse(clientInputSchema, input)).returning()
      return toClient(row!)
    },

    async update(id: string, input: unknown): Promise<Client> {
      const values = parse(clientInputSchema, input)
      await get(id)
      const [row] = await db
        .update(clients)
        .set({ ...values, updatedAt: sql`now()` })
        .where(eq(clients.id, id))
        .returning()
      return toClient(row!)
    },

    async setArchived(id: string, archived: boolean): Promise<Client> {
      await get(id)
      const [row] = await db
        .update(clients)
        .set({ archivedAt: archived ? sql`coalesce(${clients.archivedAt}, now())` : null, updatedAt: sql`now()` })
        .where(eq(clients.id, id))
        .returning()
      return toClient(row!)
    },

    /** İlişkili kayıtları olan danışan veritabanındaki `RESTRICT` nedeniyle silinemez. */
    async remove(id: string): Promise<void> {
      await get(id)
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
