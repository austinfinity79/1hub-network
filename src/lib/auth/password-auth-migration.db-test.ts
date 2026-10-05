import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, databaseUrl } from '@/lib/db/client'

/**
 * S1-UAT-01 — migration 018 (password auth) on scratch databases, as
 * admin-migration.db-test.ts proves 017 (task section 19):
 *
 *   FRESH     the runner on an empty database (001 → 018), then the seed.
 *   UPGRADE   the current production schema (001 – 017 in the ledger) holding
 *             accounts, sessions and magic-link rows, then the runner: 018
 *             only; every row kept, new columns empty / zero, sign-in state
 *             (sessions, magic links) untouched.
 *   RECOVERY  the documented rollback (refused while password data exists,
 *             lossless otherwise) and a re-apply.
 * The shared database is not touched.
 */

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
const RUNNER = join(ROOT, 'scripts', 'db.mjs')
const M018 = '018_p0_password_auth.sql'
const M018_SOURCE = readFileSync(join(MIGRATIONS_DIR, M018), 'utf8')
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const BEFORE_018 = MIGRATION_FILES.filter((name) => name < M018)
// S1-UAT-05: migrations after 018 unwind first, by their own documented rollback.
const LATER_ROLLBACKS = MIGRATION_FILES.filter((name) => name > M018)
  .reverse()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
const FRESH = 'hubnetwork_p0_s1a_fresh'
const UPGRADE = 'hubnetwork_p0_s1a_upgrade'
const RECOVERY = 'hubnetwork_p0_s1a_recovery'

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

async function applyBefore018(client: Client): Promise<void> {
  await client.query(LEDGER)
  for (const filename of BEFORE_018) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(filename, sha256) VALUES ($1, $2)', [
      filename,
      createHash('sha256').update(sql).digest('hex'),
    ])
  }
}

