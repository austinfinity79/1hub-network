import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, databaseUrl } from '@/lib/db/client'

/**
 * ADMIN-PROD-02 — migration 017 (Admin foundation) on scratch databases.
 *
 *   FRESH     the runner on an empty database (001 → 017), then the seed.
 *   UPGRADE   the current production schema (001 – 016 in the ledger) holding
 *             data 017 touches — typed-less feedback in every old status, a
 *             deletion request, role assignments, ventures — then the runner:
 *             017 only, every row kept, statuses renamed in place.
 *   RECOVERY  the STOP check, the documented rollback (refused while admin data
 *             exists, lossless otherwise) and a re-apply.
 * The shared database is not touched.
 */

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
const RUNNER = join(ROOT, 'scripts', 'db.mjs')
const M016 = '016_p0_application_integrity.sql'
const M017 = '017_p0_admin_foundation.sql'
const M017_SOURCE = readFileSync(join(MIGRATIONS_DIR, M017), 'utf8')
// S1-UAT-01: migrations after 017 unwind first, by their own documented rollback.
const LATER_ROLLBACKS = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql') && name > M017)
  .sort()
  .reverse()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const BEFORE_017 = MIGRATION_FILES.filter((name) => name < M017)
const FRESH = 'hubnetwork_p0_adm02_fresh'
const UPGRADE = 'hubnetwork_p0_adm02_upgrade'
const RECOVERY = 'hubnetwork_p0_adm02_recovery'

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const MEMBER_ACCOUNT = '30000000-0000-0000-0000-000000000001'
const MEMBER_PROFILE = '40000000-0000-0000-0000-000000000001'
const FB = (n: number) => `f0170000-0000-4000-8000-00000000000${n}`

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    text PRIMARY KEY,
    sha256      text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`

function urlFor(database: string): string {
  const url = new URL(databaseUrl())
  url.pathname = `/${database}`
  return url.toString()
}

async function connect(database: string): Promise<Client> {
  const client = new Client({ connectionString: urlFor(database) })
  await client.connect()
  return client
}

async function onAdmin(sql: string): Promise<void> {
  const admin = new Client({ connectionString: databaseUrl() })
  await admin.connect()
  try {
    await admin.query(sql)
  } finally {
    await admin.end()
  }
}

async function recreate(database: string): Promise<void> {
  await onAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
  await onAdmin(`CREATE DATABASE ${database}`)
}

function runner(database: string, command: 'migrate' | 'seed'): string {
  return execFileSync('node', [RUNNER, command], {
    env: { ...process.env, DATABASE_URL: urlFor(database) },
    encoding: 'utf8',
    stdio: 'pipe',
  })
}

function runnerFailure(database: string): string {
  try {
    runner(database, 'migrate')
  } catch (error) {
    return String((error as { stderr?: string }).stderr ?? error)
  }
  throw new Error('migrate succeeded where it had to stop')
}

/** Applies every migration before 017 exactly as the runner does, ledger included. */
async function applyBefore017(client: Client): Promise<void> {
  await client.query(LEDGER)
  for (const filename of BEFORE_017) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(filename, sha256) VALUES ($1, $2)', [
      filename,
      createHash('sha256').update(sql).digest('hex'),
    ])
  }
}

function documentedRollback(source: string = M017_SOURCE): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => line.startsWith('-- ROLLBACK'))
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('--')) break
    if (line.startsWith('--   ')) body.push(line.slice(5))
  }
  return body.join('\n')
}

/** Every pre-017 column of the tables 017 alters, as an order-independent digest. */
const SNAPSHOT: Record<string, string> = {
  feedback_submissions: `SELECT id, account_id, profile_id, body, created_at, reviewed_at FROM feedback_submissions`,
  account_deletion_requests: `SELECT id, account_id, requested_at FROM account_deletion_requests`,
  role_assignments: `SELECT id, account_id, role_code, scope_type, scope_id, state, created_at, valid_to,
                            individual_profile_id, valid_from, assigned_by FROM role_assignments`,
  projects: `SELECT id, type, owner_profile_id, slug, name, summary, status, metadata, created_at,
                    updated_at, region_id, stage_id, owner_role_label, visibility FROM projects`,
}

async function snapshot(client: Client): Promise<Record<string, { n: number; h: string }>> {
  const out: Record<string, { n: number; h: string }> = {}
  for (const [table, sql] of Object.entries(SNAPSHOT)) {
    const { rows } = await client.query<{ n: number; h: string }>(
      `SELECT count(*)::int AS n,
              md5(coalesce(string_agg(to_jsonb(x)::text, '|' ORDER BY to_jsonb(x)::text), '')) AS h
         FROM (${sql}) x`,
    )
    out[table] = rows[0]!
  }
  return out
}

async function ledger(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename',
  )
  return rows.map((r) => r.filename)
}

async function tableExists(client: Client, table: string): Promise<boolean> {
  const { rows } = await client.query<{ t: string | null }>(`SELECT to_regclass($1)::text AS t`, [
    `public.${table}`,
  ])
  return rows[0]!.t !== null
}

async function labels(client: Client, type: string): Promise<string[]> {
  const { rows } = await client.query<{ label: string }>(
    `SELECT e.enumlabel AS label FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = $1 ORDER BY e.enumsortorder`,
    [type],
  )
  return rows.map((r) => r.label)
}

/** Data the 016 schema can hold and 017 must keep: feedback in all three old statuses. */
async function legacyRows(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO feedback_submissions (id, account_id, profile_id, body, status, reviewed_at)
     VALUES ($1, $4, $5, 'Góp ý mới', 'NEW', NULL),
            ($2, $4, $5, 'Đã xem', 'REVIEWED', '2026-09-30T03:00:00Z'),
            ($3, $4, NULL, 'Đã đóng', 'CLOSED', '2026-09-30T04:00:00Z')`,
    [FB(1), FB(2), FB(3), MEMBER_ACCOUNT, MEMBER_PROFILE],
  )
  await client.query(`INSERT INTO account_deletion_requests (account_id) VALUES ($1)`, [
    MEMBER_ACCOUNT,
  ])
}

