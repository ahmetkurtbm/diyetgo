/**
 * Arayüzün veri erişim sözleşmesi. Bileşenler yalnızca bu arayüzleri kullanır; verinin
 * localStorage'da mı (demo) yoksa API üzerinden PostgreSQL'de mi (yerel) tutulduğunu bilmez.
 * Tüm metotlar asenkrondur ki iki implementasyon aynı arayüzü paylaşabilsin.
 */
import type {
  Appointment,
  AppointmentInput,
  AppointmentStatus,
  Client,
  ClientCondition,
  ClientConditionInput,
  ClientGoal,
  ClientGoalInput,
  ClientMedication,
  ClientMedicationInput,
  ClientRecommendation,
  ClientRecommendationInput,
  ClientInput,
  Food,
  FoodInput,
  MealPlan,
  MealPlanInput,
  MealType,
  MealTypeInput,
  Measurement,
  MeasurementInput,
  PlanMeal,
  PlanMealInput,
  PlanMealItem,
  PlanMealItemInput,
} from '@diyetgo/shared'

export type RepositoryErrorCode = 'validation' | 'not_found' | 'conflict' | 'restricted' | 'storage'

/**
 * - `validation`: girdi geçersiz; `fieldErrors` alan bazında mesajları içerir.
 * - `not_found`: kayıt yok.
 * - `conflict`: iş kuralı çakışması (randevu saati, hedef dönemi, aynı gün aynı öğün); `conflictingIds` doludur.
 * - `restricted`: ilişkili kayıtlar nedeniyle işlem engellendi (ör. planı olan danışan silinemez).
 * - `storage`: veri kaydedilemedi.
 */
export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode
  readonly fieldErrors: Readonly<Record<string, string>>
  readonly conflictingIds: readonly string[]

  constructor(
    code: RepositoryErrorCode,
    message: string,
    extra: { fieldErrors?: Record<string, string>; conflictingIds?: string[] } = {},
  ) {
    super(message)
    this.name = 'RepositoryError'
    this.code = code
    this.fieldErrors = extra.fieldErrors ?? {}
    this.conflictingIds = extra.conflictingIds ?? []
  }
}

export type ArchiveFilter = { includeArchived?: boolean }

export interface ClientRepository {
  list(options?: ArchiveFilter & { search?: string }): Promise<Client[]>
  get(id: string): Promise<Client>
  create(input: ClientInput): Promise<Client>
  update(id: string, input: ClientInput): Promise<Client>
  setArchived(id: string, archived: boolean): Promise<Client>
  /** Ölçüm, plan, randevu, hedef, ilaç, hastalık veya önerisi olan danışan silinemez (`restricted`). */
  remove(id: string): Promise<void>
}

export interface MeasurementRepository {
  /** En yeni ölçüm önce. */
  listByClient(clientId: string): Promise<Measurement[]>
  create(input: MeasurementInput): Promise<Measurement>
  update(id: string, input: MeasurementInput): Promise<Measurement>
  remove(id: string): Promise<void>
}

export interface FoodRepository {
  list(options?: ArchiveFilter & { search?: string }): Promise<Food[]>
  get(id: string): Promise<Food>
  create(input: FoodInput): Promise<Food>
  update(id: string, input: FoodInput): Promise<Food>
  setArchived(id: string, archived: boolean): Promise<Food>
  /** Bir öğün içeriğinde kullanılan besin silinemez (`restricted`). */
  remove(id: string): Promise<void>
  /** Besini kullanan plan sayısı; düzenlemede canlı hesaplama uyarısı için. */
  countPlansUsing(id: string): Promise<number>
}

export interface MealTypeRepository {
  /** `sortOrder`'a göre sıralı. */
  list(options?: ArchiveFilter): Promise<MealType[]>
  create(input: MealTypeInput): Promise<MealType>
  update(id: string, input: MealTypeInput): Promise<MealType>
  setArchived(id: string, archived: boolean): Promise<MealType>
  /** Bir planda kullanılan öğün türü silinemez (`restricted`). */
  remove(id: string): Promise<void>
}

