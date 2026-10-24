/** Kimlik doğrulama ve diyetisyenler arası veri izolasyonu. */
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../test/db'
import { app, client, cookieFrom, signUp, TEST_ORIGIN, TEST_PASSWORD } from '../test/session'

beforeEach(resetDatabase)
afterAll(() => db.$client.end())

const clientBody = { firstName: 'Gizli', lastName: 'Danışan', birthDate: null, sex: null, email: null, phone: null, notes: null }
const foodBody = {
  name: 'Gizli besin',
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
}
const at = (time: string) => `2031-05-12T${time}:00.000Z`

describe('oturum', () => {
  it('oturum olmadan veri uçlarına erişilemez; sağlık kontrolü açıktır', async () => {
    const res = await client().get('/api/clients').expect(401)
    expect(res.body.error.code).toBe('unauthorized')
    await client().post('/api/clients').send(clientBody).expect(401)
    await client().get('/api/health').expect(200)
  })

  it('kayıt, oturum bilgisi, çıkış ve yeniden giriş tarayıcı akışıyla çalışır', async () => {
    const email = 'yeni.diyetisyen@example.com'
    const signUpRes = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ name: 'Yeni Diyetisyen', email, password: TEST_PASSWORD })
      .expect(200)
    const setCookie = signUpRes.headers['set-cookie'] as unknown as string[] | undefined
    const cookie = cookieFrom(new Headers((setCookie ?? []).map((c): [string, string] => ['set-cookie', c])))
    expect(cookie).toContain('diyetgo')

    const session = await client(cookie).get('/api/auth/get-session').expect(200)
    expect(session.body.user).toMatchObject({ email, name: 'Yeni Diyetisyen' })
    // Yeni hesap varsayılan öğün türleriyle başlar.
    expect((await client(cookie).get('/api/meal-types').expect(200)).body.length).toBeGreaterThan(0)

    await client(cookie).post('/api/auth/sign-out').set('Origin', TEST_ORIGIN).send({}).expect(200)
    await client(cookie).get('/api/clients').expect(401)

    await request(app).post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email, password: 'yanlis-parola-123' }).expect(401)
    await request(app).post('/api/auth/sign-in/email').set('Origin', TEST_ORIGIN).send({ email, password: TEST_PASSWORD }).expect(200)
  })

  it('kısa parolayı reddeder', async () => {
    await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', TEST_ORIGIN)
      .send({ name: 'Kısa', email: 'kisa@example.com', password: 'kisa' })
      .expect(400)
  })

  it('başka bir siteden gelen giriş, kayıt ve çıkış isteklerini reddeder (CSRF)', async () => {
    const { cookie, email } = await signUp()
    const evil = 'https://evil.example'
    await request(app).post('/api/auth/sign-out').set('Origin', evil).set('Cookie', cookie).send({}).expect(403)
    await request(app).post('/api/auth/sign-in/email').set('Origin', evil).send({ email, password: TEST_PASSWORD }).expect(403)
    await request(app).post('/api/auth/sign-up/email').set('Origin', evil).send({ name: 'Saldırgan', email: 'evil@example.com', password: TEST_PASSWORD }).expect(403)
    // Oturum hâlâ geçerlidir.
    await client(cookie).get('/api/clients').expect(200)
  })

  it('yanıtlarda sahip kimliği ve parola özeti bulunmaz', async () => {
    const { http } = await signUp()
    const created = (await http.post('/api/clients').send(clientBody).expect(201)).body
    expect(created).not.toHaveProperty('ownerId')
    const session = (await http.get('/api/auth/get-session').expect(200)).body
    expect(JSON.stringify(session)).not.toContain('password')
  })
})

