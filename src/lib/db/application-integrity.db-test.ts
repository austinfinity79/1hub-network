import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { isApiError } from '../api/errors'
import {
  createApplication,
  getApplication,
  saveApplicationAnswers,
  submitApplication,
} from '../application/application'
import { buildWf05Fixture, removeWf05Fixture, type Wf05Fixture } from '../application/testing'
import { closePool, databaseUrl, query } from './client'

/**
 * WF05-PROD-02 — migration 016 and WF05 persistence (WF05 production contract:
 * domain and lifecycle "Submitted immutability", DB contract D1–D3; DEC-W5P-D04,
 * D06; handoff P2-1, P2-3).
 *
 *   FRESH     the runner on an empty database (001 → 016), then the seed.
 *   UPGRADE   the WF04 candidate schema (001–015 in the ledger) holding WF05
 *             data — ventures, a member, DRAFT and SUBMITTED applications, a
 *             CLOSED programme — then the runner: 016 only, nothing lost.
 *   RECOVERY  the STOP check, the documented rollback and a re-apply.
 *   FIXTURE   the deterministic WF05 fixture on the shared database, through
 *             the services, across a fresh connection pool.
 * Scratch databases are created and dropped here; the shared one is touched
 * only by the fixture, which removes its own rows.
 */

const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
const RUNNER = join(ROOT, 'scripts', 'db.mjs')
const M015 = '015_p0_programme_production.sql'
const M016 = '016_p0_application_integrity.sql'
const M016_SOURCE = readFileSync(join(MIGRATIONS_DIR, M016), 'utf8')
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const FRESH = 'hubnetwork_p0_w5p02_fresh'
const UPGRADE = 'hubnetwork_p0_w5p02_upgrade'
const RECOVERY = 'hubnetwork_p0_w5p02_recovery'

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const MEMBER_ACCOUNT = '30000000-0000-0000-0000-000000000001'
const MEMBER_PROFILE = '40000000-0000-0000-0000-000000000001'
const LEADER_PROFILE = '40000000-0000-0000-0000-000000000002'
// Test-only rows, outside every seed id range.
const V_PROJECT = 'f0160000-0000-0000-0000-000000000001'
const V_STARTUP = 'f0160000-0000-0000-0000-000000000002'
const P_CLOSED = 'f0160000-0000-0000-0000-000000000003'
const A_DRAFT = 'f0160000-0000-0000-0000-0000000000a1'
const A_SUBMITTED = 'f0160000-0000-0000-0000-0000000000a2'
const A_CLOSED = 'f0160000-0000-0000-0000-0000000000a3'

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

/** Applies migrations up to `last` exactly as the runner does, ledger included. */
async function applyThrough(client: Client, last: string): Promise<void> {
  await client.query(LEDGER)
  for (const filename of MIGRATION_FILES.filter((name) => name <= last)) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(filename, sha256) VALUES ($1, $2)', [
      filename,
      createHash('sha256').update(sql).digest('hex'),
    ])
  }
}

function documentedRollback(): string {
  const lines = M016_SOURCE.split('\n')
  const start = lines.findIndex((line) => line.startsWith('-- ROLLBACK'))
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('--')) break
    if (line.startsWith('--   ')) body.push(line.slice(5))
  }
  return body.join('\n')
}

const SNAPSHOT: Record<string, string> = {
  applications: 'SELECT * FROM applications',
  projects: 'SELECT * FROM projects',
  project_members: 'SELECT * FROM project_members',
  programmes: 'SELECT * FROM programmes',
  programme_application_forms: 'SELECT * FROM programme_application_forms',
}

/** Row count and an order-independent digest of every row of each table. */
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

/** Runs `sql` inside a savepoint and returns the refusal's SQLSTATE and constraint. */
async function refused(client: Client, sql: string, params: unknown[] = []) {
  await client.query('BEGIN')
  try {
    await client.query(sql, params)
  } catch (error) {
    const e = error as { code?: string; constraint?: string; message?: string }
    return { code: e.code, constraint: e.constraint, message: e.message }
  } finally {
    await client.query('ROLLBACK')
  }
  throw new Error(`accepted: ${sql}`)
}

async function accepted(client: Client, sql: string, params: unknown[] = []): Promise<number> {
  await client.query('BEGIN')
  try {
    return (await client.query(sql, params)).rowCount ?? 0
  } finally {
    await client.query('ROLLBACK')
  }
}

const SNAPSHOT_JSON = JSON.stringify({ schema_version: 1, answers: [], questions: [] })