function documentedRollback018(source: string = M018_SOURCE): string {
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

async function tableExists(client: Client, table: string): Promise<boolean> {
  const { rows } = await client.query(`SELECT to_regclass($1) IS NOT NULL AS ok`, [
    `public.${table}`,
  ])
  return rows[0].ok
}

/** Every pre-018 column of the tables 018 touches or must not touch. */
async function snapshot(client: Client): Promise<string> {
  const { rows } = await client.query(`
    SELECT (SELECT json_agg(t ORDER BY id) FROM (SELECT id, email, email_normalized, status,
              created_at, updated_at, last_login_at FROM user_accounts) t)::text AS accounts,
           (SELECT json_agg(t ORDER BY id) FROM (SELECT * FROM user_sessions) t)::text AS sessions,
           (SELECT json_agg(t ORDER BY id) FROM (SELECT * FROM auth_magic_link_requests) t)::text AS links`)
  return JSON.stringify(rows[0])
}

afterAll(async () => {
  for (const db of [FRESH, UPGRADE, RECOVERY]) {
    await onAdmin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
  }
  await closePool()
})

describe('FRESH — 001 → 018 on an empty database', () => {
  beforeAll(() => recreate(FRESH), 60_000)

  it('applies every migration and the deterministic seed', async () => {
    const out = runner(FRESH, 'migrate')
    expect(out).toContain(`applied ${M018}`)
    runner(FRESH, 'seed')
    const db = await connect(FRESH)
    try {
      expect(await ledger(db)).toEqual(MIGRATION_FILES)
      expect(await tableExists(db, 'auth_identities')).toBe(true)
      expect(await tableExists(db, 'password_reset_requests')).toBe(true)
      // A second run is a no-op.
      expect(runner(FRESH, 'migrate')).not.toMatch(/^\s*applied /m)
    } finally {
      await db.end()
    }
  })
})

describe('UPGRADE — the production schema (001 – 017) with data, then 018', () => {
  let db: Client
  beforeAll(async () => {
    await recreate(UPGRADE)
    db = await connect(UPGRADE)
    await applyBefore018(db)
    await db.query(`
      INSERT INTO user_accounts (id, email, email_normalized, status) VALUES
        ('a0180000-0000-4000-8000-000000000001', 'Old@Example.test', 'old@example.test', 'ACTIVE'),
        ('a0180000-0000-4000-8000-000000000002', 'blocked@example.test', 'blocked@example.test', 'BLOCKED');
      INSERT INTO user_sessions (account_id, token_hash, expires_at)
        VALUES ('a0180000-0000-4000-8000-000000000001', 'h1', now() + interval '1 day');
      INSERT INTO auth_magic_link_requests (email_normalized, token_hash, expires_at)
        VALUES ('old@example.test', 'm1', now() + interval '15 minutes');`)
  }, 60_000)
  afterAll(async () => {
    await db?.end()
  })

  it('applies 018 only, keeps every row and sign-in state, new columns empty', async () => {
    const before = await snapshot(db)
    const out = runner(UPGRADE, 'migrate')
    // 018 and whatever follows it; nothing before it again.
    expect(out.match(/applied /g)).toHaveLength(MIGRATION_FILES.length - BEFORE_018.length)
    expect(out).toContain(`applied ${M018}`)
    expect(await snapshot(db)).toEqual(before)
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM user_accounts
        WHERE username IS NULL AND password_hash IS NULL AND failed_password_attempts = 0
          AND password_locked_until IS NULL AND signup_full_name IS NULL`,
    )
    expect(rows[0].n).toBe(2)
  })

  it('enforces case-insensitive username uniqueness while allowing many NULLs', async () => {
    await db.query(`UPDATE user_accounts SET username = 'Chi', username_normalized = 'chi'
                     WHERE email_normalized = 'old@example.test'`)
    await expect(
      db.query(`UPDATE user_accounts SET username = 'CHI', username_normalized = 'chi'
                 WHERE email_normalized = 'blocked@example.test'`),
    ).rejects.toThrow(/uq_user_accounts_username_normalized/)
  })

  it('one Google identity per account and per subject', async () => {
    const insert = (account: string, sub: string) =>
      db.query(
        `INSERT INTO auth_identities (account_id, provider, provider_subject, email_at_link)
         VALUES ($1, 'GOOGLE', $2, 'x@example.test')`,
        [account, sub],
      )
    await insert('a0180000-0000-4000-8000-000000000001', 'sub-1')
    await expect(insert('a0180000-0000-4000-8000-000000000001', 'sub-2')).rejects.toThrow(
      /uq_auth_identities_account_prov/,
    )
    await expect(insert('a0180000-0000-4000-8000-000000000002', 'sub-1')).rejects.toThrow(
      /uq_auth_identities_provider_sub/,
    )
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

  it('refuses while password data exists, changing nothing', async () => {
    await db.query(
      `UPDATE user_accounts SET password_hash = 'scrypt:x' WHERE email = 'member@example.test'`,
    )
    await expect(db.query(documentedRollback018())).rejects.toThrow(
      '018 rollback refused: password auth data exists',
    )
    await db.query('ROLLBACK')
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
    await db.query(`UPDATE user_accounts SET password_hash = NULL`)
  })

  it('rolls back losslessly to the 017 schema and re-applies', async () => {
    const before = await snapshot(db)
    for (const later of LATER_ROLLBACKS) await db.query(documentedRollback018(later))
    await db.query(documentedRollback018())
    expect(await ledger(db)).toEqual(BEFORE_018)
    expect(await tableExists(db, 'auth_identities')).toBe(false)
    expect(await tableExists(db, 'password_reset_requests')).toBe(false)
    const { rows } = await db.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'user_accounts' AND column_name IN
          ('username', 'username_normalized', 'password_hash', 'failed_password_attempts',
           'password_locked_until', 'signup_full_name')`,
    )
    expect(rows).toHaveLength(0)
    expect(await snapshot(db)).toEqual(before)

    expect(runner(RECOVERY, 'migrate')).toContain(`applied ${M018}`)
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
    expect(await snapshot(db)).toEqual(before)
  })
})