describe('diyetisyenler arası izolasyon', () => {
  async function seedOwner() {
    const owner = await signUp('Birinci Diyetisyen')
    const { http } = owner
    const danisan = (await http.post('/api/clients').send(clientBody).expect(201)).body
    const food = (await http.post('/api/foods').send(foodBody).expect(201)).body
    const mealType = (await http.post('/api/meal-types').send({ name: 'Özel öğün', sortOrder: 1 }).expect(201)).body
    const plan = (await http.post('/api/meal-plans').send({ clientId: danisan.id, title: 'Plan', startDate: '2031-05-01', endDate: null, notes: null }).expect(201)).body
    const meal = (await http.post('/api/plan-meals').send({ mealPlanId: plan.id, dayNumber: 1, mealTypeId: mealType.id, time: null, notes: null }).expect(201)).body
    const item = (await http.post('/api/plan-meal-items').send({ planMealId: meal.id, foodId: food.id, quantity: 100, sortOrder: 0, notes: null }).expect(201)).body
    const measurement = (
      await http
        .post('/api/measurements')
        .send({ clientId: danisan.id, measuredOn: '2031-05-01', weightKg: 70, heightCm: null, waistCm: null, hipCm: null, thighCm: null, bodyFatPct: null, notes: null })
        .expect(201)
    ).body
    const appointment = (await http.post('/api/appointments').send({ clientId: danisan.id, startsAt: at('09:00'), endsAt: at('09:30'), status: 'scheduled', notes: null }).expect(201)).body
    const goal = (
      await http
        .post('/api/goals')
        .send({ clientId: danisan.id, validFrom: '2031-01-01', validTo: null, energyKcal: 1800, proteinG: 90, carbsG: 200, fatG: 60, method: 'manual', activityFactor: null, notes: null })
        .expect(201)
    ).body.goal
    const medication = (
      await http.post('/api/medications').send({ clientId: danisan.id, name: 'Gizli ilaç', dose: null, frequency: null, startedOn: null, endedOn: null, notes: null }).expect(201)
    ).body
    const condition = (await http.post('/api/conditions').send({ clientId: danisan.id, name: 'Gizli durum', diagnosedOn: null, notes: null }).expect(201)).body
    const recommendation = (await http.post('/api/recommendations').send({ clientId: danisan.id, givenOn: '2031-05-01', text: 'Gizli öneri' }).expect(201)).body
    return { danisan, food, mealType, plan, meal, item, measurement, appointment, goal, medication, condition, recommendation }
  }

  it('başka diyetisyenin kayıtlarını listelemez', async () => {
    await seedOwner()
    const { http } = await signUp('İkinci Diyetisyen')
    expect((await http.get('/api/clients').query({ includeArchived: 'true' })).body).toEqual([])
    expect((await http.get('/api/foods').query({ includeArchived: 'true' })).body).toEqual([])
    expect((await http.get('/api/meal-plans').query({ includeArchived: 'true' })).body).toEqual([])
    expect((await http.get('/api/appointments')).body).toEqual([])
    expect((await http.get('/api/meal-types')).body.map((t: { name: string }) => t.name)).not.toContain('Özel öğün')
  })

  it('başka diyetisyenin kaydını okuyamaz, değiştiremez, silemez (kayıt yokmuş gibi 404)', async () => {
    const a = await seedOwner()
    const { http } = await signUp('İkinci Diyetisyen')

    await http.get(`/api/clients/${a.danisan.id}`).expect(404)
    await http.put(`/api/clients/${a.danisan.id}`).send(clientBody).expect(404)
    await http.put(`/api/clients/${a.danisan.id}/archived`).send({ archived: true }).expect(404)
    await http.delete(`/api/clients/${a.danisan.id}`).expect(404)
    expect((await http.get(`/api/clients/${a.danisan.id}/measurements`).expect(200)).body).toEqual([])
    expect((await http.get(`/api/clients/${a.danisan.id}/goals`).expect(200)).body).toEqual([])

    await http.get(`/api/foods/${a.food.id}`).expect(404)
    await http.put(`/api/foods/${a.food.id}`).send(foodBody).expect(404)
    await http.delete(`/api/foods/${a.food.id}`).expect(404)
    expect((await http.get(`/api/foods/${a.food.id}/plan-count`).expect(200)).body).toEqual({ count: 0 })
    await http.put(`/api/meal-types/${a.mealType.id}`).send({ name: 'Ele geçirildi', sortOrder: 1 }).expect(404)
    await http.delete(`/api/meal-types/${a.mealType.id}`).expect(404)

    await http.get(`/api/meal-plans/${a.plan.id}`).expect(404)
    await http.put(`/api/meal-plans/${a.plan.id}/archived`).send({ archived: true }).expect(404)
    await http.post(`/api/meal-plans/${a.plan.id}/copy`).send({ clientId: a.danisan.id, startDate: '2031-06-01', title: 'Kopya' }).expect(404)
    await http.delete(`/api/meal-plans/${a.plan.id}`).expect(404)
    await http.put(`/api/plan-meals/${a.meal.id}`).send({ mealPlanId: a.plan.id, dayNumber: 2, mealTypeId: a.mealType.id, time: null, notes: null }).expect(404)
    await http.delete(`/api/plan-meals/${a.meal.id}`).expect(404)
    await http.put(`/api/plan-meal-items/${a.item.id}`).send({ planMealId: a.meal.id, foodId: a.food.id, quantity: 1, sortOrder: 0, notes: null }).expect(404)
    await http.delete(`/api/plan-meal-items/${a.item.id}`).expect(404)

    await http.put(`/api/measurements/${a.measurement.id}`).send({ ...a.measurement, weightKg: 1 }).expect(404)
    await http.delete(`/api/measurements/${a.measurement.id}`).expect(404)
    await http.post(`/api/appointments/${a.appointment.id}/cancel`).send({}).expect(404)
    await http.delete(`/api/appointments/${a.appointment.id}`).expect(404)
    await http.delete(`/api/goals/${a.goal.id}`).expect(404)

    for (const resource of ['medications', 'conditions', 'recommendations'] as const) {
      expect((await http.get(`/api/clients/${a.danisan.id}/${resource}`).expect(200)).body).toEqual([])
    }
    await http.put(`/api/medications/${a.medication.id}`).send({ ...a.medication, name: 'Ele geçirildi' }).expect(404)
    await http.delete(`/api/medications/${a.medication.id}`).expect(404)
    await http.put(`/api/conditions/${a.condition.id}`).send({ clientId: a.danisan.id, name: 'X', diagnosedOn: null, notes: null }).expect(404)
    await http.delete(`/api/conditions/${a.condition.id}`).expect(404)
    await http.put(`/api/recommendations/${a.recommendation.id}`).send({ clientId: a.danisan.id, givenOn: '2031-05-01', text: 'X' }).expect(404)
    await http.delete(`/api/recommendations/${a.recommendation.id}`).expect(404)
  })

  it('başka diyetisyenin danışanına, planına veya besinine bağlı kayıt oluşturamaz', async () => {
    const a = await seedOwner()
    const b = await signUp('İkinci Diyetisyen')
    const http = b.http

    await http
      .post('/api/measurements')
      .send({ clientId: a.danisan.id, measuredOn: '2031-05-02', weightKg: 1, heightCm: null, waistCm: null, hipCm: null, thighCm: null, bodyFatPct: null, notes: null })
      .expect(404)
    await http.post('/api/meal-plans').send({ clientId: a.danisan.id, title: 'X', startDate: '2031-05-01', endDate: null, notes: null }).expect(404)
    await http.post('/api/appointments').send({ clientId: a.danisan.id, startsAt: at('11:00'), endsAt: at('11:30'), status: 'scheduled', notes: null }).expect(404)
    await http
      .post('/api/goals')
      .send({ clientId: a.danisan.id, validFrom: '2031-01-01', validTo: null, energyKcal: 1, proteinG: 1, carbsG: 1, fatG: 1, method: 'manual', activityFactor: null, notes: null })
      .expect(404)
    await http.post('/api/medications').send({ clientId: a.danisan.id, name: 'X', dose: null, frequency: null, startedOn: null, endedOn: null, notes: null }).expect(404)
    await http.post('/api/conditions').send({ clientId: a.danisan.id, name: 'X', diagnosedOn: null, notes: null }).expect(404)
    await http.post('/api/recommendations').send({ clientId: a.danisan.id, givenOn: '2031-05-01', text: 'X' }).expect(404)
    // Kendi kaydını başkasının danışanına taşıyamaz.
    const own = (await http.post('/api/clients').send(clientBody).expect(201)).body
    const ownNote = (await http.post('/api/recommendations').send({ clientId: own.id, givenOn: '2031-05-01', text: 'Benim' }).expect(201)).body
    await http.put(`/api/recommendations/${ownNote.id}`).send({ clientId: a.danisan.id, givenOn: '2031-05-01', text: 'Taşı' }).expect(404)
    await http.post('/api/plan-meals').send({ mealPlanId: a.plan.id, dayNumber: 2, mealTypeId: a.mealType.id, time: null, notes: null }).expect(404)
    await http.post('/api/plan-meal-items').send({ planMealId: a.meal.id, foodId: a.food.id, quantity: 1, sortOrder: 0, notes: null }).expect(404)

    // Kendi planına başkasının besinini veya öğün türünü ekleyemez.
    const ownPlan = (await http.post('/api/meal-plans').send({ clientId: own.id, title: 'B', startDate: '2031-05-01', endDate: null, notes: null }).expect(201)).body
    await http.post('/api/plan-meals').send({ mealPlanId: ownPlan.id, dayNumber: 1, mealTypeId: a.mealType.id, time: null, notes: null }).expect(404)
    const ownType = (await http.get('/api/meal-types').expect(200)).body[0]
    const ownMeal = (await http.post('/api/plan-meals').send({ mealPlanId: ownPlan.id, dayNumber: 1, mealTypeId: ownType.id, time: null, notes: null }).expect(201)).body
    await http.post('/api/plan-meal-items').send({ planMealId: ownMeal.id, foodId: a.food.id, quantity: 1, sortOrder: 0, notes: null }).expect(404)
    await http.post(`/api/meal-plans/${ownPlan.id}/copy`).send({ clientId: a.danisan.id, startDate: '2031-06-01', title: 'Kopya' }).expect(404)
  })

  it('takvimler ayrıdır: aynı saatte iki diyetisyenin randevusu çakışmaz; öğün türü adları diyetisyen başına benzersizdir', async () => {
    await seedOwner()
    const { http } = await signUp('İkinci Diyetisyen')
    const own = (await http.post('/api/clients').send(clientBody).expect(201)).body
    await http.post('/api/appointments').send({ clientId: own.id, startsAt: at('09:00'), endsAt: at('09:30'), status: 'scheduled', notes: null }).expect(201)
    await http.post('/api/meal-types').send({ name: 'Özel öğün', sortOrder: 1 }).expect(201)
  })
})
