import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { closePool, query } from './client'

/**
 * M0-T06A — schema compatibility, asserted against a live PostgreSQL.
 *
 * These assertions run on the real engine, not a doc reading and not SQLite, so
 * a claim about what the database can store is backed by the database itself.
 *
 * SCOPE: this test RECORDS the frozen schema's current capability. Where the
 * schema cannot hold a state the Data SOT or API contract requires, the test
 * asserts the gap exists rather than asserting the desired value. That is
 * deliberate: M0-T06A is forbidden from fixing lifecycle states, so a test
 * demanding the correct value would fail for a reason nobody is allowed to
 * resolve yet. When migration 002 lands, these expectations flip and the flip
 * is the proof the gap closed.
 */
const MIGRATION = readFileSync(
  join(process.cwd(), 'db', 'migrations', '001_p0_init.sql'),
  'utf8',
)

afterAll(async () => {
  await closePool()
})

async function enumValues(typeName: string): Promise<string[]> {
  const rows = await query<{ label: string }>(
    `SELECT e.enumlabel AS label
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = $1
     ORDER BY e.enumsortorder`,
    [typeName],
  )
  return rows.map((r) => r.label)
}

describe('M0-T06A PostgreSQL foundation', () => {
  it('runs PostgreSQL, the engine the architecture freezes', async () => {
    const [row] = await query<{ server_version: string }>('SHOW server_version')

    expect(Number.parseInt(row!.server_version, 10)).toBeGreaterThanOrEqual(16)
  })

  it('applies every table the frozen migration declares', async () => {
    const declared = [...MIGRATION.matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]!)
    const live = (
      await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      )
    ).map((r) => r.table_name)

    expect(declared).toHaveLength(27)
    for (const table of declared) {
      expect(live, `${table} missing from the live schema`).toContain(table)
    }
    // Plus the runner's own ledger.
    expect(live).toContain('schema_migrations')
  })

  it('records the applied migration with a checksum', async () => {
    const rows = await query<{ filename: string; sha256: string }>(
      'SELECT filename, sha256 FROM schema_migrations',
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]!.filename).toBe('001_p0_init.sql')
    expect(rows[0]!.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('M0-T06A lifecycle gaps, recorded not fixed', () => {
  it('cannot store the event states the contract defines beyond publication', async () => {
    // API contract 05:905 freezes DRAFT -> PUBLISHED -> LIVE -> ENDED | CANCELLED
    // -> ARCHIVED. events.status is publication_status, which holds three.
    const values = await enumValues('publication_status')

    expect(values).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    for (const missing of ['LIVE', 'ENDED', 'CANCELLED']) {
      expect(values, `${missing} unexpectedly storable`).not.toContain(missing)
    }
  })

  it('cannot store the membership terminal states the contract transitions to', async () => {
    // API 05:810 permits active -> suspended / alumni / withdrawn.
    const values = await enumValues('record_state')

    expect(values).toEqual(['PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'CLOSED'])
    for (const missing of ['SUSPENDED', 'ALUMNI', 'WITHDRAWN']) {
      expect(values, `${missing} unexpectedly storable`).not.toContain(missing)
    }
  })

  it('names the deactivated profile state differently from the contract', async () => {
    // Data SOT 182 and API 05:337 / 05:1105 say DEACTIVATED; the schema says INACTIVE.
    const values = await enumValues('profile_status')

    expect(values).toEqual(['DRAFT', 'ACTIVE', 'INACTIVE'])
    expect(values).not.toContain('DEACTIVATED')
  })

  it('has no table for event registration', async () => {
    // Data SOT 216 and API 05:923 require it; the migration ships none.
    const rows = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE '%registration%'`,
    )

    expect(rows).toHaveLength(0)
  })

  it('has no store for idempotency keys, file assets, outbox or notifications', async () => {
    const live = (
      await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      )
    ).map((r) => r.table_name)

    for (const absent of ['idempotency_keys', 'file_assets', 'outbox_events']) {
      expect(live, `${absent} unexpectedly present`).not.toContain(absent)
    }
  })

  it('leaves role_code and scope_type untyped, so invalid codes are accepted', async () => {
    const rows = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_assignments'
         AND column_name IN ('role_code', 'scope_type')
       ORDER BY column_name`,
    )

    expect(rows.map((r) => r.data_type)).toEqual(['text', 'text'])

    // The seed exercises this: ORG_ADMIN and PLATFORM_OPS are in no role
    // catalogue, and the database accepts them silently.
    const seeded = await query<{ role_code: string }>(
      'SELECT DISTINCT role_code FROM role_assignments ORDER BY role_code',
    )
    expect(seeded.map((r) => r.role_code)).toEqual(['ORG_ADMIN', 'PLATFORM_OPS'])
  })
})

describe('M0-T06A seed fixture quality', () => {
  it('seeds the personas the QA fixtures depend on', async () => {
    const accounts = await query<{ email: string }>(
      'SELECT email FROM user_accounts ORDER BY email',
    )

    expect(accounts.map((a) => a.email)).toEqual([
      'leader@example.test',
      'member@example.test',
      'ops@example.test',
    ])
  })

  it('gives profiles fixed ids, as SEED_README promises', async () => {
    const rows = await query<{ id: string }>('SELECT id::text FROM individual_profiles ORDER BY id')

    expect(rows[0]!.id).toBe('40000000-0000-0000-0000-000000000001')
  })

  it('leaves eleven tables unseeded, so several P0 flows have no fixture', async () => {
    const empty: string[] = []
    const tables = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'
       ORDER BY table_name`,
    )

    for (const { table_name } of tables) {
      const [count] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table_name}"`)
      if (count!.n === 0) empty.push(table_name)
    }

    // Recorded, not asserted as acceptable: consent, bootstrap and sessions
    // being empty means WF01-S07, the D2 preseed path and any authenticated
    // visual scenario have no deterministic fixture.
    expect(empty).toEqual([
      'analytics_events',
      'audit_events',
      'auth_magic_link_requests',
      'consent_records',
      'feedback_submissions',
      'membership_bootstrap',
      'organization_relationships',
      'profile_education',
      'profile_experience',
      'profile_links',
      'user_sessions',
    ])
  })

  it('is not idempotent: two tables re-insert on a second run', async () => {
    const before = await query<{ n: number }>('SELECT count(*)::int AS n FROM leadership_records')
    const seed = readFileSync(join(process.cwd(), 'db', 'seed', 'seed_dev.sql'), 'utf8')

    // leadership_records and role_assignments carry no ON CONFLICT clause and
    // no unique constraint, unlike every other insert in the file.
    expect(seed).toMatch(/INSERT INTO leadership_records[\s\S]*?;/)
    const leadershipInsert = seed.match(/INSERT INTO leadership_records[\s\S]*?;/)![0]
    expect(leadershipInsert).not.toMatch(/ON CONFLICT/)

    expect(before[0]!.n).toBeGreaterThan(0)
  })
})
