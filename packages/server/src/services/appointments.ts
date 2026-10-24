/**
 * Randevular. Çakışma kuralı `@diyetgo/shared` içindeki `findAppointmentConflicts` ile uygulanır;
 * kontrol ve yazma, eşzamanlı isteklerin birbirini görmesi için kilitli bir işlem içinde yapılır.
 */
import {
  appointmentInputSchema,
  appointmentStatusSchema,
  findAppointmentConflicts,
  type Appointment,
  type AppointmentInput,
  type AppointmentStatus,
} from '@diyetgo/shared'
import { and, asc, eq, gt, gte, lt, ne } from 'drizzle-orm'
import type { Db } from '../db/client'
import { appointments } from '../db/schema'
import { ApiError, parse } from '../errors'
import { byIdAndOwner, checkId, found, isValidId, lock, now, requireActiveClient, toRecord, type Executor, type Tx } from './common'

export type AppointmentFilter = { from?: string; to?: string; clientId?: string; status?: AppointmentStatus }

async function getRow(db: Executor, ownerId: string, id: string) {
  checkId(id, 'Randevu')
  return found((await db.select().from(appointments).where(byIdAndOwner(appointments, id, ownerId)))[0], 'Randevu')
}

/** Çakışma diyetisyen başınadır: her diyetisyenin takvimi ayrıdır. */
async function checkConflicts(tx: Tx, ownerId: string, candidate: AppointmentInput & { id?: string }) {
  await lock(tx, `appointments:${ownerId}`)
  // Yalnızca zaman aralığı kesişen adaylar okunur; kesin karar ortak kuralla verilir.
  const overlapping = await tx
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.ownerId, ownerId),
        lt(appointments.startsAt, candidate.endsAt),
        gt(appointments.endsAt, candidate.startsAt),
        ne(appointments.status, 'cancelled'),
      ),
    )
  const conflicts = findAppointmentConflicts(candidate, overlapping.map(toRecord))
  if (conflicts.length > 0) {
    throw new ApiError('conflict', 'Bu saat başka bir randevuyla çakışıyor.', { conflictingIds: conflicts.map((a) => a.id) })
  }
}

export function createAppointmentService(db: Db, ownerId: string) {
  return {
    /** `from`/`to`: UTC zaman aralığı, yarı açık `[from, to)`. Başlangıç zamanına göre sıralı. */
    async list({ from, to, clientId, status }: AppointmentFilter = {}): Promise<Appointment[]> {
      if (status !== undefined) parse(appointmentStatusSchema, status)
      // Geçersiz kimlikle hiçbir randevu eşleşmez (demo moduyla aynı).
      if (clientId !== undefined && !isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.ownerId, ownerId),
            from === undefined ? undefined : gte(appointments.startsAt, from),
            to === undefined ? undefined : lt(appointments.startsAt, to),
            clientId === undefined ? undefined : eq(appointments.clientId, clientId),
            status === undefined ? undefined : eq(appointments.status, status),
          ),
        )
        .orderBy(asc(appointments.startsAt))
      return rows.map(toRecord)
    },

    async create(input: unknown): Promise<Appointment> {
      const values = parse(appointmentInputSchema, input)
      return db.transaction(async (tx) => {
        await requireActiveClient(tx, ownerId, values.clientId, 'randevu')
        await checkConflicts(tx, ownerId, values)
        const [row] = await tx
          .insert(appointments)
          .values({ ...values, ownerId })
          .returning()
        return toRecord(row!)
      })
    },

    async update(id: string, input: unknown): Promise<Appointment> {
      const values = parse(appointmentInputSchema, input)
      return db.transaction(async (tx) => {
        const appointment = await getRow(tx, ownerId, id)
        if (values.clientId !== appointment.clientId) await requireActiveClient(tx, ownerId, values.clientId, 'randevu')
        await checkConflicts(tx, ownerId, { ...values, id })
        const [row] = await tx
          .update(appointments)
          .set({ ...values, updatedAt: now })
          .where(byIdAndOwner(appointments, id, ownerId))
          .returning()
        return toRecord(row!)
      })
    },

    /** Varsayılan işlem: randevu silinmez, durumu iptal olur. */
    async cancel(id: string): Promise<Appointment> {
      await getRow(db, ownerId, id)
      const [row] = await db
        .update(appointments)
        .set({ status: 'cancelled', updatedAt: now })
        .where(byIdAndOwner(appointments, id, ownerId))
        .returning()
      return toRecord(row!)
    },

    async remove(id: string): Promise<void> {
      await getRow(db, ownerId, id)
      await db.delete(appointments).where(byIdAndOwner(appointments, id, ownerId))
    },
  }
}
