/**
 * Veritabanı şeması (CLAUDE.md §4.4). Alanlar `@diyetgo/shared` şemalarıyla aynı adları taşır;
 * sütun adları snake_case'dir.
 *
 * - Zaman damgaları `timestamptz`, takvim günleri `date`; ikisi de sürücüden metin olarak okunur.
 * - Danışan, besin ve öğün türü ilişkili kayıt varken silinemez (`RESTRICT`).
 * - Plan → öğün → öğün içeriği zinciri `CASCADE` ile silinir.
 * - Randevu ve hedef çakışmaları uygulama seviyesinde kontrol edilir; danışan başına tek açık
 *   hedef kısmi unique index ile de korunur.
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

const id = () => uuid('id').primaryKey().defaultRandom()
const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: 'string' })
const stamps = () => ({
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
})
const archivedAt = () => timestamptz('archived_at')
const calendarDate = (name: string) => date(name, { mode: 'string' })

export const sexEnum = pgEnum('sex', ['female', 'male'])
export const baseUnitEnum = pgEnum('base_unit', ['g', 'ml'])
export const appointmentStatusEnum = pgEnum('appointment_status', ['scheduled', 'completed', 'cancelled', 'no_show'])
export const goalMethodEnum = pgEnum('goal_method', ['manual', 'mifflin_st_jeor'])

export const clients = pgTable('clients', {
  id: id(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  birthDate: calendarDate('birth_date'),
  sex: sexEnum('sex'),
  email: text('email'),
  phone: text('phone'),
  notes: text('notes'),
  ...stamps(),
  archivedAt: archivedAt(),
})

export const measurements = pgTable(
  'measurements',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    measuredOn: calendarDate('measured_on').notNull(),
    weightKg: doublePrecision('weight_kg'),
    heightCm: doublePrecision('height_cm'),
    waistCm: doublePrecision('waist_cm'),
    hipCm: doublePrecision('hip_cm'),
    bodyFatPct: doublePrecision('body_fat_pct'),
    notes: text('notes'),
    ...stamps(),
  },
  (t) => [index('measurements_client_id_idx').on(t.clientId, t.measuredOn)],
)

export const foods = pgTable(
  'foods',
  {
    id: id(),
    name: text('name').notNull(),
    brand: text('brand'),
    baseUnit: baseUnitEnum('base_unit').notNull(),
    energyKcal: doublePrecision('energy_kcal').notNull(),
    proteinG: doublePrecision('protein_g').notNull(),
    carbsG: doublePrecision('carbs_g').notNull(),
    fatG: doublePrecision('fat_g').notNull(),
    portionLabel: text('portion_label'),
    portionAmount: doublePrecision('portion_amount'),
    source: text('source'),
    isSample: boolean('is_sample').notNull().default(false),
    ...stamps(),
    archivedAt: archivedAt(),
  },
  (t) => [
    check('foods_nutrients_non_negative', sql`${t.energyKcal} >= 0 and ${t.proteinG} >= 0 and ${t.carbsG} >= 0 and ${t.fatG} >= 0`),
    check('foods_portion_pair', sql`(${t.portionLabel} is null) = (${t.portionAmount} is null)`),
  ],
)

export const mealTypes = pgTable('meal_types', {
  id: id(),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull(),
  ...stamps(),
  archivedAt: archivedAt(),
})

export const mealPlans = pgTable(
  'meal_plans',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    startDate: calendarDate('start_date').notNull(),
    endDate: calendarDate('end_date'),
    notes: text('notes'),
    ...stamps(),
    archivedAt: archivedAt(),
  },
  (t) => [
    index('meal_plans_client_id_idx').on(t.clientId),
    check('meal_plans_date_order', sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
  ],
)

export const planMeals = pgTable(
  'plan_meals',
  {
    id: id(),
    mealPlanId: uuid('meal_plan_id')
      .notNull()
      .references(() => mealPlans.id, { onDelete: 'cascade' }),
    dayNumber: integer('day_number').notNull(),
    mealTypeId: uuid('meal_type_id')
      .notNull()
      .references(() => mealTypes.id, { onDelete: 'restrict' }),
    time: time('time'),
    notes: text('notes'),
    ...stamps(),
  },
  (t) => [
    // Aynı gün aynı öğün türü bir kez bulunur.
    uniqueIndex('plan_meals_plan_day_type_unique').on(t.mealPlanId, t.dayNumber, t.mealTypeId),
    index('plan_meals_meal_type_id_idx').on(t.mealTypeId),
    check('plan_meals_day_number_positive', sql`${t.dayNumber} >= 1`),
  ],
)

export const planMealItems = pgTable(
  'plan_meal_items',
  {
    id: id(),
    planMealId: uuid('plan_meal_id')
      .notNull()
      .references(() => planMeals.id, { onDelete: 'cascade' }),
    foodId: uuid('food_id')
      .notNull()
      .references(() => foods.id, { onDelete: 'restrict' }),
    /** Besinin temel birimi (g/ml) cinsinden. */
    quantity: doublePrecision('quantity').notNull(),
    sortOrder: integer('sort_order').notNull(),
    notes: text('notes'),
    ...stamps(),
  },
  (t) => [
    index('plan_meal_items_plan_meal_id_idx').on(t.planMealId),
    index('plan_meal_items_food_id_idx').on(t.foodId),
    check('plan_meal_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
)

export const appointments = pgTable(
  'appointments',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    startsAt: timestamptz('starts_at').notNull(),
    endsAt: timestamptz('ends_at').notNull(),
    status: appointmentStatusEnum('status').notNull().default('scheduled'),
    notes: text('notes'),
    ...stamps(),
  },
  (t) => [
    index('appointments_starts_at_idx').on(t.startsAt),
    index('appointments_client_id_idx').on(t.clientId),
    check('appointments_time_order', sql`${t.endsAt} > ${t.startsAt}`),
  ],
)

export const clientGoals = pgTable(
  'client_goals',
  {
    id: id(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    validFrom: calendarDate('valid_from').notNull(),
    validTo: calendarDate('valid_to'),
    energyKcal: doublePrecision('energy_kcal').notNull(),
    proteinG: doublePrecision('protein_g').notNull(),
    carbsG: doublePrecision('carbs_g').notNull(),
    fatG: doublePrecision('fat_g').notNull(),
    method: goalMethodEnum('method').notNull(),
    activityFactor: doublePrecision('activity_factor'),
    notes: text('notes'),
    ...stamps(),
  },
  (t) => [
    index('client_goals_client_id_idx').on(t.clientId, t.validFrom),
    // Danışan başına en fazla bir açık uçlu hedef.
    uniqueIndex('client_goals_one_open_per_client').on(t.clientId).where(sql`${t.validTo} is null`),
    check('client_goals_date_order', sql`${t.validTo} is null or ${t.validTo} >= ${t.validFrom}`),
  ],
)
