/**
 * Veritabanı şeması (CLAUDE.md §4.4). Alanlar `@diyetgo/shared` şemalarıyla aynı adları taşır;
 * sütun adları snake_case'dir.
 *
 * - Zaman damgaları `timestamptz`, takvim günleri `date`; ikisi de sürücüden metin olarak okunur.
 * - Danışan, besin ve öğün türü ilişkili kayıt varken silinemez (`RESTRICT`).
 * - Plan → öğün → öğün içeriği zinciri `CASCADE` ile silinir.
 * - Randevu ve hedef çakışmaları uygulama seviyesinde kontrol edilir; danışan başına tek açık
 *   hedef kısmi unique index ile de korunur.
 * - Her diyetisyen yalnızca kendi kayıtlarını görür: üst düzey tablolarda `owner_id` vardır ve
 *   servisler her sorguyu buna göre süzer. Plan öğünleri ve içerikleri planın sahibine bağlıdır.
 * - Kimlik doğrulama tabloları (`users`, `sessions`, `accounts`, `verifications`) Better Auth'un
 *   beklediği alanlardır; Better Auth bunlara Drizzle adaptörüyle erişir.
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

// ---------- Kimlik doğrulama (Better Auth) ----------

export const users = pgTable('users', {
  id: id(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
)

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    /** Better Auth'un ürettiği parola özeti (scrypt); düz parola saklanmaz. */
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('accounts_user_id_idx').on(t.userId)],
)

export const verifications = pgTable(
  'verifications',
  {
    id: id(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)

/** Kaydın sahibi olan diyetisyen. Hesap, kayıtları varken silinemez. */
const ownerId = () =>
  uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' })

// ---------- Uygulama verisi ----------

export const clients = pgTable(
  'clients',
  {
    id: id(),
    ownerId: ownerId(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    birthDate: calendarDate('birth_date'),
    sex: sexEnum('sex'),
    email: text('email'),
    phone: text('phone'),
    notes: text('notes'),
    ...stamps(),
    archivedAt: archivedAt(),
  },
  (t) => [index('clients_owner_id_idx').on(t.ownerId)],
)

export const measurements = pgTable(
  'measurements',
  {
    id: id(),
    ownerId: ownerId(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    measuredOn: calendarDate('measured_on').notNull(),
    weightKg: doublePrecision('weight_kg'),
    heightCm: doublePrecision('height_cm'),
    waistCm: doublePrecision('waist_cm'),
    hipCm: doublePrecision('hip_cm'),
    /** Uyluk (bacak) çevresi. */
    thighCm: doublePrecision('thigh_cm'),
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
    ownerId: ownerId(),
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
    index('foods_owner_id_idx').on(t.ownerId),
    check('foods_nutrients_non_negative', sql`${t.energyKcal} >= 0 and ${t.proteinG} >= 0 and ${t.carbsG} >= 0 and ${t.fatG} >= 0`),
    check('foods_portion_pair', sql`(${t.portionLabel} is null) = (${t.portionAmount} is null)`),
  ],
)

export const mealTypes = pgTable(
  'meal_types',
  {
    id: id(),
    ownerId: ownerId(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull(),
    ...stamps(),
    archivedAt: archivedAt(),
  },
  (t) => [index('meal_types_owner_id_idx').on(t.ownerId)],
)

export const mealPlans = pgTable(
  'meal_plans',
  {
    id: id(),
    ownerId: ownerId(),
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
    ownerId: ownerId(),
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
    index('appointments_owner_starts_at_idx').on(t.ownerId, t.startsAt),
    index('appointments_client_id_idx').on(t.clientId),
    check('appointments_time_order', sql`${t.endsAt} > ${t.startsAt}`),
  ],
)

export const clientGoals = pgTable(
  'client_goals',
  {
    id: id(),
    ownerId: ownerId(),
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

// ---------- Danışanın sağlık bilgileri ve öneriler ----------

/** Danışana bağlı, sahibi olan ve yalnızca danışan altında listelenen kayıtlar için ortak sütunlar. */
const clientChild = () => ({
  id: id(),
  ownerId: ownerId(),
  clientId: uuid('client_id')
    .notNull()
    .references(() => clients.id, { onDelete: 'restrict' }),
})

export const clientMedications = pgTable(
  'client_medications',
  {
    ...clientChild(),
    name: text('name').notNull(),
    dose: text('dose'),
    frequency: text('frequency'),
    startedOn: calendarDate('started_on'),
    endedOn: calendarDate('ended_on'),
    notes: text('notes'),
    ...stamps(),
  },
  (t) => [
    index('client_medications_client_id_idx').on(t.ownerId, t.clientId),
    check('client_medications_date_order', sql`${t.startedOn} is null or ${t.endedOn} is null or ${t.endedOn} >= ${t.startedOn}`),
  ],
)

export const clientConditions = pgTable(
  'client_conditions',
  {
    ...clientChild(),
    name: text('name').notNull(),
    diagnosedOn: calendarDate('diagnosed_on'),
    notes: text('notes'),
    ...stamps(),
  },
  (t) => [index('client_conditions_client_id_idx').on(t.ownerId, t.clientId)],
)

export const clientRecommendations = pgTable(
  'client_recommendations',
  {
    ...clientChild(),
    givenOn: calendarDate('given_on').notNull(),
    text: text('text').notNull(),
    ...stamps(),
  },
  (t) => [index('client_recommendations_client_id_idx').on(t.ownerId, t.clientId, t.givenOn)],
)
