/**
 * Beslenme planı, plan öğünü ve öğün içeriği. Plan → öğün → içerik zinciri veritabanında `CASCADE`
 * ile silinir; öğün veya içerik değiştiğinde planın `updatedAt` alanı güncellenir.
 */
import {
  addDays,
  canAddFoodToMeal,
  canUseMealType,
  isDayWithinPlan,
  mealPlanInputSchema,
  mealsOutsidePlan,
  planLengthDays,
  planMealInputSchema,
  planMealItemInputSchema,
  type MealPlan,
  type PlanMeal,
  type PlanMealInput,
  type PlanMealItem,
} from '@diyetgo/shared'
import { and, asc, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import type { Db } from '../db/client'
import { foods, mealPlans, mealTypes, planMealItems, planMeals } from '../db/schema'
import { ApiError, parse } from '../errors'
import { checkId, found, isValidId, now, requireActiveClient, setArchivedValue, toRecord, trCollate, type Executor } from './common'

export type MealPlanDetail = { plan: MealPlan; meals: PlanMeal[]; items: PlanMealItem[] }

const copyTargetSchema = z.object({ clientId: z.string(), startDate: z.string(), title: z.string() })

async function getPlanRow(db: Executor, id: string) {
  checkId(id, 'Plan')
  return found((await db.select().from(mealPlans).where(eq(mealPlans.id, id)))[0], 'Plan')
}

async function getMealRow(db: Executor, id: string) {
  checkId(id, 'Öğün')
  return found((await db.select().from(planMeals).where(eq(planMeals.id, id)))[0], 'Öğün')
}

async function getItemRow(db: Executor, id: string) {
  checkId(id, 'Öğün içeriği')
  return found((await db.select().from(planMealItems).where(eq(planMealItems.id, id)))[0], 'Öğün içeriği')
}

async function touchPlan(db: Executor, planId: string) {
  await db.update(mealPlans).set({ updatedAt: now }).where(eq(mealPlans.id, planId))
}

/** Gün plan süresinde olmalı, öğün türü arşivlenmemiş olmalı (mevcut seçim korunabilir), aynı gün aynı öğün bir kez bulunur. */
async function checkMeal(db: Executor, input: PlanMealInput, selfId: string | null, previousMealTypeId?: string) {
  const plan = await getPlanRow(db, input.mealPlanId)
  if (!isDayWithinPlan(plan, input.dayNumber)) {
    throw new ApiError('validation', 'Gün plan süresinin dışında.', { fieldErrors: { dayNumber: 'Gün plan süresinin dışında' } })
  }
  checkId(input.mealTypeId, 'Öğün türü')
  const mealType = found((await db.select().from(mealTypes).where(eq(mealTypes.id, input.mealTypeId)))[0], 'Öğün türü')
  if (!canUseMealType(mealType, previousMealTypeId)) {
    throw new ApiError('validation', 'Arşivlenmiş öğün türü seçilemez.', { fieldErrors: { mealTypeId: 'Arşivlenmiş öğün türü seçilemez' } })
  }
  const [duplicate] = await db
    .select({ id: planMeals.id })
    .from(planMeals)
    .where(
      and(
        eq(planMeals.mealPlanId, input.mealPlanId),
        eq(planMeals.dayNumber, input.dayNumber),
        eq(planMeals.mealTypeId, input.mealTypeId),
        selfId === null ? undefined : ne(planMeals.id, selfId),
      ),
    )
  if (duplicate) {
    throw new ApiError('conflict', `${input.dayNumber}. gün için "${mealType.name}" öğünü zaten var.`, { conflictingIds: [duplicate.id] })
  }
}

/** Arşivlenmiş besin yeni öğüne eklenemez; mevcut içerikte kalan besin korunabilir. */
async function checkItemFood(db: Executor, foodId: string, previousFoodId?: string) {
  checkId(foodId, 'Besin')
  const food = found((await db.select().from(foods).where(eq(foods.id, foodId)))[0], 'Besin')
  if (!canAddFoodToMeal(food) && previousFoodId !== foodId) {
    throw new ApiError('validation', 'Arşivlenmiş besin yeni öğüne eklenemez.', { fieldErrors: { foodId: 'Arşivlenmiş besin yeni öğüne eklenemez' } })
  }
}

export function createMealPlanService(db: Db) {
  return {
    /** En yeni başlangıç tarihi önce. */
    async list({ includeArchived = false, clientId }: { includeArchived?: boolean; clientId?: string } = {}): Promise<MealPlan[]> {
      // Geçersiz kimlikle hiçbir plan eşleşmez (demo moduyla aynı).
      if (clientId !== undefined && !isValidId(clientId)) return []
      const rows = await db
        .select()
        .from(mealPlans)
        .where(and(includeArchived ? undefined : isNull(mealPlans.archivedAt), clientId === undefined ? undefined : eq(mealPlans.clientId, clientId)))
        .orderBy(desc(mealPlans.startDate), trCollate(mealPlans.title))
      return rows.map(toRecord)
    },

    async get(id: string): Promise<MealPlanDetail> {
      const plan = await getPlanRow(db, id)
      const meals = await db
        .select({ meal: planMeals })
        .from(planMeals)
        .innerJoin(mealTypes, eq(mealTypes.id, planMeals.mealTypeId))
        .where(eq(planMeals.mealPlanId, id))
        .orderBy(asc(planMeals.dayNumber), asc(mealTypes.sortOrder))
      const mealIds = meals.map((m) => m.meal.id)
      const items =
        mealIds.length === 0
          ? []
          : await db.select().from(planMealItems).where(inArray(planMealItems.planMealId, mealIds)).orderBy(asc(planMealItems.sortOrder))
      return { plan: toRecord(plan), meals: meals.map((m) => toRecord(m.meal)), items: items.map(toRecord) }
    },

    async create(input: unknown): Promise<MealPlan> {
      const values = parse(mealPlanInputSchema, input)
      await requireActiveClient(db, values.clientId, 'plan')
      const [row] = await db.insert(mealPlans).values(values).returning()
      return toRecord(row!)
    },

    async update(id: string, input: unknown): Promise<MealPlan> {
      const values = parse(mealPlanInputSchema, input)
      return db.transaction(async (tx) => {
        const plan = await getPlanRow(tx, id)
        if (values.clientId !== plan.clientId) await requireActiveClient(tx, values.clientId, 'plan')
        const meals = await tx.select().from(planMeals).where(eq(planMeals.mealPlanId, id))
        const outside = mealsOutsidePlan(values, meals)
        if (outside.length > 0) {
          const days = [...new Set(outside.map((m) => m.dayNumber))].sort((a, b) => a - b).join(', ')
          throw new ApiError('conflict', `Yeni plan süresi mevcut öğünleri dışarıda bırakıyor (gün: ${days}).`, {
            conflictingIds: outside.map((m) => m.id),
          })
        }
        const [row] = await tx
          .update(mealPlans)
          .set({ ...values, updatedAt: now })
          .where(eq(mealPlans.id, id))
          .returning()
        return toRecord(row!)
      })
    },

    async setArchived(id: string, archived: boolean): Promise<MealPlan> {
      await getPlanRow(db, id)
      const [row] = await db
        .update(mealPlans)
        .set({ archivedAt: setArchivedValue(mealPlans.archivedAt, archived), updatedAt: now })
        .where(eq(mealPlans.id, id))
        .returning()
      return toRecord(row!)
    },

    /** Plan, öğünleri ve öğün içerikleriyle birlikte silinir (`CASCADE`). */
    async remove(id: string): Promise<void> {
      await getPlanRow(db, id)
      await db.delete(mealPlans).where(eq(mealPlans.id, id))
    },

    /** Planı öğünleri ve içerikleriyle kopyalar; plan süresi korunur. */
    async copy(id: string, target: unknown): Promise<MealPlan> {
      const { clientId, startDate, title } = parse(copyTargetSchema, target)
      return db.transaction(async (tx) => {
        const source = await getPlanRow(tx, id)
        await requireActiveClient(tx, clientId, 'plan')
        const length = planLengthDays(source)
        const values = parse(mealPlanInputSchema, {
          clientId,
          title,
          startDate,
          endDate: length === null ? null : addDays(startDate, length - 1),
          notes: source.notes,
        })
        const [plan] = await tx.insert(mealPlans).values(values).returning()
        const meals = await tx.select().from(planMeals).where(eq(planMeals.mealPlanId, id))
        if (meals.length > 0) {
          const copies = await tx
            .insert(planMeals)
            .values(meals.map((m) => ({ mealPlanId: plan!.id, dayNumber: m.dayNumber, mealTypeId: m.mealTypeId, time: m.time, notes: m.notes })))
            .returning({ id: planMeals.id })
          // `returning` satırları ekleme sırasıyla döner; kaynak öğün kimliği yeni kimliğe eşlenir.
          const newMealId = new Map(meals.map((m, i) => [m.id, copies[i]!.id]))
          const items = await tx.select().from(planMealItems).where(inArray(planMealItems.planMealId, [...newMealId.keys()]))
          if (items.length > 0) {
            await tx.insert(planMealItems).values(
              items.map((i) => ({ planMealId: newMealId.get(i.planMealId)!, foodId: i.foodId, quantity: i.quantity, sortOrder: i.sortOrder, notes: i.notes })),
            )
          }
        }
        return toRecord(plan!)
      })
    },

    async addMeal(input: unknown): Promise<PlanMeal> {
      const values = parse(planMealInputSchema, input)
      return db.transaction(async (tx) => {
        await checkMeal(tx, values, null)
        const [row] = await tx.insert(planMeals).values(values).returning()
        await touchPlan(tx, values.mealPlanId)
        return toRecord(row!)
      })
    },

    async updateMeal(id: string, input: unknown): Promise<PlanMeal> {
      const values = parse(planMealInputSchema, input)
      return db.transaction(async (tx) => {
        const meal = await getMealRow(tx, id)
        await checkMeal(tx, values, id, meal.mealTypeId)
        const [row] = await tx
          .update(planMeals)
          .set({ ...values, updatedAt: now })
          .where(eq(planMeals.id, id))
          .returning()
        await touchPlan(tx, values.mealPlanId)
        return toRecord(row!)
      })
    },

    /** Öğün, içerikleriyle birlikte silinir (`CASCADE`). */
    async removeMeal(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const meal = await getMealRow(tx, id)
        await tx.delete(planMeals).where(eq(planMeals.id, id))
        await touchPlan(tx, meal.mealPlanId)
      })
    },

    async addItem(input: unknown): Promise<PlanMealItem> {
      const values = parse(planMealItemInputSchema, input)
      return db.transaction(async (tx) => {
        const meal = await getMealRow(tx, values.planMealId)
        await checkItemFood(tx, values.foodId)
        const [row] = await tx.insert(planMealItems).values(values).returning()
        await touchPlan(tx, meal.mealPlanId)
        return toRecord(row!)
      })
    },

    async updateItem(id: string, input: unknown): Promise<PlanMealItem> {
      const values = parse(planMealItemInputSchema, input)
      return db.transaction(async (tx) => {
        const item = await getItemRow(tx, id)
        const meal = await getMealRow(tx, values.planMealId)
        await checkItemFood(tx, values.foodId, item.foodId)
        const [row] = await tx
          .update(planMealItems)
          .set({ ...values, updatedAt: now })
          .where(eq(planMealItems.id, id))
          .returning()
        await touchPlan(tx, meal.mealPlanId)
        return toRecord(row!)
      })
    },

    async removeItem(id: string): Promise<void> {
      await db.transaction(async (tx) => {
        const item = await getItemRow(tx, id)
        const meal = await getMealRow(tx, item.planMealId)
        await tx.delete(planMealItems).where(eq(planMealItems.id, id))
        await touchPlan(tx, meal.mealPlanId)
      })
    },
  }
}
