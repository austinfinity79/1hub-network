import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, databaseUrl } from '@/lib/db/client'

/**
 * S1-UAT-05 — migration 019 (unnormalised tags, experience type and place) on
 * scratch databases derived from the isolated test database, as
 * password-auth-migration.db-test.ts proves 018:
 *
 *   FRESH     the runner on an empty database (001 → 019), then the seed; a
 *             second run applies nothing.
 *   UPGRADE   the schema up to 018 holding vocabulary, profiles and experience
 *             rows, then the runner: 019 only; every row kept, new columns NULL,
 *             no item becomes UNNORMALIZED.
 *   RECOVERY  the documented rollback (refused while data uses 019, lossless
 *             otherwise) and a re-apply.
 */

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
const RUNNER = join(ROOT, 'scripts', 'db.mjs')
const M019 = '019_p0_profile_sprint1.sql'
const M019_SOURCE = readFileSync(join(MIGRATIONS_DIR, M019), 'utf8')
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const BEFORE_019 = MIGRATION_FILES.filter((name) => name < M019)
const LATER_ROLLBACKS = MIGRATION_FILES.filter((name) => name > M019)
  .reverse()
  .map((name) => readFileSync(join(MIGRATIONS_DIR, name), 'utf8'))
const FRESH = 'hubnetwork_p0_s1p_fresh'
const UPGRADE = 'hubnetwork_p0_s1p_upgrade'
const RECOVERY = 'hubnetwork_p0_s1p_recovery'

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

async function applyBefore019(client: Client): Promise<void> {
  await client.query(LEDGER)
  for (const filename of BEFORE_019) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(filename, sha256) VALUES ($1, $2)', [
      filename,
      createHash('sha256').update(sql).digest('hex'),
    ])
  }
}

