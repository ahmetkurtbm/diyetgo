/**
 * Diyetisyen hesapları ve oturumlar (Better Auth). Kullanıcılar, oturumlar ve parola özetleri
 * kendi PostgreSQL veritabanımızda tutulur; dış servise veri gönderilmez (telemetri kapalı).
 *
 * - Giriş: e-posta + parola. Oturum, `HttpOnly` çerezle taşınır.
 * - Parola sıfırlama: e-posta servisi henüz yok; yerelde bağlantı sunucu günlüğüne yazılır,
 *   üretimde (NODE_ENV=production) özellik devre dışıdır.
 * - Yeni hesap varsayılan öğün türleriyle başlar.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Db } from './db/client'
import { accounts, sessions, users, verifications } from './db/schema'
import { insertDefaultMealTypes } from './services/meal-types'

export type AuthOptions = {
  /** Uygulamanın tarayıcıdan açıldığı adres (Vite proxy'si üzerinden): ör. `http://localhost:5173`. */
  baseURL: string
  /** En az 32 karakterlik rastgele gizli anahtar; yalnızca server ortam değişkeninden okunur. */
  secret: string
  /** Kimlik doğrulama isteklerinin kabul edildiği ek kökenler (CSRF koruması). */
  trustedOrigins?: string[]
}

export const MIN_PASSWORD_LENGTH = 10

/**
 * Kaba kuvvet ve hesap oluşturma/sıfırlama suistimaline karşı hız sınırları (yol, `basePath` olmadan).
 * Sayaçlar süreç belleğinde tutulur: veritabanı depolaması ek bir tablo/şema gerektirir, bu yüzden
 * kullanılmaz; sunucu yeniden başlarsa sayaçlar sıfırlanır ve birden çok süreç çalışırsa her süreç
 * kendi sayacını tutar. Sunucu birden çok süreçle yayına alınırsa ortak bir depolamaya geçilmelidir.
 */
export const AUTH_RATE_LIMIT_RULES = {
  '/sign-in/email': { window: 60, max: 5 },
  '/sign-up/email': { window: 300, max: 5 },
  '/request-password-reset': { window: 300, max: 3 },
  '/reset-password': { window: 300, max: 3 },
  '/reset-password/*': { window: 300, max: 3 },
}

export function createAuth(db: Db, { baseURL, secret, trustedOrigins = [] }: AuthOptions) {
  const production = process.env.NODE_ENV === 'production'
  return betterAuth({
    appName: 'Diyetgo',
    baseURL,
    basePath: '/api/auth',
    secret,
    trustedOrigins,
    telemetry: { enabled: false },
    // Better Auth hız sınırını yalnızca production'da açar; her ortamda açık olsun diye belirtilir.
    rateLimit: { enabled: true, storage: 'memory', customRules: AUTH_RATE_LIMIT_RULES },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      sendResetPassword: async ({ user, url }) => {
        if (production) throw new Error('Parola sıfırlama e-postası henüz yapılandırılmadı.')
        console.info(`[yerel geliştirme] ${user.email} için parola sıfırlama bağlantısı: ${url}`)
      },
    },
    advanced: {
      cookiePrefix: 'diyetgo',
      // Köken (CSRF) kontrolü her ortamda açıktır. Better Auth bunu NODE_ENV=test iken varsayılan
      // olarak kapatır; açıkça etkinleştirilmesi, testlerin gerçek davranışı sınamasını sağlar.
      disableOriginCheck: false,
      // Kimlikler uuid'dir; veritabanı `gen_random_uuid()` ile üretir.
      database: { generateId: 'uuid' },
      // İstemci IP'si için `ipAddressHeaders` verilmez (varsayılan korunur): güvenilir bir ters vekil
      // yok, API yalnızca yerelden (Vite proxy'si) erişilir. Varsayılan tek değerli `x-forwarded-for`
      // başlığını okur; API doğrudan internete açılırsa istemci bu başlığı değiştirip sayacı atlatabilir.
      // Sunucu bir ters vekilin arkasında yayına alınırsa vekilin ayarladığı başlık (`ipAddressHeaders`)
      // ve `trustedProxies` birlikte verilmelidir.
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await insertDefaultMealTypes(db, user.id)
          },
        },
      },
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
