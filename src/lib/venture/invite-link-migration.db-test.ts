import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, databaseUrl } from '@/lib/db/client'

/**
 * S1-UAT-07 — migration 020 (e-mail invitation expiry, team invite links) on
 * scratch databases derived from the isolated test database:
 *
 *   FRESH     001 → 020 and the seed; a second run and a manual re-apply are no-ops.
 *   UPGRADE   up to 019 holding a venture, an active member and pending
 *             invitations, then the runner: 020 only; rows kept, every pending
 *             invitation valid for 7 days from the upgrade, others NULL.
 *   RECOVERY  the documented rollback (refused while an invite link exists,
 *             lossless otherwise) and a re-apply.
 */

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
const RUNNER = join(ROOT, 'scripts', 'db.mjs')
const M020 = '020_p0_team_invite_links.sql'
const M020_SOURCE = readFileSync(join(MIGRATIONS_DIR, M020), 'utf8')
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const BEFORE_020 = MIGRATION_FILES.filter((name) => name < M020)
const LATER_ROLLBACKS = MIGRATION_FILES.filter((name) => name > M020)
  .reverse()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
const FRESH = 'hubnetwork_p0_s1i_fresh'
const UPGRADE = 'hubnetwork_p0_s1i_upgrade'
const RECOVERY = 'hubnetwork_p0_s1i_recovery'

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

async function applyBefore020(client: Client): Promise<void> {
  await client.query(LEDGER)
  for (const filename of BEFORE_020) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(filename, sha256) VALUES ($1, $2)', [
      filename,
      createHash('sha256').update(sql).digest('hex'),
    ])
  }
}

function documentedRollback(source: string = M020_SOURCE): string {
  const lines = source.split('\n')
  const start = lines.findIndex((line) => line.startsWith('-- ROLLBACK'))
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('--')) break
    if (line.startsWith('--   ')) body.push(line.slice(5))
  }
  return body.join('\n')
}

async function ledger(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations ORDER BY filename',
  )
  return rows.map((r) => r.filename)
}

async function shape(client: Client) {
  const { rows } = await client.query(`
    SELECT to_regclass('public.venture_invite_links') IS NOT NULL AS links,
           EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'project_members' AND column_name = 'invite_expires_at')
             AS expiry`)
  return rows[0] as { links: boolean; expiry: boolean }
}

/** Every pre-020 column of project_members. */
async function snapshot(client: Client): Promise<string> {
  const { rows } = await client.query(`
    SELECT json_agg(t ORDER BY id)::text AS members FROM (
      SELECT id, project_id, profile_id, role_label, permission, state::text AS state, joined_at,
             ended_at, invite_email_normalized, invited_by_profile_id, invited_at
        FROM project_members) t`)
  return JSON.stringify(rows[0])
}

afterAll(async () => {
  for (const db of [FRESH, UPGRADE, RECOVERY]) {
    await onAdmin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
  }
  await closePool()
})

describe('FRESH — 001 → 020 on an empty database', () => {
  beforeAll(() => recreate(FRESH), 60_000)

  it('applies every migration and the seed; a second run and a manual re-apply are no-ops', async () => {
    expect(runner(FRESH, 'migrate')).toContain(`applied ${M020}`)
    runner(FRESH, 'seed')
    const db = await connect(FRESH)
    try {
      expect(await ledger(db)).toEqual(MIGRATION_FILES)
      expect(await shape(db)).toEqual({ links: true, expiry: true })
      expect(runner(FRESH, 'migrate')).not.toMatch(/^\s*applied /m)
      await db.query(M020_SOURCE)
      expect(await shape(db)).toEqual({ links: true, expiry: true })
    } finally {
      await db.end()
    }
  })
})

