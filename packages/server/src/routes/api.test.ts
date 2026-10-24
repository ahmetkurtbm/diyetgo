/** Sözleşme testlerinin kapsamadığı, yalnızca HTTP API'ye özgü davranışlar. */
import request from 'supertest'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../app'
import { clients, mealPlans, mealTypes } from '../db/schema'
import { db, resetDatabase } from '../test/db'

const app = createApp(db)

beforeEach(resetDatabase)
afterAll(() => db.$client.end())

async function createClientRow() {
  const [row] = await db.insert(clients).values({ firstName: 'Eşzamanlı', lastName: 'Test' }).returning()
  return row!
}

describe('yerel erişim', () => {
  it('yerel olmayan Host başlığıyla gelen istekleri reddeder (DNS rebinding)', async () => {
    const res = await request(app).get('/api/clients').set('Host', 'evil.example:3001').expect(403)
    expect(res.body.error.code).toBe('forbidden')
    await request(app).get('/api/health').set('Host', 'localhost:5173').expect(200)
    await request(app).get('/api/health').set('Host', '127.0.0.1:3001').expect(200)
  })
})

describe('sorgu parametreleri', () => {
  it('geçersiz zaman aralığını ve randevu durumunu reddeder', async () => {
    const badFrom = await request(app).get('/api/appointments').query({ from: '2031-05-12' }).expect(400)
    expect(badFrom.body.error.fieldErrors).toHaveProperty('from')
    await request(app).get('/api/appointments').query({ status: 'unknown' }).expect(400)
  })

  it('geçersiz kimlikle filtrelemede demo modu gibi boş sonuç döndürür', async () => {
    expect((await request(app).get('/api/meal-plans').query({ clientId: 'abc' }).expect(200)).body).toEqual([])
    expect((await request(app).get('/api/appointments').query({ clientId: 'abc' }).expect(200)).body).toEqual([])
    expect((await request(app).get('/api/clients/abc/measurements').expect(200)).body).toEqual([])
    expect((await request(app).get('/api/foods/abc/plan-count').expect(200)).body).toEqual({ count: 0 })
  })

  it('çok büyük istek gövdesini doğrulama hatası olarak yanıtlar', async () => {
    const res = await request(app).post('/api/clients').send({ notes: 'x'.repeat(200_000) }).expect(400)
    expect(res.body.error.code).toBe('validation')
  })
})

describe('eşzamanlı istekler', () => {
  it('aynı saate gelen eşzamanlı randevulardan yalnızca biri kaydedilir', async () => {
    const client = await createClientRow()
    const body = { clientId: client.id, startsAt: '2031-05-12T09:00:00.000Z', endsAt: '2031-05-12T09:30:00.000Z', status: 'scheduled', notes: null }
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(app).post('/api/appointments').send(body)))
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409])
  })

  it('aynı ada sahip eşzamanlı öğün türlerinden yalnızca biri eklenir', async () => {
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(app).post('/api/meal-types').send({ name: 'Kuşluk', sortOrder: 1 })))
    expect(responses.map((r) => r.status).sort()).toEqual([201, 400, 400])
  })

  it('veritabanı benzersizlik ihlalini conflict olarak yanıtlar', async () => {
    const client = await createClientRow()
    const [plan] = await db.insert(mealPlans).values({ clientId: client.id, title: 'Plan', startDate: '2031-05-01' }).returning()
    const [type] = await db.insert(mealTypes).values({ name: 'Ara', sortOrder: 1 }).returning()
    const meal = { mealPlanId: plan!.id, dayNumber: 1, mealTypeId: type!.id, time: null, notes: null }
    const responses = await Promise.all(Array.from({ length: 4 }, () => request(app).post('/api/plan-meals').send(meal)))
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409])
  })

  it('aynı danışana eşzamanlı açık hedeflerden yalnızca biri eklenir', async () => {
    const client = await createClientRow()
    const body = {
      clientId: client.id,
      validFrom: '2031-01-01',
      validTo: null,
      energyKcal: 1800,
      proteinG: 90,
      carbsG: 200,
      fatG: 60,
      method: 'manual',
      activityFactor: null,
      notes: null,
    }
    const responses = await Promise.all(Array.from({ length: 3 }, () => request(app).post('/api/goals').send(body)))
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409])
  })
})