/** WF05 data as the WF04 candidate schema can hold it before 016. */
async function wf05Rows(client: Client): Promise<void> {
  await client.query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, status, metadata, visibility)
     VALUES ($1, 'PROJECT', $3, 'w5p02-project', 'W5P02 Project', 'DRAFT', '{}', 'PRIVATE'),
            ($2, 'STARTUP', $3, 'w5p02-startup', 'W5P02 Startup', 'ACTIVE', '{}', 'PUBLIC')`,
    [V_PROJECT, V_STARTUP, MEMBER_PROFILE],
  )
  await client.query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at, permission, updated_at)
     VALUES ($1, $2, 'Thành viên', 'ACTIVE', now(), 'EDIT', now())`,
    [V_PROJECT, LEADER_PROFILE],
  )
  await client.query(
    `INSERT INTO programmes (id, organization_id, programme_type, slug, name, status, metadata)
     VALUES ($1, $2, 'PROGRAMME', 'w5p02-closed', 'W5P02 Closed', 'CLOSED', '{}')`,
    [P_CLOSED, CHAPTER_01],
  )
  await client.query(
    `INSERT INTO applications (id, programme_id, venture_id, primary_applicant_type, status, answers,
                               question_set_version, created_by_account_id)
     VALUES ($1, $2, $3, 'TEAM', 'DRAFT', '[{"question_id":"q-problem","value":"Nháp"}]', 1, $4)`,
    [A_DRAFT, SEED_PROGRAMME, V_PROJECT, MEMBER_ACCOUNT],
  )
  await client.query(
    `INSERT INTO applications (id, programme_id, venture_id, primary_applicant_type, status, answers,
                               question_set_version, created_by_account_id, submitted_at,
                               submitted_by_account_id, snapshot)
     VALUES ($1, $2, $3, 'STARTUP', 'SUBMITTED', '[]', 1, $4, '2026-10-01T03:00:00Z', $4, $5),
            ($6, $7, $3, 'STARTUP', 'SUBMITTED', '[]', 1, $4, '2026-09-20T03:00:00Z', $4, $5)`,
    [A_SUBMITTED, SEED_PROGRAMME, V_STARTUP, MEMBER_ACCOUNT, SNAPSHOT_JSON, A_CLOSED, P_CLOSED],
  )
}

afterAll(async () => {
  for (const database of [FRESH, UPGRADE, RECOVERY]) {
    await onAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
  }
  await removeWf05Fixture()
  await closePool()
}, 60_000)

