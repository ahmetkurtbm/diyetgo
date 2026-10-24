/** Servislerin ortak yardımcıları: satır dönüşümü, kimlik ve tarih doğrulaması, ortak kontroller. */
import { canAddPlanOrAppointment, idSchema, instantSchema } from '@diyetgo/shared'
import { eq, sql, type SQLWrapper } from 'drizzle-orm'
import type { Db } from '../db/client'
import { clients } from '../db/schema'
import { ApiError } from '../errors'

export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type Executor = Db | Tx

/** Sürücüden gelen `timestamptz` metnini (`2026-10-24 07:00:00+00`) UTC ISO 8601'e çevirir. */
const iso = (value: string) => new Date(value).toISOString()

/**
 * Veritabanı satırını API kaydına çevirir: zaman damgaları ISO 8601 (`Z`), öğün saati `HH:MM` olur.
 * Diğer alanlar Drizzle şemasında zaten `@diyetgo/shared` tipleriyle aynıdır.
 */
export function toRecord<R extends object>(row: R): R {
  const out: Record<string, unknown> = { ...(row as Record<string, unknown>) }
  for (const key of ['createdAt', 'updatedAt', 'archivedAt', 'startsAt', 'endsAt']) {
    if (typeof out[key] === 'string') out[key] = iso(out[key])
  }
  if (typeof out.time === 'string') out.time = out.time.slice(0, 5)
  return out as R
}

export function found<T>(row: T | undefined, label: string): T {
  if (row === undefined) throw new ApiError('not_found', `${label} bulunamadı.`)
  return row
}

export const isValidId = (id: string) => idSchema.safeParse(id).success

/** Geçersiz biçimdeki kimlik veritabanına gönderilmez; kayıt yok gibi ele alınır. */
export function checkId(id: string, label: string): string {
  if (!isValidId(id)) throw new ApiError('not_found', `${label} bulunamadı.`)
  return id
}

/** Sorgu parametresindeki isteğe bağlı UTC zamanı doğrular. */
export function optionalInstant(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !instantSchema.safeParse(value).success) {
    throw new ApiError('validation', 'Geçersiz zaman aralığı.', { fieldErrors: { [field]: 'Geçersiz zaman' } })
  }
  return value
}

export const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Türkçe alfabetik sıralama (PostgreSQL ICU harmanlaması). */
export const trCollate = (column: SQLWrapper) => sql`${column} collate "tr-x-icu"`

export const now = sql`now()`

/** Aynı kaynağa yönelik eşzamanlı kontrol-ve-yaz işlemlerini işlem sonuna kadar sıraya sokar. */
export async function lock(tx: Tx, key: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`)
}

export async function getClientRow(db: Executor, clientId: string) {
  checkId(clientId, 'Danışan')
  return found((await db.select().from(clients).where(eq(clients.id, clientId)))[0], 'Danışan')
}

/** Arşivlenmiş danışana yeni plan veya randevu eklenemez. */
export async function requireActiveClient(db: Executor, clientId: string, action: string) {
  const client = await getClientRow(db, clientId)
  if (!canAddPlanOrAppointment(client)) {
    throw new ApiError('restricted', `Arşivlenmiş danışana yeni ${action} eklenemez.`)
  }
  return client
}

export function setArchivedValue(column: SQLWrapper, archived: boolean) {
  return archived ? sql`coalesce(${column}, now())` : null
}