export type MealPlanDetail = { plan: MealPlan; meals: PlanMeal[]; items: PlanMealItem[] }

export interface MealPlanRepository {
  /** En yeni başlangıç tarihi önce. */
  list(options?: ArchiveFilter & { clientId?: string }): Promise<MealPlan[]>
  get(id: string): Promise<MealPlanDetail>
  create(input: MealPlanInput): Promise<MealPlan>
  update(id: string, input: MealPlanInput): Promise<MealPlan>
  setArchived(id: string, archived: boolean): Promise<MealPlan>
  /** Plan, öğünleri ve öğün içerikleriyle birlikte silinir. */
  remove(id: string): Promise<void>
  /** Planı öğünleri ve içerikleriyle kopyalar; plan süresi korunur. */
  copy(id: string, target: { clientId: string; startDate: string; title: string }): Promise<MealPlan>
  addMeal(input: PlanMealInput): Promise<PlanMeal>
  updateMeal(id: string, input: PlanMealInput): Promise<PlanMeal>
  /** Öğün, içerikleriyle birlikte silinir. */
  removeMeal(id: string): Promise<void>
  addItem(input: PlanMealItemInput): Promise<PlanMealItem>
  updateItem(id: string, input: PlanMealItemInput): Promise<PlanMealItem>
  removeItem(id: string): Promise<void>
}

export interface AppointmentRepository {
  /** `from`/`to`: UTC zaman aralığı, yarı açık `[from, to)`. Başlangıç zamanına göre sıralı. */
  list(options?: { from?: string; to?: string; clientId?: string; status?: AppointmentStatus }): Promise<Appointment[]>
  create(input: AppointmentInput): Promise<Appointment>
  update(id: string, input: AppointmentInput): Promise<Appointment>
  cancel(id: string): Promise<Appointment>
  remove(id: string): Promise<void>
}

export interface GoalRepository {
  /** En yeni dönem önce. */
  listByClient(clientId: string): Promise<ClientGoal[]>
  /** Önceki açık hedef gerekiyorsa aynı işlemde kapatılır ve `closed` olarak döner. */
  create(input: ClientGoalInput): Promise<{ goal: ClientGoal; closed: ClientGoal | null }>
  update(id: string, input: ClientGoalInput): Promise<ClientGoal>
  remove(id: string): Promise<void>
}

/**
 * Danışana bağlı, alt kaydı olmayan basit kayıt (ilaç, hastalık, öneri): danışan altında listelenir,
 * serbestçe silinebilir. Danışanın bu kayıtları varken danışan silinemez (`restricted`).
 */
export interface ClientRecordRepository<T, I> {
  listByClient(clientId: string): Promise<T[]>
  create(input: I): Promise<T>
  update(id: string, input: I): Promise<T>
  remove(id: string): Promise<void>
}

export type DemoInfo = { persistent: boolean; seededAt: string; counts: Record<string, number> }

/** Yalnızca demo modunda bulunur. */
export interface DemoControls {
  info(): Promise<DemoInfo>
  /** Yalnızca Diyetgo demo verilerini siler ve örnek verileri yeniden yükler. */
  reset(): Promise<void>
}

export type Repositories = {
  mode: 'demo' | 'api'
  clients: ClientRepository
  measurements: MeasurementRepository
  foods: FoodRepository
  mealTypes: MealTypeRepository
  mealPlans: MealPlanRepository
  appointments: AppointmentRepository
  goals: GoalRepository
  /** Devam eden ilaçlar (bitişi olmayanlar) önce, ardından en yeni başlangıç. */
  medications: ClientRecordRepository<ClientMedication, ClientMedicationInput>
  /** Eklenme sırasıyla. */
  conditions: ClientRecordRepository<ClientCondition, ClientConditionInput>
  /** En yeni öneri önce. */
  recommendations: ClientRecordRepository<ClientRecommendation, ClientRecommendationInput>
  demo: DemoControls | null
  /** Veri değiştiğinde (bu sekmede veya başka sekmede) çağrılır; aboneliği kaldıran fonksiyon döner. */
  subscribe(listener: () => void): () => void
}
