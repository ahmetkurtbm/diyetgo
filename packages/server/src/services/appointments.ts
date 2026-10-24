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
import { checkId, found, isValidId, lock, now, requireActiveClient, toRecord, type Executor, type Tx } from './common'

export type AppointmentFilter = { from?: string; to?: string; clientId?: string; status?: AppointmentStatus }

async function getRow(db: Executor, id: string) {
  checkId(id, 'Randevu')
  return found((await db.select().from(appointments).where(eq(appointments.id, id)))[0], 'Randevu')
}

async function checkConflicts(tx: Tx, candidate: AppointmentInput & { id?: string }) {
  await lock(tx, 'appointments')
  // Yalnızca zaman aralığı kesişen adaylar okunur; kesin karar ortak kuralla verilir.
  const overlapping = await tx
    .select()
    .from(appointments)
    .where(and(lt(appointments.startsAt, candidate.endsAt), gt(appointments.endsAt, candidate.startsAt), ne(appointments.status, 'cancelled')))
  const conflicts = findAppointmentConflicts(candidate, overlapping.map(toRecord))
  if (conflicts.length > 0) {
    throw new ApiError('conflict', 'Bu saat başka bir randevuyla çakışıyor.', { conflictingIds: conflicts.map((a) => a.id) })
  }
}

export function createAppointmentService(db: Db) {
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
        await requireActiveClient(tx, values.clientId, 'randevu')
        await checkConflicts(tx, values)
        const [row] = await tx.insert(appointments).values(values).returning()
        return toRecord(row!)
      })
    },

    async update(id: string, input: unknown): Promise<Appointment> {
      const values = parse(appointmentInputSchema, input)
      return db.transaction(async (tx) => {
        const appointment = await getRow(tx, id)
        if (values.clientId !== appointment.clientId) await requireActiveClient(tx, values.clientId, 'randevu')
        await checkConflicts(tx, { ...values, id })
        const [row] = await tx
          .update(appointments)
          .set({ ...values, updatedAt: now })
          .where(eq(appointments.id, id))
          .returning()
        return toRecord(row!)
      })
    },

    /** Varsayılan işlem: randevu silinmez, durumu iptal olur. */
    async cancel(id: string): Promise<Appointment> {
      await getRow(db, id)
      const [row] = await db
        .update(appointments)
        .set({ status: 'cancelled', updatedAt: now })
        .where(eq(appointments.id, id))
        .returning()
      return toRecord(row!)
    },

    async remove(id: string): Promise<void> {
      await getRow(db, id)
      await db.delete(appointments).where(eq(appointments.id, id))
    },
  }
}
