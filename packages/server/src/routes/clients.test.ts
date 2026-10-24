import type { ClientInput } from '@diyetgo/shared'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { measurements } from '../db/schema'
import { db, resetDatabase } from '../test/db'
import { signUp, type client } from '../test/session'

let http: ReturnType<typeof client>
let ownerId: string

const input = (overrides: Partial<ClientInput> = {}): ClientInput => ({
  firstName: 'Deniz',
  lastName: 'Örnek',
  birthDate: '1990-05-01',
  sex: 'female',
  email: 'deniz@example.com',
  phone: null,
  notes: null,
  ...overrides,
})

async function createClient(overrides: Partial<ClientInput> = {}) {
  const res = await http.post('/api/clients').send(input(overrides)).expect(201)
  return res.body as { id: string; archivedAt: string | null }
}

beforeEach(async () => {
  await resetDatabase()
  ;({ http, userId: ownerId } = await signUp())
})
afterAll(() => db.$client.end())

describe('GET /api/health', () => {
  it('reports the API and database as ok', async () => {
    const res = await http.get('/api/health').expect(200)
    expect(res.body).toEqual({ status: 'ok', database: 'ok' })
  })
})

describe('/api/clients', () => {
  it('creates a client with a uuid and UTC ISO timestamps', async () => {
    const res = await http.post('/api/clients').send(input()).expect(201)
    expect(res.body).toMatchObject({ ...input(), archivedAt: null })
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

    const fetched = await http.get(`/api/clients/${res.body.id}`).expect(200)
    expect(fetched.body).toEqual(res.body)
  })

  it('rejects invalid input with field errors', async () => {
    const res = await http.post('/api/clients').send(input({ firstName: '  ', email: 'not-an-email' })).expect(400)
    expect(res.body.error.code).toBe('validation')
    expect(Object.keys(res.body.error.fieldErrors).sort()).toEqual(['email', 'firstName'])
  })

  it('rejects malformed JSON', async () => {
    const res = await http.post('/api/clients').set('Content-Type', 'application/json').send('{').expect(400)
    expect(res.body.error.code).toBe('validation')
  })

  it('returns 404 for unknown and malformed ids', async () => {
    await http.get('/api/clients/00000000-0000-4000-8000-000000000000').expect(404)
    const res = await http.get('/api/clients/not-a-uuid').expect(404)
    expect(res.body.error.code).toBe('not_found')
  })

  it('lists active clients in Turkish alphabetical order and searches by name or email', async () => {
    for (const lastName of ['Şahin', 'Sarı', 'Demir', 'Çelik']) await createClient({ lastName, email: null })
    await createClient({ firstName: 'Ece', lastName: 'Yıldız', email: 'ece@example.com' })

    const all = await http.get('/api/clients').expect(200)
    expect(all.body.map((c: { lastName: string }) => c.lastName)).toEqual(['Çelik', 'Demir', 'Sarı', 'Şahin', 'Yıldız'])

    const byName = await http.get('/api/clients').query({ search: 'deniz şah' }).expect(200)
    expect(byName.body.map((c: { lastName: string }) => c.lastName)).toEqual(['Şahin'])

    const byEmail = await http.get('/api/clients').query({ search: 'ECE@' }).expect(200)
    expect(byEmail.body).toHaveLength(1)

    const wildcard = await http.get('/api/clients').query({ search: '%' }).expect(200)
    expect(wildcard.body).toHaveLength(0)
  })

  it('updates a client', async () => {
    const client = await createClient()
    const res = await http.put(`/api/clients/${client.id}`).send(input({ phone: '0555 000 00 00' })).expect(200)
    expect(res.body.phone).toBe('0555 000 00 00')
    await http.put('/api/clients/00000000-0000-4000-8000-000000000000').send(input()).expect(404)
  })

  it('archives and restores a client; archived clients are hidden by default', async () => {
    const client = await createClient()
    const archived = await http.put(`/api/clients/${client.id}/archived`).send({ archived: true }).expect(200)
    expect(archived.body.archivedAt).not.toBeNull()

    expect((await http.get('/api/clients')).body).toHaveLength(0)
    expect((await http.get('/api/clients').query({ includeArchived: 'true' })).body).toHaveLength(1)

    const restored = await http.put(`/api/clients/${client.id}/archived`).send({ archived: false }).expect(200)
    expect(restored.body.archivedAt).toBeNull()

    await http.put(`/api/clients/${client.id}/archived`).send({ archived: 'yes' }).expect(400)
  })

  it('deletes a client without related records', async () => {
    const client = await createClient()
    await http.delete(`/api/clients/${client.id}`).expect(204)
    await http.get(`/api/clients/${client.id}`).expect(404)
  })

  it('refuses to delete a client with related records (RESTRICT)', async () => {
    const client = await createClient()
    await db.insert(measurements).values({ ownerId, clientId: client.id, measuredOn: '2026-10-01', weightKg: 70 })

    const res = await http.delete(`/api/clients/${client.id}`).expect(409)
    expect(res.body.error.code).toBe('restricted')
    await http.get(`/api/clients/${client.id}`).expect(200)
  })
})

describe('unknown API routes', () => {
  it('return a JSON 404', async () => {
    const res = await http.get('/api/nope').expect(404)
    expect(res.body.error.code).toBe('not_found')
  })
})
