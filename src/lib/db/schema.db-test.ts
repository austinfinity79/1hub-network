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

describe('M0-T06B RoleAssignment alignment', () => {
  it('anchors on individual_profile_id, not the account', async () => {
    const cols = await query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_assignments'`,
    )
    const byName = Object.fromEntries(cols.map((c) => [c.column_name, c.is_nullable]))

    // Data SOT :297 and 03_AUTH_RBAC:53 both require this anchor.
    expect(byName['individual_profile_id']).toBe('NO')
    // account_id survives only so the frozen seed still applies; it is demoted.
    expect(byName['account_id']).toBe('YES')
  })

  it('carries the validity columns the authorization rule needs', async () => {
    const cols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_assignments'`,
    )
    const names = cols.map((c) => c.column_name)

    for (const required of ['valid_from', 'valid_to', 'assigned_by']) {
      expect(names, `${required} missing`).toContain(required)
    }
    // ended_at was renamed to valid_to rather than duplicated.
    expect(names).not.toContain('ended_at')
  })

  it('resolves the anchor for every seeded assignment', async () => {
    const rows = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM role_assignments WHERE individual_profile_id IS NULL',
    )

    expect(rows[0]!.n).toBe(0)
  })

  it('indexes the scope the authorization check actually filters on', async () => {
    const rows = await query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'role_assignments' AND indexname = 'idx_role_profile_scope'`,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]!.indexdef).toContain('scope_type')
    expect(rows[0]!.indexdef).toContain('scope_id')
  })
})

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

  it('records both applied migrations with checksums', async () => {
    const rows = await query<{ filename: string; sha256: string }>(
      'SELECT filename, sha256 FROM schema_migrations ORDER BY filename',
    )

    expect(rows.map((r) => r.filename)).toEqual([
      '001_p0_init.sql',
      '002_p0_schema_alignment.sql',
    ])
    for (const row of rows) {
      expect(row.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe('M0-T06B lifecycle gaps CLOSED by migration 002', () => {
  // These expectations are the inverse of the ones M0-T06A recorded. The flip
  // is the proof the gap closed, exactly as that report said it would be.

  it('stores the full event lifecycle the SOT defines', async () => {
    // Data SOT :213 DRAFT -> PUBLISHED -> LIVE -> ENDED | CANCELLED -> ARCHIVED.
    const values = await enumValues('event_status')

    expect(values).toEqual(['DRAFT', 'PUBLISHED', 'LIVE', 'ENDED', 'CANCELLED', 'ARCHIVED'])
  })

  it('stores the membership terminal states the SOT transitions to', async () => {
    // Data SOT :190 PENDING_APPROVAL -> ACTIVE | REJECTED | WITHDRAWN -> SUSPENDED / ALUMNI.
    const values = await enumValues('membership_state')

    expect(values).toEqual([
      'PENDING_APPROVAL',
      'ACTIVE',
      'REJECTED',
      'WITHDRAWN',
      'SUSPENDED',
      'ALUMNI',
    ])
  })

  it('stores the leadership states the SOT defines', async () => {
    // Data SOT :193 ACTIVE -> ALUMNI | REVOKED.
    expect(await enumValues('leadership_state')).toEqual(['ACTIVE', 'ALUMNI', 'REVOKED'])
  })

  it('names the deactivated profile state as the SOT does', async () => {
    // Data SOT :182 and API 05:337 say DEACTIVATED. 002 renamed INACTIVE.
    const values = await enumValues('profile_status')

    expect(values).toEqual(['DRAFT', 'ACTIVE', 'DEACTIVATED'])
    expect(values).not.toContain('INACTIVE')
  })

  it('leaves the shared enums unpolluted', async () => {
    // Adding LIVE to publication_status would let an Organization be LIVE, and
    // ALUMNI in record_state would let a project member be ALUMNI. Per-entity
    // domains exist precisely so the shared ones stay correct.
    expect(await enumValues('publication_status')).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    expect(await enumValues('record_state')).toEqual([
      'PENDING_APPROVAL',
      'ACTIVE',
      'REJECTED',
      'CLOSED',
    ])
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

  it('still leaves role_code and scope_type untyped at the column level', async () => {
    const rows = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_assignments'
         AND column_name IN ('role_code', 'scope_type')
       ORDER BY column_name`,
    )

    // Unchanged by 002 and 007: constraining these needs a catalogue decision.
    expect(rows.map((r) => r.data_type)).toEqual(['text', 'text'])

    // The column is still permissive, but M0-T07 removed the invented codes, so
    // nothing invalid is actually stored any more. Detailed role assertions live
    // in seed.db-test.ts.
    const seeded = await query<{ role_code: string }>(
      'SELECT DISTINCT role_code FROM role_assignments ORDER BY role_code',
    )
    expect(seeded.map((r) => r.role_code)).not.toContain('ORG_ADMIN')
    expect(seeded.map((r) => r.role_code)).not.toContain('PLATFORM_OPS')
  })
})

describe('M0-T07 seed fixture quality', () => {
  it('seeds the personas the QA fixtures depend on', async () => {
    const accounts = await query<{ email: string }>(
      'SELECT email FROM user_accounts ORDER BY email',
    )

    // M0-T07 added newcomer (DRAFT, pre-onboarding) and pending
    // (PENDING_APPROVAL membership); the old seed had neither scenario.
    expect(accounts.map((a) => a.email)).toEqual([
      'leader@example.test',
      'member@example.test',
      'newcomer@example.test',
      'ops@example.test',
      'pending@example.test',
    ])
  })

  it('gives profiles fixed ids, as SEED_README promises', async () => {
    const rows = await query<{ id: string }>('SELECT id::text FROM individual_profiles ORDER BY id')

    expect(rows[0]!.id).toBe('40000000-0000-0000-0000-000000000001')
  })

  it('leaves only intentionally-empty tables unseeded', async () => {
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

    // Down from eleven. Every remaining one is INTENTIONALLY_EMPTY_IN_M0:
    // analytics and audit are written at runtime, magic-link requests and
    // sessions belong to M0-T08 auth, feedback has no frozen pixel screen
    // (API:671), and education/links are not profile-completion groups.
    expect(empty).toEqual([
      'analytics_events',
      'audit_events',
      'auth_magic_link_requests',
      'feedback_submissions',
      'profile_education',
      'profile_links',
      'user_sessions',
    ])
  })

  it('keeps the retired seed on disk as evidence of why it was replaced', async () => {
    const before = await query<{ n: number }>('SELECT count(*)::int AS n FROM leadership_records')
    // seed_dev.sql is no longer applied. It stays byte-identical so the defects
    // that retired it remain inspectable.
    const seed = readFileSync(join(process.cwd(), 'db', 'seed', 'seed_dev.sql'), 'utf8')

    // leadership_records and role_assignments carry no ON CONFLICT clause and
    // no unique constraint, unlike every other insert in the file.
    expect(seed).toMatch(/INSERT INTO leadership_records[\s\S]*?;/)
    const leadershipInsert = seed.match(/INSERT INTO leadership_records[\s\S]*?;/)![0]
    expect(leadershipInsert).not.toMatch(/ON CONFLICT/)

    expect(before[0]!.n).toBeGreaterThan(0)
  })
})
