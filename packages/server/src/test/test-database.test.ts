import { sql } from 'drizzle-orm'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { migrationsFolder } from '../db/client'
import { db } from './db'
import { assertTestDatabaseUrl } from './test-database'

afterAll(() => db.$client.end())

describe('assertTestDatabaseUrl', () => {
  it('accepts a database whose name ends with _test', () => {
    expect(assertTestDatabaseUrl('postgres://u:p@localhost:5433/diyetgo_test')).toContain('diyetgo_test')
  })

  it.each(['postgres://u:p@localhost:5433/diyetgo', 'postgres://u:p@localhost:5433/diyetgo_test_copy', 'postgres://u:p@localhost:5433/'])(
    'rejects %s',
    (url) => {
      expect(() => assertTestDatabaseUrl(url)).toThrow(/_test/)
    },
  )
})

describe('migrations', () => {
  it('applies every migration in the journal to the test database', async () => {
    const journal = JSON.parse(readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8')) as { entries: unknown[] }
    const applied = await db.execute<{ count: number }>(sql`select count(*)::int as count from drizzle.__drizzle_migrations`)
    expect(applied.rows[0]?.count).toBe(journal.entries.length)

    const tables = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`,
    )
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      'accounts',
      'appointments',
      'client_goals',
      'clients',
      'foods',
      'meal_plans',
      'meal_types',
      'measurements',
      'plan_meal_items',
      'plan_meals',
      'sessions',
      'users',
      'verifications',
    ])
  })
})
