import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Kökteki .env (bkz. .env.example) varsa okunur; ortamda zaten tanımlı değişkenler korunur.
const envFile = fileURLToPath(new URL('../../../.env', import.meta.url))
if (existsSync(envFile)) process.loadEnvFile(envFile)

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} tanımlı değil. Kökteki .env.example dosyasını .env olarak kopyalayın.`)
  return value
}

/** Bağlantı adresinin parolasız, yazdırılabilir özeti: `host:port/veritabanı`. */
export function describeDatabaseUrl(url: string): string {
  const parsed = new URL(url)
  return `${parsed.hostname}:${parsed.port || '5432'}${parsed.pathname}`
}

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1))
}
