/**
 * Test veritabanı bağlantısı. Yalnızca `TEST_DATABASE_URL` kullanılır;
 * veritabanı adı `_test` ile bitmiyorsa hiçbir bağlantı kurulmadan hata verilir.
 */
import { databaseName, requireEnv } from '../env'

export function assertTestDatabaseUrl(url: string): string {
  const name = databaseName(url)
  if (!name.endsWith('_test')) {
    throw new Error(`Test veritabanının adı "_test" ile bitmeli (gelen: "${name}"). Testler durduruldu.`)
  }
  return url
}

export function testDatabaseUrl(): string {
  return assertTestDatabaseUrl(requireEnv('TEST_DATABASE_URL'))
}
