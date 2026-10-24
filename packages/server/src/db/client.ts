import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { fileURLToPath } from 'node:url'
import * as schema from './schema'

export function createDb(connectionString: string) {
  return drizzle({ connection: { connectionString }, schema })
}

export type Db = ReturnType<typeof createDb>

export const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url))

export function applyMigrations(db: Db) {
  return migrate(db, { migrationsFolder })
}
