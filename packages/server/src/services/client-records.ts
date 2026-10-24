/**
 * Danışanın sağlık bilgileri ve diyetisyen önerileri: ilaçlar, hastalıklar, öneriler. Üçü de aynı
 * kurala uyar: danışan altında listelenir, sahibe göre süzülür ve alt kaydı olmadığı için silinebilir.
 */
import {
  clientConditionInputSchema,
  clientMedicationInputSchema,
  clientRecommendationInputSchema,
  type ClientCondition,
  type ClientMedication,
  type ClientRecommendation,
} from '@diyetgo/shared'
import { and, asc, desc, eq } from 'drizzle-orm'
import type { Db } from '../db/client'
import { clientConditions, clientMedications, clientRecommendations } from '../db/schema'
import { parse } from '../errors'
import { byIdAndOwner, checkId, found, getClientRow, isValidId, now, toRecord } from './common'

export function createMedicationService(db: Db, ownerId: string) {
  const table = clientMedications
  async function requireRow(id: string) {
    checkId(id, 'İlaç kaydı')
    found((await db.select({ id: table.id }).from(table).where(byIdAndOwner(table, id, ownerId)))[0], 'İlaç kaydı')
  }
  return {
    /** Devam edenler (bitişi olmayanlar) önce, ardından en yeni başlangıç. */
    async listByClient(clientId: string): Promise<ClientMedication[]> {
      if (!isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(table)
        .where(and(eq(table.ownerId, ownerId), eq(table.clientId, clientId)))
        .orderBy(desc(table.endedOn), desc(table.startedOn), asc(table.createdAt))
      return rows.map(toRecord)
    },
    async create(input: unknown): Promise<ClientMedication> {
      const values = parse(clientMedicationInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      const [row] = await db
        .insert(table)
        .values({ ...values, ownerId })
        .returning()
      return toRecord(row!)
    },
    async update(id: string, input: unknown): Promise<ClientMedication> {
      const values = parse(clientMedicationInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      await requireRow(id)
      const [row] = await db
        .update(table)
        .set({ ...values, updatedAt: now })
        .where(byIdAndOwner(table, id, ownerId))
        .returning()
      return toRecord(row!)
    },
    async remove(id: string): Promise<void> {
      await requireRow(id)
      await db.delete(table).where(byIdAndOwner(table, id, ownerId))
    },
  }
}

export function createConditionService(db: Db, ownerId: string) {
  const table = clientConditions
  async function requireRow(id: string) {
    checkId(id, 'Hastalık kaydı')
    found((await db.select({ id: table.id }).from(table).where(byIdAndOwner(table, id, ownerId)))[0], 'Hastalık kaydı')
  }
  return {
    async listByClient(clientId: string): Promise<ClientCondition[]> {
      if (!isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(table)
        .where(and(eq(table.ownerId, ownerId), eq(table.clientId, clientId)))
        .orderBy(asc(table.createdAt))
      return rows.map(toRecord)
    },
    async create(input: unknown): Promise<ClientCondition> {
      const values = parse(clientConditionInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      const [row] = await db
        .insert(table)
        .values({ ...values, ownerId })
        .returning()
      return toRecord(row!)
    },
    async update(id: string, input: unknown): Promise<ClientCondition> {
      const values = parse(clientConditionInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      await requireRow(id)
      const [row] = await db
        .update(table)
        .set({ ...values, updatedAt: now })
        .where(byIdAndOwner(table, id, ownerId))
        .returning()
      return toRecord(row!)
    },
    async remove(id: string): Promise<void> {
      await requireRow(id)
      await db.delete(table).where(byIdAndOwner(table, id, ownerId))
    },
  }
}

export function createRecommendationService(db: Db, ownerId: string) {
  const table = clientRecommendations
  async function requireRow(id: string) {
    checkId(id, 'Öneri')
    found((await db.select({ id: table.id }).from(table).where(byIdAndOwner(table, id, ownerId)))[0], 'Öneri')
  }
  return {
    /** En yeni öneri önce. */
    async listByClient(clientId: string): Promise<ClientRecommendation[]> {
      if (!isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(table)
        .where(and(eq(table.ownerId, ownerId), eq(table.clientId, clientId)))
        .orderBy(desc(table.givenOn), desc(table.createdAt))
      return rows.map(toRecord)
    },
    async create(input: unknown): Promise<ClientRecommendation> {
      const values = parse(clientRecommendationInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      const [row] = await db
        .insert(table)
        .values({ ...values, ownerId })
        .returning()
      return toRecord(row!)
    },
    async update(id: string, input: unknown): Promise<ClientRecommendation> {
      const values = parse(clientRecommendationInputSchema, input)
      await getClientRow(db, ownerId, values.clientId)
      await requireRow(id)
      const [row] = await db
        .update(table)
        .set({ ...values, updatedAt: now })
        .where(byIdAndOwner(table, id, ownerId))
        .returning()
      return toRecord(row!)
    },
    async remove(id: string): Promise<void> {
      await requireRow(id)
      await db.delete(table).where(byIdAndOwner(table, id, ownerId))
    },
  }
}
