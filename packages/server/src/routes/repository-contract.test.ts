/**
 * Web'deki repository sözleşmesini API implementasyonuna karşı çalıştırır: web API repository'si →
 * gerçek HTTP → Express → PostgreSQL (test veritabanı). Demo implementasyonu aynı senaryoları
 * web paketinde çalıştırır.
 */
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll } from 'vitest'
import { createApiRepositories } from '../../../web/src/data/api/repositories'
import { describeRepositoryContract } from '../../../web/src/data/repository-contract'
import { createApp } from '../app'
import { db, resetDatabase } from '../test/db'

const server = createApp(db).listen(0, '127.0.0.1')
let baseUrl = ''

beforeAll(async () => {
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve))
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  await db.$client.end()
})

describeRepositoryContract('API (Express + PostgreSQL)', async () => {
  await resetDatabase()
  return createApiRepositories({ baseUrl })
})
