/** Kimlik doğrulama hız sınırları. Veritabanı gerektirmez: geçersiz gövdeler doğrulamada reddedilir, sayaç yine de artar. */
import { describe, expect, it } from 'vitest'
import { AUTH_RATE_LIMIT_RULES, createAuth } from './auth'
import type { Db } from './db/client'

const ORIGIN = 'http://localhost:5173'

function newAuth() {
  return createAuth({} as Db, { baseURL: ORIGIN, secret: 'diyetgo-test-secret-0123456789abcdefghij' })
}

/** Her çağrı ayrı bir `x-forwarded-for` kullanır; testler arasında sayaç paylaşılmaz. */
let nextIp = 1
const newIp = () => `10.0.0.${nextIp++}`

function post(auth: ReturnType<typeof newAuth>, path: string, ip: string) {
  return auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': ip },
      body: '{}',
    }),
  )
}

async function statuses(path: string, count: number) {
  const auth = newAuth()
  const ip = newIp()
  const out: number[] = []
  for (let i = 0; i < count; i++) out.push((await post(auth, path, ip)).status)
  return out
}

describe('kimlik doğrulama hız sınırı', () => {
  it('kuralları belirtilen pencere ve üst sınırlarla tanımlar', () => {
    expect(AUTH_RATE_LIMIT_RULES['/sign-in/email']).toEqual({ window: 60, max: 5 })
    expect(AUTH_RATE_LIMIT_RULES['/sign-up/email']).toEqual({ window: 300, max: 5 })
    expect(AUTH_RATE_LIMIT_RULES['/request-password-reset']).toEqual({ window: 300, max: 3 })
    expect(AUTH_RATE_LIMIT_RULES['/reset-password']).toEqual({ window: 300, max: 3 })
    expect(AUTH_RATE_LIMIT_RULES['/reset-password/*']).toEqual({ window: 300, max: 3 })
  })

  it('giriş 5 denemeden sonra 429 verir', async () => {
    const result = await statuses('/sign-in/email', 6)
    expect(result.slice(0, 5)).not.toContain(429)
    expect(result[5]).toBe(429)
  })

  it('kayıt 5 denemeden sonra 429 verir', async () => {
    const result = await statuses('/sign-up/email', 6)
    expect(result.slice(0, 5)).not.toContain(429)
    expect(result[5]).toBe(429)
  })

  it('parola sıfırlama isteği 3 denemeden sonra 429 verir', async () => {
    const result = await statuses('/request-password-reset', 4)
    expect(result.slice(0, 3)).not.toContain(429)
    expect(result[3]).toBe(429)
  })

  it('sayaç IP başınadır: bir istemcinin sınırı diğerini etkilemez', async () => {
    const auth = newAuth()
    const first = newIp()
    for (let i = 0; i < 6; i++) await post(auth, '/sign-in/email', first)
    expect((await post(auth, '/sign-in/email', first)).status).toBe(429)
    expect((await post(auth, '/sign-in/email', newIp())).status).not.toBe(429)
  })
})
