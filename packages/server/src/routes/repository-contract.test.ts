/**
 * Web'deki repository sözleşmesini API implementasyonuna karşı çalıştırır: web API repository'si →
 * gerçek HTTP → Express → PostgreSQL (test veritabanı). Demo implementasyonu aynı senaryoları
 * web paketinde çalıştırır.
 */
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll } from 'vitest'
import { createApiRepositories } from '../../../web/src/data/api/repositories'
import { describeRepositoryContract } from '../../../web/src/data/repository-contract'
import { db, resetDatabase } from '../test/db'
import { app, signUp } from '../test/session'

const server = app.listen(0, '127.0.0.1')
let baseUrl = ''

beforeAll(async () => {
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await db.$client.end()
})

// Her senaryo boş veritabanında, yeni açılmış bir diyetisyen hesabıyla çalışır. Tarayıcı çerezi
// kendisi gönderir; Node'da oturum çerezi her isteğe elle eklenir.
describeRepositoryContract('API (Express + PostgreSQL)', async () => {
  await resetDatabase()
  const { cookie } = await signUp()
  return createApiRepositories({
    baseUrl,
    fetch: (input, init) => fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), cookie } }),
  })
})
