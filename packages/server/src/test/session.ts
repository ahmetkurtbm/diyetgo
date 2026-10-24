/** Testlerde oturum açmış diyetisyen: hesap Better Auth ile oluşturulur, istekler oturum çereziyle gider. */
import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { createApp } from '../app'
import { createAuth } from '../auth'
import { db } from './db'

export const TEST_ORIGIN = 'http://localhost:5173'
export const TEST_PASSWORD = 'test-parola-12345'

export const auth = createAuth(db, { baseURL: TEST_ORIGIN, secret: 'diyetgo-test-secret-0123456789abcdefghij' })
export const app = createApp(db, auth)

/** Oturum çereziyle (veya çerezsiz) istek gönderen supertest sarmalayıcısı. */
export function client(cookie?: string) {
  const withCookie = (test: request.Test) => (cookie ? test.set('Cookie', cookie) : test)
  return {
    get: (url: string) => withCookie(request(app).get(url)),
    post: (url: string) => withCookie(request(app).post(url)),
    put: (url: string) => withCookie(request(app).put(url)),
    delete: (url: string) => withCookie(request(app).delete(url)),
  }
}

/** `Set-Cookie` başlıklarını istekte kullanılacak `Cookie` başlığına çevirir. */
export function cookieFrom(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ')
}

/** Yeni bir diyetisyen hesabı açar; oturum çerezini ve bu çerezle çalışan istemciyi döndürür. */
export async function signUp(name = 'Test Diyetisyen') {
  const email = `${randomUUID()}@example.com`
  const response = await auth.api.signUpEmail({ body: { name, email, password: TEST_PASSWORD }, asResponse: true })
  if (!response.ok) throw new Error(`Test hesabı açılamadı: ${response.status}`)
  const { user } = (await response.json()) as { user: { id: string } }
  const cookie = cookieFrom(response.headers)
  return { userId: user.id, email, cookie, http: client(cookie) }
}