describe('FRESH — 001 → 016 on an empty database, then the seed', () => {
  let db: Client
  let migrateOutput = ''

  beforeAll(async () => {
    await recreate(FRESH)
    migrateOutput = runner(FRESH, 'migrate')
    runner(FRESH, 'seed')
    db = await connect(FRESH)
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  it('applies every migration in order, 016 last, each with its checksum', async () => {
    const { rows } = await db.query<{ filename: string; sha256: string }>(
      'SELECT filename, sha256 FROM schema_migrations ORDER BY filename',
    )
    expect(migrateOutput.match(/applied /g)).toHaveLength(MIGRATION_FILES.length)
    expect(rows.map((r) => r.filename)).toEqual(MIGRATION_FILES)
    expect(rows.at(-1)!.filename).toBe(M016)
    expect(rows.at(-1)!.sha256).toBe(createHash('sha256').update(M016_SOURCE).digest('hex'))
  })

  it('installs the three guards and the snapshot check; adds no table, column or index', async () => {
    const { rows: triggers } = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'applications'::regclass AND NOT tgisinternal ORDER BY tgname`,
    )
    expect(triggers.map((t) => t.tgname)).toEqual([
      'trg_applications_identity_fixed',
      'trg_applications_no_truncate',
      'trg_applications_submitted_final',
      'trg_applications_submitted_kept',
    ])
    const { rows: checks } = await db.query<{ conname: string }>(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'applications'::regclass AND contype = 'c' ORDER BY conname`,
    )
    expect(checks.map((c) => c.conname)).toEqual([
      'ck_applications_answers',
      'ck_applications_snapshot_object',
      'ck_applications_submitted',
    ])
    expect(M016_SOURCE).not.toMatch(/^\s*(CREATE TABLE|CREATE (UNIQUE )?INDEX|ADD COLUMN)\b/im)
    expect(M016_SOURCE).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\b/im)
  })

  it('seeds the canonical WF05 records: the member, the venture and the PUBLISHED form', async () => {
    const { rows } = await db.query<{ status: string; types: string[]; n: number }>(
      `SELECT p.status::text AS status, f.applicant_types::text[] AS types,
              jsonb_array_length(f.questions) AS n
         FROM programmes p JOIN programme_application_forms f ON f.programme_id = p.id
        WHERE p.id = $1`,
      [SEED_PROGRAMME],
    )
    expect(rows).toEqual([{ status: 'PUBLISHED', types: ['TEAM', 'STARTUP'], n: 2 }])
    const { rows: ventures } = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1`,
      [MEMBER_PROFILE],
    )
    expect(ventures[0]!.n).toBe(1)
    expect((await db.query('SELECT 1 FROM applications')).rowCount).toBe(0)
  })

  it('a re-seed never rewrites a form that already has applications', async () => {
    await wf05Rows(db)
    await db.query(
      `UPDATE programme_application_forms SET questions = '[]'::jsonb, version = 2 WHERE programme_id = $1`,
      [SEED_PROGRAMME],
    )
    runner(FRESH, 'seed')
    const { rows } = await db.query<{ version: number; n: number }>(
      `SELECT version, jsonb_array_length(questions) AS n FROM programme_application_forms WHERE programme_id = $1`,
      [SEED_PROGRAMME],
    )
    expect(rows[0]).toEqual({ version: 2, n: 0 })
  })
})

describe('UPGRADE — the WF04 candidate schema with WF05 data, then 016 only', () => {
  let db: Client
  let migrateOutput = ''
  let before: Record<string, { n: number; h: string }>

  beforeAll(async () => {
    await recreate(UPGRADE)
    db = await connect(UPGRADE)
    await applyThrough(db, M015)
    runner(UPGRADE, 'seed')
    await wf05Rows(db)
    before = await snapshot(db)
    migrateOutput = runner(UPGRADE, 'migrate')
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  it('applies 016 only and is a no-op on a second run', async () => {
    expect(migrateOutput).toContain(`applied ${M016}`)
    expect(migrateOutput.match(/applied /g)).toHaveLength(1)
    expect(migrateOutput.match(/skip /g)).toHaveLength(MIGRATION_FILES.length - 1)
    const second = runner(UPGRADE, 'migrate')
    expect(second).toContain(`skip    ${M016} (already applied)`)
    expect(second).not.toContain('applied ')
  })

  it('loses nothing: every venture, member, programme, form and application row is byte-identical', async () => {
    expect(await snapshot(db)).toEqual(before)
  })

  it('keeps the canonical ids, links and the submitted history readable', async () => {
    const { rows } = await db.query<{ id: string; status: string; venture_id: string; programme_id: string }>(
      `SELECT id::text, status::text, venture_id::text, programme_id::text FROM applications ORDER BY id`,
    )
    expect(rows).toEqual([
      { id: A_DRAFT, status: 'DRAFT', venture_id: V_PROJECT, programme_id: SEED_PROGRAMME },
      { id: A_SUBMITTED, status: 'SUBMITTED', venture_id: V_STARTUP, programme_id: SEED_PROGRAMME },
      { id: A_CLOSED, status: 'SUBMITTED', venture_id: V_STARTUP, programme_id: P_CLOSED },
    ])
    const { rows: history } = await db.query<{ v: number }>(
      `SELECT (snapshot ->> 'schema_version')::int AS v FROM applications
        WHERE programme_id = $1 AND status = 'SUBMITTED'`,
      [P_CLOSED],
    )
    expect(history).toEqual([{ v: 1 }])
  })

  describe('a SUBMITTED application never changes and is never deleted', () => {
    it.each([
      ['answers', `UPDATE applications SET answers = '[]'::jsonb WHERE id = $1`],
      ['the programme', `UPDATE applications SET programme_id = '${P_CLOSED}' WHERE id = $1`],
      ['the venture', `UPDATE applications SET venture_id = '${V_PROJECT}' WHERE id = $1`],
      ['the applicant type', `UPDATE applications SET primary_applicant_type = 'TEAM' WHERE id = $1`],
      ['the creator', `UPDATE applications SET created_by_account_id = created_by_account_id WHERE id = $1`],
      ['the submission time', `UPDATE applications SET submitted_at = now() WHERE id = $1`],
      ['the status', `UPDATE applications SET status = 'DRAFT' WHERE id = $1`],
    ])('refuses an UPDATE of %s', async (_what, sql) => {
      expect(await refused(db, sql, [A_SUBMITTED])).toMatchObject({ code: '23514' })
    })

    it('refuses a DELETE and a TRUNCATE', async () => {
      expect(await refused(db, 'DELETE FROM applications WHERE id = $1', [A_SUBMITTED])).toMatchObject({
        code: '23514',
        message: expect.stringContaining('never deleted'),
      })
      expect(await refused(db, 'TRUNCATE applications')).toMatchObject({ code: '23514' })
    })
  })

  describe('a DRAFT keeps its applicant identity and stays editable for its answers', () => {
    it.each([
      ['the venture', `UPDATE applications SET venture_id = '${V_STARTUP}' WHERE id = $1`],
      ['the programme', `UPDATE applications SET programme_id = '${P_CLOSED}' WHERE id = $1`],
      ['the applicant type', `UPDATE applications SET primary_applicant_type = 'STARTUP' WHERE id = $1`],
      [
        'the creator',
        `UPDATE applications SET created_by_account_id = '30000000-0000-0000-0000-000000000002' WHERE id = $1`,
      ],
    ])('refuses a change of %s', async (_what, sql) => {
      expect(await refused(db, sql, [A_DRAFT])).toMatchObject({
        code: '23514',
        message: expect.stringContaining('keeps its venture, programme'),
      })
    })

    it('accepts an answers update and a DELETE of the DRAFT', async () => {
      expect(
        await accepted(
          db,
          `UPDATE applications SET answers = '[]'::jsonb, updated_at = now() WHERE id = $1`,
          [A_DRAFT],
        ),
      ).toBe(1)
      expect(await accepted(db, 'DELETE FROM applications WHERE id = $1', [A_DRAFT])).toBe(1)
    })
  })

  describe('the database refuses invalid persistence', () => {
    const insert = `INSERT INTO applications (programme_id, venture_id, primary_applicant_type, status,
                                              answers, question_set_version, created_by_account_id,
                                              submitted_at, submitted_by_account_id, snapshot)
                    VALUES ($1, $2, $3, $4, '[]', 1, $5, $6, $7, $8)`
    it.each([
      [
        'a second active application for the same venture and programme',
        [SEED_PROGRAMME, V_PROJECT, 'TEAM', 'DRAFT', MEMBER_ACCOUNT, null, null, null],
        '23505',
        'uq_applications_active_pair',
      ],
      [
        'an unknown venture',
        [SEED_PROGRAMME, 'f0160000-0000-0000-0000-00000000dead', 'TEAM', 'DRAFT', MEMBER_ACCOUNT, null, null, null],
        '23503',
        'applications_venture_id_fkey',
      ],
      [
        'an unknown programme',
        ['f0160000-0000-0000-0000-00000000dead', V_PROJECT, 'TEAM', 'DRAFT', MEMBER_ACCOUNT, null, null, null],
        '23503',
        'applications_programme_id_fkey',
      ],
      [
        'an unknown creator',
        [P_CLOSED, V_PROJECT, 'TEAM', 'DRAFT', 'f0160000-0000-0000-0000-00000000dead', null, null, null],
        '23503',
        'applications_created_by_account_id_fkey',
      ],
      [
        'a SUBMITTED row without its snapshot',
        [P_CLOSED, V_PROJECT, 'TEAM', 'SUBMITTED', MEMBER_ACCOUNT, '2026-10-01', MEMBER_ACCOUNT, null],
        '23514',
        'ck_applications_submitted',
      ],
      [
        'a snapshot that is not an object',
        [P_CLOSED, V_PROJECT, 'TEAM', 'SUBMITTED', MEMBER_ACCOUNT, '2026-10-01', MEMBER_ACCOUNT, '[]'],
        '23514',
        'ck_applications_snapshot_object',
      ],
    ])('refuses %s', async (_case, params, code, constraint) => {
      expect(await refused(db, insert, params as unknown[])).toMatchObject({ code, constraint })
    })

    it('refuses a status outside DRAFT / SUBMITTED', async () => {
      expect(
        await refused(db, insert, [P_CLOSED, V_PROJECT, 'TEAM', 'WITHDRAWN', MEMBER_ACCOUNT, null, null, null]),
      ).toMatchObject({ code: '22P02' })
    })

    it.each([
      [
        'a venture that has applications',
        `DELETE FROM projects WHERE id = '${V_STARTUP}'`,
        'applications_venture_id_fkey',
      ],
      [
        'a programme that has applications',
        `DELETE FROM programmes WHERE id = '${P_CLOSED}'`,
        'applications_programme_id_fkey',
      ],
      [
        'a programme that has a form',
        `INSERT INTO programmes (id, organization_id, programme_type, slug, name, status, metadata)
         VALUES ('f0160000-0000-0000-0000-000000000004', '${CHAPTER_01}', 'PROGRAMME', 'w5p02-form-only', 'X', 'PUBLISHED', '{}');
         INSERT INTO programme_application_forms (programme_id, applicant_types, questions, version)
         VALUES ('f0160000-0000-0000-0000-000000000004', ARRAY['TEAM']::applicant_type[], '[]', 1);
         DELETE FROM programmes WHERE id = 'f0160000-0000-0000-0000-000000000004'`,
        'programme_application_forms_programme_id_fkey',
      ],
    ])('leaves no orphan: refuses deleting %s', async (_case, sql, constraint) => {
      expect(await refused(db, sql)).toMatchObject({ code: '23503', constraint })
    })

    it('refuses a venture owned by an unknown profile and a member with an unknown profile', async () => {
      expect(
        await refused(
          db,
          `INSERT INTO projects (type, owner_profile_id, slug, name, status, metadata, visibility)
           VALUES ('PROJECT', 'f0160000-0000-0000-0000-00000000dead', 'w5p02-orphan', 'X', 'DRAFT', '{}', 'PRIVATE')`,
        ),
      ).toMatchObject({ code: '23503', constraint: 'projects_owner_profile_id_fkey' })
      expect(
        await refused(
          db,
          `INSERT INTO project_members (project_id, profile_id, state, joined_at, permission, updated_at)
           VALUES ($1, 'f0160000-0000-0000-0000-00000000dead', 'ACTIVE', now(), 'VIEW', now())`,
          [V_PROJECT],
        ),
      ).toMatchObject({ code: '23503', constraint: 'project_members_profile_id_fkey' })
    })
  })
})

describe('RECOVERY — the STOP check, the documented rollback and a re-apply', () => {
  let db: Client

  beforeAll(async () => {
    await recreate(RECOVERY)
    db = await connect(RECOVERY)
    await applyThrough(db, M015)
    runner(RECOVERY, 'seed')
    await wf05Rows(db)
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  async function ledger(): Promise<number> {
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations')
    return rows[0]!.n
  }

  it('STOPS on a snapshot that is not an object and changes nothing', async () => {
    await db.query(`ALTER TABLE applications DISABLE TRIGGER trg_applications_submitted_final`)
    await db.query(`UPDATE applications SET snapshot = '[]'::jsonb WHERE id = $1`, [A_CLOSED])
    await db.query(`ALTER TABLE applications ENABLE TRIGGER trg_applications_submitted_final`)
    const before = await snapshot(db)

    expect(runnerFailure(RECOVERY)).toContain(
      `016 stopped: application snapshots that are not an object: ${A_CLOSED}`,
    )
    expect(await ledger()).toBe(MIGRATION_FILES.length - 1)
    expect(await snapshot(db)).toEqual(before)

    await db.query(`ALTER TABLE applications DISABLE TRIGGER trg_applications_submitted_final`)
    await db.query(`UPDATE applications SET snapshot = $2::jsonb WHERE id = $1`, [A_CLOSED, SNAPSHOT_JSON])
    await db.query(`ALTER TABLE applications ENABLE TRIGGER trg_applications_submitted_final`)
  })

  it('applies once the data is clean; the documented rollback removes it losslessly; it re-applies', async () => {
    const before = await snapshot(db)
    runner(RECOVERY, 'migrate')
    expect(await ledger()).toBe(MIGRATION_FILES.length)

    await db.query(documentedRollback())
    expect(await ledger()).toBe(MIGRATION_FILES.length - 1)
    const { rows } = await db.query<{ tgname: string }>(
      `SELECT tgname FROM pg_trigger WHERE tgrelid = 'applications'::regclass AND NOT tgisinternal`,
    )
    expect(rows.map((r) => r.tgname)).toEqual(['trg_applications_submitted_final'])
    expect(await snapshot(db)).toEqual(before)

    expect(runner(RECOVERY, 'migrate')).toContain(`applied ${M016}`)
    expect(await snapshot(db)).toEqual(before)
  })
})

describe('FIXTURE — the deterministic WF05 set through the services', () => {
  let fx: Wf05Fixture

  beforeAll(async () => {
    fx = await buildWf05Fixture()
  }, 60_000)

  it('builds every frozen fixture on the canonical tables', async () => {
    const ventures = await query<{ type: string; status: string }>(
      `SELECT type::text, status::text FROM projects WHERE id = ANY($1::uuid[]) ORDER BY name`,
      [Object.values(fx.ventures)],
    )
    expect(ventures).toHaveLength(4)
    expect(ventures.map((v) => v.status).sort()).toEqual(['ARCHIVED', 'DRAFT', 'DRAFT', 'DRAFT'])
    const members = await query<{ permission: string }>(
      `SELECT permission FROM project_members WHERE project_id = $1 AND state = 'ACTIVE' ORDER BY permission`,
      [fx.ventures.project],
    )
    expect(members.map((m) => m.permission)).toEqual(['EDIT', 'VIEW'])
    const apps = await query<{ id: string; status: string; programme: string }>(
      `SELECT a.id::text, a.status::text, p.status::text AS programme
         FROM applications a JOIN programmes p ON p.id = a.programme_id
        WHERE a.id = ANY($1::uuid[]) ORDER BY a.created_at`,
      [Object.values(fx.applications)],
    )
    expect(apps.map((a) => [a.status, a.programme])).toEqual([
      ['DRAFT', 'PUBLISHED'],
      ['SUBMITTED', 'PUBLISHED'],
      ['DRAFT', 'CLOSED'],
      ['SUBMITTED', 'CLOSED'],
    ])
    const forms = await query<{ slug: string; types: string[] | null }>(
      `SELECT p.slug, f.applicant_types::text[] AS types
         FROM programmes p LEFT JOIN programme_application_forms f ON f.programme_id = p.id
        WHERE p.id = ANY($1::uuid[]) ORDER BY p.slug`,
      [Object.values(fx.programmes)],
    )
    expect(forms).toEqual([
      { slug: 'wf05-fx-closed', types: ['TEAM', 'STARTUP'] },
      { slug: 'wf05-fx-no-form', types: null },
      { slug: 'wf05-fx-open', types: ['TEAM', 'STARTUP'] },
      { slug: 'wf05-fx-startup-only', types: ['STARTUP'] },
      { slug: 'wf05-fx-team-only', types: ['TEAM'] },
    ])
  })

  it('reads the same canonical records through a fresh connection pool', async () => {
    const draftBefore = await getApplication(fx.owner.accountId, fx.applications.draft)
    const submittedBefore = await getApplication(fx.owner.accountId, fx.applications.submitted)
    await closePool()
    expect(await getApplication(fx.owner.accountId, fx.applications.draft)).toEqual(draftBefore)
    expect(await getApplication(fx.owner.accountId, fx.applications.submitted)).toEqual(
      submittedBefore,
    )
    expect(draftBefore.answers).toEqual([
      { question_id: 'q-problem', value: 'Giảm thời gian giao hàng chặng cuối.' },
    ])
    expect(submittedBefore.status).toBe('SUBMITTED')
  })

  it('persists a DRAFT save and keeps a SUBMITTED application final', async () => {
    const saved = await saveApplicationAnswers(fx.owner.accountId, fx.applications.draft, {
      answers: [{ question_id: 'q-support', value: 'Kết nối khách hàng.' }],
    })
    expect(saved.answers).toHaveLength(2)
    await closePool()
    expect((await getApplication(fx.owner.accountId, fx.applications.draft)).answers).toHaveLength(2)

    const refusal = await saveApplicationAnswers(fx.owner.accountId, fx.applications.submitted, {
      answers: [{ question_id: 'q-support', value: 'x' }],
    }).catch((e: unknown) => e)
    expect(isApiError(refusal) && refusal.code).toBe('APPLICATION_SUBMITTED')
    const again = await submitApplication(fx.owner.accountId, fx.applications.submitted, 'req-again').catch(
      (e: unknown) => e,
    )
    expect(isApiError(again) && again.code).toBe('APPLICATION_SUBMITTED')
    await expect(
      query('DELETE FROM applications WHERE id = $1', [fx.applications.submitted]),
    ).rejects.toThrow(/never deleted/)
  })

  it('refuses a duplicate application for the same venture and programme', async () => {
    const duplicate = await createApplication(
      fx.owner.accountId,
      { venture_id: fx.ventures.project, programme_id: fx.programmes.open },
      'req-duplicate',
    ).catch((e: unknown) => e)
    expect(isApiError(duplicate) && duplicate.code).toBe('APPLICATION_EXISTS')
    const [count] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM applications WHERE venture_id = $1 AND programme_id = $2`,
      [fx.ventures.project, fx.programmes.open],
    )
    expect(count!.n).toBe(1)
  })
})