afterAll(async () => {
  for (const database of [FRESH, UPGRADE, RECOVERY]) {
    await onAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
  }
  await closePool()
}, 60_000)

describe('FRESH — 001 → 017 on an empty database, then the seed', () => {
  let db: Client

  beforeAll(async () => {
    await recreate(FRESH)
    runner(FRESH, 'migrate')
    runner(FRESH, 'seed')
    db = await connect(FRESH)
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  it('applies every migration in order, 017 with its checksum', async () => {
    const { rows } = await db.query<{ filename: string; sha256: string }>(
      'SELECT filename, sha256 FROM schema_migrations ORDER BY filename',
    )
    expect(rows.map((r) => r.filename)).toEqual(MIGRATION_FILES)
    expect(rows.find((r) => r.filename === M017)!.sha256).toBe(
      createHash('sha256').update(M017_SOURCE).digest('hex'),
    )
  })

  it('adds exactly the four admin tables and the frozen enums', async () => {
    for (const table of [
      'role_verification_requests',
      'venture_reviews',
      'account_action_requests',
      'notifications',
    ])
      expect(await tableExists(db, table), table).toBe(true)
    for (const table of ['admin_users', 'review_queue', 'capability_grants', 'admin_organizations'])
      expect(await tableExists(db, table), table).toBe(false)
    expect(await labels(db, 'verification_request_status')).toEqual([
      'PENDING',
      'APPROVED',
      'REJECTED',
      'WITHDRAWN',
    ])
    expect(await labels(db, 'feedback_status')).toEqual(['NEW', 'IN_REVIEW', 'DONE'])
    expect(await labels(db, 'feedback_type')).toEqual(['BUG', 'UX', 'FEATURE', 'OTHER'])
    expect(await labels(db, 'account_action')).toEqual(['LOCK', 'DEACTIVATE', 'SOFT_DELETE'])
    expect(await labels(db, 'venture_review_status')).toEqual([
      'PENDING',
      'APPROVED',
      'REJECTED',
      'WITHDRAWN',
    ])
  })

  it('leaves the seeded authority unchanged: no capability-only grant exists', async () => {
    const { rows } = await db.query<{ n: number; c: number }>(
      `SELECT count(*)::int AS n, count(capability)::int AS c FROM role_assignments`,
    )
    expect(rows[0]!.n).toBeGreaterThan(0)
    expect(rows[0]!.c).toBe(0)
  })
})

describe('UPGRADE — production schema with data, then 017 only', () => {
  let db: Client
  let before: Record<string, { n: number; h: string }>
  let output = ''

  beforeAll(async () => {
    await recreate(UPGRADE)
    db = await connect(UPGRADE)
    await applyBefore017(db)
    runner(UPGRADE, 'seed')
    await legacyRows(db)
    await db.query(
      `INSERT INTO projects (type, owner_profile_id, slug, name, status, visibility)
       VALUES ('STARTUP', $1, 'adm02-upgrade-startup', 'Upgrade Startup', 'ACTIVE', 'PUBLIC')`,
      [MEMBER_PROFILE],
    )
    before = await snapshot(db)
    output = runner(UPGRADE, 'migrate')
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  it('applies 017 alone and records it', async () => {
    expect(output).toContain(`applied ${M017}`)
    expect(output.match(/applied /g)).toHaveLength(MIGRATION_FILES.length - BEFORE_017.length)
    expect(output).toContain(`skip    ${M016} (already applied)`)
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
  })

  it('keeps every existing row and value', async () => {
    expect(await snapshot(db)).toEqual(before)
  })

  it('renames the feedback statuses in place and types old rows OTHER', async () => {
    const { rows } = await db.query<{
      id: string
      status: string
      type: string
      account: string | null
    }>(
      `SELECT id::text, status::text AS status, type::text AS type, account_id::text AS account
         FROM feedback_submissions ORDER BY id`,
    )
    expect(rows).toEqual([
      { id: FB(1), status: 'NEW', type: 'OTHER', account: MEMBER_ACCOUNT },
      { id: FB(2), status: 'IN_REVIEW', type: 'OTHER', account: MEMBER_ACCOUNT },
      { id: FB(3), status: 'DONE', type: 'OTHER', account: MEMBER_ACCOUNT },
    ])
  })

  it('opens existing deletion requests as PENDING and adds no venture value', async () => {
    const { rows } = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM account_deletion_requests`,
    )
    expect(rows).toEqual([{ status: 'PENDING' }])
    const { rows: ventures } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM projects WHERE website IS NOT NULL OR logo_asset_id IS NOT NULL`,
    )
    expect(ventures[0]!.n).toBe(0)
  })

  it('keeps the previous release’s reads working on the new schema', async () => {
    // The 78f21f2 actor query, verbatim, still runs and sees the same grants.
    const { rows } = await db.query(
      `SELECT role_code, scope_type, scope_id::text FROM role_assignments
        WHERE individual_profile_id = $1 AND state = 'ACTIVE' AND valid_from <= now()
          AND (valid_to IS NULL OR valid_to > now())`,
      [MEMBER_PROFILE],
    )
    expect(rows.length).toBeGreaterThan(0)
  })
})

describe('RECOVERY — the STOP check, the documented rollback and a re-apply', () => {
  let db: Client

  beforeAll(async () => {
    await recreate(RECOVERY)
    db = await connect(RECOVERY)
    await applyBefore017(db)
    runner(RECOVERY, 'seed')
    await legacyRows(db)
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  it('STOPS on feedback text outside 1 … 2000 characters and changes nothing', async () => {
    await db.query(`UPDATE feedback_submissions SET body = $2 WHERE id = $1`, [
      FB(2),
      'x'.repeat(2001),
    ])
    const before = await snapshot(db)
    expect(runnerFailure(RECOVERY)).toContain(
      `017 stopped: feedback text outside 1 … 2000 characters: ${FB(2)}`,
    )
    expect(await ledger(db)).toEqual(BEFORE_017)
    expect(await tableExists(db, 'role_verification_requests')).toBe(false)
    expect(await snapshot(db)).toEqual(before)
    await db.query(`UPDATE feedback_submissions SET body = 'Đã xem' WHERE id = $1`, [FB(2)])
  })

  it('applies once clean; the rollback refuses while admin data exists', async () => {
    runner(RECOVERY, 'migrate')
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
    await db.query(
      `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, capability)
       VALUES ($1, 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', $2, 'member:read')`,
      [MEMBER_PROFILE, CHAPTER_01],
    )
    await expect(db.query(documentedRollback())).rejects.toThrow(
      '017 rollback refused: admin data exists',
    )
    await db.query('ROLLBACK')
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
    await db.query(`DELETE FROM role_assignments WHERE capability IS NOT NULL`)
  })

  it('rolls back losslessly to the 016 schema and re-applies', async () => {
    const before = await snapshot(db)
    for (const later of LATER_ROLLBACKS) await db.query(documentedRollback(later))
    await db.query(documentedRollback())
    expect(await ledger(db)).toEqual(BEFORE_017)
    for (const table of [
      'role_verification_requests',
      'venture_reviews',
      'account_action_requests',
      'notifications',
    ])
      expect(await tableExists(db, table), table).toBe(false)
    expect(await labels(db, 'feedback_status')).toEqual(['NEW', 'REVIEWED', 'CLOSED'])
    const { rows } = await db.query<{ status: string }>(
      `SELECT status::text AS status FROM feedback_submissions ORDER BY id`,
    )
    expect(rows.map((r) => r.status)).toEqual(['NEW', 'REVIEWED', 'CLOSED'])
    expect(await snapshot(db)).toEqual(before)

    expect(runner(RECOVERY, 'migrate')).toContain(`applied ${M017}`)
    expect(await snapshot(db)).toEqual(before)
    expect(await labels(db, 'feedback_status')).toEqual(['NEW', 'IN_REVIEW', 'DONE'])
  })
})