function documentedRollback(source: string = M019_SOURCE): string {
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
    SELECT (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)
              FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
             WHERE t.typname = 'vocab_status') AS statuses,
           (SELECT array_agg(column_name::text ORDER BY column_name)
              FROM information_schema.columns
             WHERE table_name = 'profile_experience'
               AND column_name IN ('employment_type', 'location')) AS columns,
           (SELECT column_default FROM information_schema.columns
             WHERE table_name = 'vocabulary_items' AND column_name = 'status') AS status_default`)
  return rows[0] as { statuses: string[]; columns: string[] | null; status_default: string }
}

/** Every pre-019 column of the tables 019 touches. */
async function snapshot(client: Client): Promise<string> {
  const { rows } = await client.query(`
    SELECT (SELECT json_agg(t ORDER BY id) FROM (SELECT id, type_code, slug, label, sort_order,
              status::text AS status, metadata FROM vocabulary_items) t)::text AS vocabulary,
           (SELECT json_agg(t ORDER BY id) FROM (SELECT id, profile_id, title, organization_name,
              started_on, ended_on, description, sort_order FROM profile_experience) t)::text AS experience,
           (SELECT json_agg(t ORDER BY profile_id, vocab_id) FROM profile_domains t)::text AS domains`)
  return JSON.stringify(rows[0])
}

afterAll(async () => {
  for (const db of [FRESH, UPGRADE, RECOVERY]) {
    await onAdmin(`DROP DATABASE IF EXISTS ${db} WITH (FORCE)`)
  }
  await closePool()
})

describe('FRESH — 001 → 019 on an empty database', () => {
  beforeAll(() => recreate(FRESH), 60_000)

  it('applies every migration and the seed; a second run is a no-op', async () => {
    expect(runner(FRESH, 'migrate')).toContain(`applied ${M019}`)
    runner(FRESH, 'seed')
    const db = await connect(FRESH)
    try {
      expect(await ledger(db)).toEqual(MIGRATION_FILES)
      expect(await shape(db)).toMatchObject({
        statuses: ['ACTIVE', 'ARCHIVED', 'UNNORMALIZED'],
        columns: ['employment_type', 'location'],
      })
      expect(runner(FRESH, 'migrate')).not.toMatch(/^\s*applied /m)
      // Applying the file by hand again is also a no-op (IF NOT EXISTS).
      await db.query(M019_SOURCE)
      expect((await shape(db)).statuses).toEqual(['ACTIVE', 'ARCHIVED', 'UNNORMALIZED'])
    } finally {
      await db.end()
    }
  })
})

describe('UPGRADE — the schema up to 018 with data, then 019', () => {
  let db: Client
  beforeAll(async () => {
    await recreate(UPGRADE)
    db = await connect(UPGRADE)
    await applyBefore019(db)
    await db.query(`
      INSERT INTO user_accounts (id, email, email_normalized, status) VALUES
        ('a0190000-0000-4000-8000-000000000001', 'p@example.test', 'p@example.test', 'ACTIVE');
      INSERT INTO individual_profiles (id, account_id, display_name) VALUES
        ('a0190000-0000-4000-8000-0000000000a1', 'a0190000-0000-4000-8000-000000000001', 'P');
      INSERT INTO vocabulary_types (code, label) VALUES ('DOMAIN', 'Lĩnh vực')
        ON CONFLICT DO NOTHING;
      INSERT INTO vocabulary_items (id, type_code, slug, label, status) VALUES
        ('a0190000-0000-4000-8000-0000000000d1', 'DOMAIN', 'u19-a', 'A', 'ACTIVE'),
        ('a0190000-0000-4000-8000-0000000000d2', 'DOMAIN', 'u19-b', 'B', 'ARCHIVED');
      INSERT INTO profile_domains VALUES
        ('a0190000-0000-4000-8000-0000000000a1', 'a0190000-0000-4000-8000-0000000000d2');
      INSERT INTO profile_experience (profile_id, title, organization_name, started_on) VALUES
        ('a0190000-0000-4000-8000-0000000000a1', 'PM', 'Tracely', '2024-02-01');`)
  }, 60_000)
  afterAll(async () => {
    await db?.end()
  })

  it('applies 019 only, keeps every row; new columns NULL, no item unnormalised', async () => {
    const before = await snapshot(db)
    const out = runner(UPGRADE, 'migrate')
    expect(out.match(/applied /g)).toHaveLength(MIGRATION_FILES.length - BEFORE_019.length)
    expect(out).toContain(`applied ${M019}`)
    expect(await snapshot(db)).toEqual(before)
    const { rows } = await db.query(
      `SELECT (SELECT count(*)::int FROM profile_experience
                WHERE employment_type IS NOT NULL OR location IS NOT NULL) AS filled,
              (SELECT count(*)::int FROM vocabulary_items WHERE status = 'UNNORMALIZED') AS free`,
    )
    expect(rows[0]).toEqual({ filled: 0, free: 0 })
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

  it('refuses while a free-text tag or an experience type / place exists, changing nothing', async () => {
    for (const [use, undo] of [
      [
        `INSERT INTO vocabulary_items (type_code, slug, label, status)
         VALUES ('DOMAIN', 'u-rollback', 'Tự gõ', 'UNNORMALIZED')`,
        `DELETE FROM vocabulary_items WHERE slug = 'u-rollback'`,
      ],
      [
        `UPDATE profile_experience SET location = 'Huế'
          WHERE id = (SELECT id FROM profile_experience LIMIT 1)`,
        `UPDATE profile_experience SET location = NULL`,
      ],
    ]) {
      await db.query(use!)
      await expect(db.query(documentedRollback())).rejects.toThrow('019 rollback refused')
      await db.query('ROLLBACK')
      expect(await ledger(db)).toEqual(MIGRATION_FILES)
      await db.query(undo!)
    }
  })

  it('rolls back losslessly to the 018 schema and re-applies', async () => {
    const before = await snapshot(db)
    for (const later of LATER_ROLLBACKS) await db.query(documentedRollback(later))
    await db.query(documentedRollback())
    expect(await ledger(db)).toEqual(BEFORE_019)
    expect(await shape(db)).toMatchObject({
      statuses: ['ACTIVE', 'ARCHIVED'],
      columns: null,
      status_default: "'ACTIVE'::vocab_status",
    })
    expect(await snapshot(db)).toEqual(before)

    expect(runner(RECOVERY, 'migrate')).toContain(`applied ${M019}`)
    expect(await ledger(db)).toEqual(MIGRATION_FILES)
    expect((await shape(db)).statuses).toEqual(['ACTIVE', 'ARCHIVED', 'UNNORMALIZED'])
    expect(await snapshot(db)).toEqual(before)
  })
})
