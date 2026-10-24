/**
 * Repository davranış sözleşmesi (CLAUDE.md §10): aynı senaryolar demo ve API implementasyonlarına
 * karşı çalıştırılır. Demo testi `demo/repositories.contract.test.ts`, API testi server paketindedir.
 *
 * Her senaryo kendi kayıtlarını oluşturur; mevcut (seed) verilere dayanmaz. Randevular seed
 * verisiyle çakışmaması için uzak bir tarihte (2031) oluşturulur.
 */
import type { AppointmentInput, ClientGoalInput, ClientInput, FoodInput, MealPlanInput } from '@diyetgo/shared'
import { beforeEach, describe, expect, it } from 'vitest'
import { RepositoryError, type Repositories, type RepositoryErrorCode } from './repositories'

const MISSING_ID = '00000000-0000-4000-8000-0000000000ff'

async function expectError(promise: Promise<unknown>, code: RepositoryErrorCode): Promise<RepositoryError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(RepositoryError)
  expect((error as RepositoryError).code).toBe(code)
  return error as RepositoryError
}

const clientInput = (overrides: Partial<ClientInput> = {}): ClientInput => ({
  firstName: 'Sözleşme',
  lastName: 'Danışanı',
  birthDate: '1990-01-15',
  sex: 'female',
  email: null,
  phone: null,
  notes: null,
  ...overrides,
})

const foodInput = (overrides: Partial<FoodInput> = {}): FoodInput => ({
  name: 'Sözleşme besini',
  brand: null,
  baseUnit: 'g',
  energyKcal: 100,
  proteinG: 5,
  carbsG: 10,
  fatG: 2,
  portionLabel: null,
  portionAmount: null,
  source: null,
  isSample: false,
  ...overrides,
})

const at = (time: string) => `2031-05-12T${time}:00.000Z`