describe('UPGRADE — the schema up to 019 with team data, then 020', () => {
  let db: Client
  beforeAll(async () => {
    await recreate(UPGRADE)
    db = await connect(UPGRADE)
    await applyBefore020(db)
    await db.query(`
      INSERT INTO user_accounts (id, email, email_normalized, status) VALUES
        ('a0200000-0000-4000-8000-000000000001', 'o@example.test', 'o@example.test', 'ACTIVE'),
        ('a0200000-0000-4000-8000-000000000002', 'm@example.test', 'm@example.test', 'ACTIVE');
      INSERT INTO individual_profiles (id, account_id, display_name) VALUES
        ('a0200000-0000-4000-8000-0000000000a1', 'a0200000-0000-4000-8000-000000000001', 'O'),
        ('a0200000-0000-4000-8000-0000000000a2', 'a0200000-0000-4000-8000-000000000002', 'M');
      INSERT INTO projects (id, owner_profile_id, type, slug, name) VALUES
        ('a0200000-0000-4000-8000-0000000000b1', 'a0200000-0000-4000-8000-0000000000a1', 'STARTUP',
         'team-020', 'Team');
      INSERT INTO project_members (project_id, profile_id, role_label, permission, state, joined_at) VALUES
        ('a0200000-0000-4000-8000-0000000000b1', 'a0200000-0000-4000-8000-0000000000a2', 'Dev', 'EDIT', 'ACTIVE', now());
      INSERT INTO project_members (project_id, role_label, permission, state, joined_at,
                                   invite_email_normalized, invited_by_profile_id, invited_at) VALUES
        ('a0200000-0000-4000-8000-0000000000b1', 'CTO', 'VIEW', 'PENDING_CONFIRMATION', NULL,
         'p1@example.test', 'a0200000-0000-4000-8000-0000000000a1', now() - interval '30 days'),
        ('a0200000-0000-4000-8000-0000000000b1', NULL, 'EDIT', 'PENDING_CONFIRMATION', NULL,
         'p2@example.test', 'a0200000-0000-4000-8000-0000000000a1', now());`)
  }, 60_000)
  afterAll(async () => {
    await db?.end()
  })

  it('applies 020 only, keeps every row; every pending invitation valid 7 days from now', async () => {
    const before = await snapshot(db)
    const out = runner(UPGRADE, 'migrate')
    expect(out.match(/applied /g)).toHaveLength(MIGRATION_FILES.length - BEFORE_020.length)
    expect(out).toContain(`applied ${M020}`)
    expect(await snapshot(db)).toEqual(before)
    const { rows } = await db.query<{ state: string; days: number | null }>(
      `SELECT state::text AS state,
              extract(epoch FROM invite_expires_at - now()) / 86400 AS days
         FROM project_members ORDER BY state, invite_email_normalized`,
    )
    expect(rows.map((r) => r.state)).toEqual(
      ['PENDING_CONFIRMATION', 'PENDING_CONFIRMATION', 'ACTIVE'].sort(),
    )
    for (const row of rows) {
      if (row.state === 'PENDING_CONFIRMATION') {
        expect(Number(row.days)).toBeGreaterThan(6.99)
        expect(Number(row.days)).toBeLessThan(7.001)
      } else expect(row.days).toBeNull()
    }
    // A pending row without an expiry is refused from now on.
    await expect(
      db.query(
        `INSERT INTO project_members (project_id, permission, state, joined_at,
                                      invite_email_normalized, invited_by_profile_id, invited_at)
         VALUES ('a0200000-0000-4000-8000-0000000000b1', 'VIEW', 'PENDING_CONFIRMATION', NULL,
                 'p3@example.test', 'a0200000-0000-4000-8000-0000000000a1', now())`,
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'ck_pm_invite_expiry' })
  })

  it('one unrevoked link per venture; the hash is unique and well-formed', async () => {
    const insert = (hash: string, revoked: boolean) =>
      db.query(
        `INSERT INTO venture_invite_links (project_id, token_hash, created_by_profile_id, expires_at, revoked_at)
         VALUES ('a0200000-0000-4000-8000-0000000000b1', $1, 'a0200000-0000-4000-8000-0000000000a1',
                 now() + interval '7 days', CASE WHEN $2 THEN now() END)`,
        [hash, revoked],
      )
    await insert('a'.repeat(64), true)
    await insert('b'.repeat(64), false)
    await expect(insert('c'.repeat(64), false)).rejects.toMatchObject({
      constraint: 'uq_venture_invite_link_open',
    })
    await expect(insert('a'.repeat(64), true)).rejects.toMatchObject({
      constraint: 'uq_venture_invite_link_hash',
    })
    await expect(insert('raw-token', true)).rejects.toMatchObject({
      constraint: 'ck_invite_link_hash',
    })
    await db.query('DELETE FROM venture_invite_links')
  })
})

describe('RECOVERY — the documented rollback and a re-apply', () => {
  let db: Client
  beforeAll(async () => {
    await recreate(RECOVERY)
    runner(RECOVERY, 'migrate')
    runner(RECOVERY, 'seed')
    db = await connect(RECOVERY)
  }, 60_000)
  afterAll(async () => {
    await db?.end()
  })

  it('refuses while an invite link exists, changing nothing', async () => {
    const { project, owner } = (
      await db.query<{ project: string; owner: string }>(
        'SELECT id::text AS project, owner_profile_id::text AS owner FROM projects LIMIT 1',
      )
    ).rows[0]!
    await db.query(
      `INSERT INTO venture_invite_links (project_id, token_hash, created_by_profile_id, expires_at)
       VALUES ($1, $2, $3, now() + interval '7 days')`,
      [project, 'd'.repeat(64), owner],
    )
    await expect(db.query(documentedRollback())).rejects.toThrow('020 rollback refused')
    await db.query('ROLLBACK')
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
    await db.query('DELETE FROM venture_invite_links')
  })

  it('rolls back to the 019 schema with every pre-020 value, then re-applies', async () => {
    const before = await snapshot(db)
    for (const later of LATER_ROLLBACKS) await db.query(documentedRollback(later))
    await db.query(documentedRollback())
    expect(await ledger(db)).toEqual(BEFORE_020)
    expect(await shape(db)).toEqual({ links: false, expiry: false })
    expect(await snapshot(db)).toEqual(before)
    expect(runner(RECOVERY, 'migrate')).toContain(`applied ${M020}`)
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
    expect(await shape(db)).toEqual({ links: true, expiry: true })
    expect(await snapshot(db)).toEqual(before)
  })
})