export function describeRepositoryContract(name: string, setup: () => Promise<Repositories>) {
  describe(`repository sözleşmesi: ${name}`, () => {
    let repos: Repositories

    beforeEach(async () => {
      repos = await setup()
    })

    const createClient = (overrides: Partial<ClientInput> = {}) => repos.clients.create(clientInput(overrides))

    async function createPlan(overrides: Partial<MealPlanInput> = {}) {
      const client = await createClient()
      const plan = await repos.mealPlans.create({
        clientId: client.id,
        title: 'Sözleşme planı',
        startDate: '2031-05-01',
        endDate: '2031-05-07',
        notes: null,
        ...overrides,
      })
      const mealType = await repos.mealTypes.create({ name: `Öğün ${crypto.randomUUID().slice(0, 8)}`, sortOrder: 1 })
      return { client, plan, mealType }
    }

    describe('danışanlar', () => {
      it('oluşturur, getirir ve günceller', async () => {
        const created = await createClient()
        expect(created).toMatchObject({ ...clientInput(), archivedAt: null })
        expect(await repos.clients.get(created.id)).toEqual(created)

        const updated = await repos.clients.update(created.id, clientInput({ phone: '0555 000 00 00' }))
        expect(updated.phone).toBe('0555 000 00 00')
        expect(updated.createdAt).toBe(created.createdAt)
      })

      it('geçersiz girdiyi alan hatalarıyla reddeder, olmayan kayıt için not_found verir', async () => {
        const error = await expectError(repos.clients.create(clientInput({ firstName: ' ' })), 'validation')
        expect(error.fieldErrors.firstName).toBeTruthy()
        await expectError(repos.clients.get(MISSING_ID), 'not_found')
        await expectError(repos.clients.update(MISSING_ID, clientInput()), 'not_found')
      })

      it('arşivlenen danışanı varsayılan listede gizler ve geri alınabilir', async () => {
        const client = await createClient({ lastName: 'Arşivlik' })
        await repos.clients.setArchived(client.id, true)
        expect((await repos.clients.list({ search: 'Arşivlik' })).map((c) => c.id)).toEqual([])
        expect((await repos.clients.list({ search: 'Arşivlik', includeArchived: true })).map((c) => c.id)).toEqual([client.id])
        expect((await repos.clients.setArchived(client.id, false)).archivedAt).toBeNull()
      })

      it('ilişkili kaydı olan danışanı silmez (restricted), olmayanı siler', async () => {
        const withRecord = await createClient()
        await repos.measurements.create({ clientId: withRecord.id, measuredOn: '2031-05-01', weightKg: 70, heightCm: null, waistCm: null, hipCm: null, bodyFatPct: null, notes: null })
        await expectError(repos.clients.remove(withRecord.id), 'restricted')

        const alone = await createClient()
        await repos.clients.remove(alone.id)
        await expectError(repos.clients.get(alone.id), 'not_found')
      })
    })

    describe('ölçümler', () => {
      it('en az bir değer ister; en yeni ölçümü önce listeler, günceller ve siler', async () => {
        const client = await createClient()
        const base = { clientId: client.id, weightKg: null, heightCm: null, waistCm: null, hipCm: null, bodyFatPct: null, notes: null }
        await expectError(repos.measurements.create({ ...base, measuredOn: '2031-05-01' }), 'validation')

        const older = await repos.measurements.create({ ...base, measuredOn: '2031-05-01', weightKg: 72.5 })
        const newer = await repos.measurements.create({ ...base, measuredOn: '2031-05-08', weightKg: 71.8 })
        expect((await repos.measurements.listByClient(client.id)).map((m) => m.id)).toEqual([newer.id, older.id])

        expect((await repos.measurements.update(older.id, { ...base, measuredOn: '2031-05-01', weightKg: 73 })).weightKg).toBe(73)
        await repos.measurements.remove(older.id)
        expect((await repos.measurements.listByClient(client.id)).map((m) => m.id)).toEqual([newer.id])
      })
    })

    describe('besinler ve öğün türleri', () => {
      it('besini arar, arşivler; arşivlenmiş besin yeni öğüne eklenemez ama mevcut içerikte kalır', async () => {
        const food = await repos.foods.create(foodInput({ name: 'Sözleşme yulafı' }))
        expect((await repos.foods.list({ search: 'sözleşme yula' })).map((f) => f.id)).toEqual([food.id])

        const { plan, mealType } = await createPlan()
        const meal = await repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 1, mealTypeId: mealType.id, time: '08:00', notes: null })
        const item = await repos.mealPlans.addItem({ planMealId: meal.id, foodId: food.id, quantity: 40, sortOrder: 0, notes: null })

        await repos.foods.setArchived(food.id, true)
        expect(await repos.foods.list({ search: 'sözleşme yula' })).toEqual([])
        await expectError(repos.mealPlans.addItem({ planMealId: meal.id, foodId: food.id, quantity: 20, sortOrder: 1, notes: null }), 'validation')
        expect((await repos.mealPlans.updateItem(item.id, { planMealId: meal.id, foodId: food.id, quantity: 50, sortOrder: 0, notes: null })).quantity).toBe(50)
        expect((await repos.mealPlans.get(plan.id)).items.map((i) => i.id)).toEqual([item.id])
      })

      it('planda kullanılan besini silmez; kullanan plan sayısını verir', async () => {
        const food = await repos.foods.create(foodInput())
        const unused = await repos.foods.create(foodInput({ name: 'Kullanılmayan' }))
        for (let i = 0; i < 2; i++) {
          const { plan, mealType } = await createPlan()
          const meal = await repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 1, mealTypeId: mealType.id, time: null, notes: null })
          await repos.mealPlans.addItem({ planMealId: meal.id, foodId: food.id, quantity: 100, sortOrder: 0, notes: null })
          await repos.mealPlans.addItem({ planMealId: meal.id, foodId: food.id, quantity: 50, sortOrder: 1, notes: null })
        }
        expect(await repos.foods.countPlansUsing(food.id)).toBe(2)
        await expectError(repos.foods.remove(food.id), 'restricted')

        expect(await repos.foods.countPlansUsing(unused.id)).toBe(0)
        await repos.foods.remove(unused.id)
        await expectError(repos.foods.get(unused.id), 'not_found')
      })

      it('öğün türü adı büyük/küçük harften bağımsız benzersizdir; kullanılan tür silinemez', async () => {
        const type = await repos.mealTypes.create({ name: 'Gece atıştırması', sortOrder: 9 })
        const error = await expectError(repos.mealTypes.create({ name: 'GECE ATIŞTIRMASI', sortOrder: 10 }), 'validation')
        expect(error.fieldErrors.name).toBeTruthy()

        const { plan } = await createPlan()
        await repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 2, mealTypeId: type.id, time: null, notes: null })
        await expectError(repos.mealTypes.remove(type.id), 'restricted')
      })
    })

    describe('beslenme planları', () => {
      it('arşivlenmiş danışana plan eklenmez', async () => {
        const client = await createClient()
        await repos.clients.setArchived(client.id, true)
        await expectError(
          repos.mealPlans.create({ clientId: client.id, title: 'Plan', startDate: '2031-05-01', endDate: null, notes: null }),
          'restricted',
        )
      })

      it('aynı gün aynı öğünü ve plan dışındaki günü reddeder; süre kısaltma mevcut öğünleri dışarıda bırakamaz', async () => {
        const { plan, mealType } = await createPlan()
        const meal = await repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 7, mealTypeId: mealType.id, time: null, notes: null })

        const duplicate = await expectError(
          repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 7, mealTypeId: mealType.id, time: null, notes: null }),
          'conflict',
        )
        expect(duplicate.conflictingIds).toEqual([meal.id])
        await expectError(repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 8, mealTypeId: mealType.id, time: null, notes: null }), 'validation')

        const shrink = await expectError(repos.mealPlans.update(plan.id, { ...plan, endDate: '2031-05-03' }), 'conflict')
        expect(shrink.conflictingIds).toEqual([meal.id])
      })

      it('planı öğün ve içerikleriyle başka danışana kopyalar; süre korunur', async () => {
        const { plan, mealType } = await createPlan()
        const food = await repos.foods.create(foodInput())
        const meal = await repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 3, mealTypeId: mealType.id, time: '12:30', notes: 'Not' })
        await repos.mealPlans.addItem({ planMealId: meal.id, foodId: food.id, quantity: 150, sortOrder: 0, notes: null })
        const other = await createClient({ firstName: 'Diğer' })

        const copy = await repos.mealPlans.copy(plan.id, { clientId: other.id, startDate: '2031-06-01', title: 'Kopya' })
        expect(copy).toMatchObject({ clientId: other.id, title: 'Kopya', startDate: '2031-06-01', endDate: '2031-06-07' })

        const detail = await repos.mealPlans.get(copy.id)
        expect(detail.meals).toHaveLength(1)
        expect(detail.meals[0]).toMatchObject({ dayNumber: 3, mealTypeId: mealType.id, time: '12:30', notes: 'Not' })
        expect(detail.meals[0]!.id).not.toBe(meal.id)
        expect(detail.items).toEqual([expect.objectContaining({ planMealId: detail.meals[0]!.id, foodId: food.id, quantity: 150 })])
      })

      it('öğün silinince içerikleri, plan silinince öğünleri silinir', async () => {
        const { plan, mealType } = await createPlan()
        const food = await repos.foods.create(foodInput())
        const meal = await repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 1, mealTypeId: mealType.id, time: null, notes: null })
        await repos.mealPlans.addItem({ planMealId: meal.id, foodId: food.id, quantity: 10, sortOrder: 0, notes: null })

        await repos.mealPlans.removeMeal(meal.id)
        expect(await repos.mealPlans.get(plan.id)).toMatchObject({ meals: [], items: [] })
        expect(await repos.foods.countPlansUsing(food.id)).toBe(0)

        await repos.mealPlans.addMeal({ mealPlanId: plan.id, dayNumber: 1, mealTypeId: mealType.id, time: null, notes: null })
        await repos.mealPlans.remove(plan.id)
        await expectError(repos.mealPlans.get(plan.id), 'not_found')
        await repos.mealTypes.remove(mealType.id)
      })
    })

    describe('randevular', () => {
      async function createAppointment(clientId: string, startsAt: string, endsAt: string, overrides: Partial<AppointmentInput> = {}) {
        return repos.appointments.create({ clientId, startsAt, endsAt, status: 'scheduled', notes: null, ...overrides })
      }

      it('çakışan randevuyu reddeder; bitişik ve iptal edilmiş randevular yer tutmaz', async () => {
        const client = await createClient()
        const first = await createAppointment(client.id, at('09:00'), at('09:30'))

        const conflict = await expectError(createAppointment(client.id, at('09:15'), at('09:45')), 'conflict')
        expect(conflict.conflictingIds).toEqual([first.id])
        await createAppointment(client.id, at('09:30'), at('10:00'))

        expect((await repos.appointments.cancel(first.id)).status).toBe('cancelled')
        await createAppointment(client.id, at('09:00'), at('09:30'))
      })

      it('yarı açık zaman aralığına göre sıralı listeler', async () => {
        const client = await createClient()
        const late = await createAppointment(client.id, at('11:00'), at('11:30'))
        const early = await createAppointment(client.id, at('08:00'), at('08:30'))
        await createAppointment(client.id, at('12:00'), at('12:30'))

        const listed = await repos.appointments.list({ from: at('08:00'), to: at('12:00'), clientId: client.id })
        expect(listed.map((a) => a.id)).toEqual([early.id, late.id])
        expect(await repos.appointments.list({ clientId: client.id, status: 'cancelled' })).toEqual([])
      })

      it('arşivlenmiş danışana randevu eklenmez; randevu silinebilir', async () => {
        const client = await createClient()
        const appointment = await createAppointment(client.id, at('14:00'), at('14:30'))
        await repos.clients.setArchived(client.id, true)
        await expectError(createAppointment(client.id, at('15:00'), at('15:30')), 'restricted')

        await repos.appointments.remove(appointment.id)
        expect(await repos.appointments.list({ clientId: client.id })).toEqual([])
      })
    })

    describe('hedefler', () => {
      const goalInput = (clientId: string, overrides: Partial<ClientGoalInput> = {}): ClientGoalInput => ({
        clientId,
        validFrom: '2031-01-01',
        validTo: null,
        energyKcal: 1800,
        proteinG: 90,
        carbsG: 200,
        fatG: 60,
        method: 'manual',
        activityFactor: null,
        notes: null,
        ...overrides,
      })

      it('yeni hedef önceki açık hedefi bir gün önce kapatır; geçmiş korunur', async () => {
        const client = await createClient()
        const { goal: first, closed: none } = await repos.goals.create(goalInput(client.id))
        expect(none).toBeNull()

        const { goal: second, closed } = await repos.goals.create(goalInput(client.id, { validFrom: '2031-03-01', energyKcal: 1700 }))
        expect(closed).toMatchObject({ id: first.id, validTo: '2031-02-28' })
        expect((await repos.goals.listByClient(client.id)).map((g) => [g.id, g.validTo])).toEqual([
          [second.id, null],
          [first.id, '2031-02-28'],
        ])
      })

      it('çakışan dönemleri reddeder', async () => {
        const client = await createClient()
        const { goal } = await repos.goals.create(goalInput(client.id, { validFrom: '2031-03-01', validTo: '2031-03-31' }))
        await repos.goals.create(goalInput(client.id, { validFrom: '2031-04-01', validTo: '2031-04-30' }))

        const error = await expectError(repos.goals.create(goalInput(client.id, { validFrom: '2031-03-15', validTo: '2031-04-15' })), 'conflict')
        expect(error.conflictingIds).toHaveLength(2)
        await expectError(repos.goals.update(goal.id, goalInput(client.id, { validFrom: '2031-03-01', validTo: '2031-04-02' })), 'conflict')

        await repos.goals.remove(goal.id)
        expect(await repos.goals.listByClient(client.id)).toHaveLength(1)
      })
    })
  })
}
