import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { databaseUrl } from './client'

/**
 * WF04-PROD-02 — migration 015, the Programme persistence foundation (WF04
 * production contract §3, §4, §6, §11, §20; DEC-W4P-D11).
 *
 * Every case runs on its own scratch database, created and dropped here, so
 * the shared fixture database and the suites that depend on it are untouched:
 *
 *   FRESH     the runner on an empty database, then the deterministic seed.
 *   UPGRADE   the schema production holds (001–014 in the ledger, applied the
 *             way the runner applies them) with data, then the runner.
 *   RECOVERY  the STOP checks on rows 015 cannot carry, then the documented
 *             rollback and a re-apply.
 */
const ROOT = process.cwd()
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
const RUNNER = join(ROOT, 'scripts', 'db.mjs')
const M015 = '015_p0_programme_production.sql'
const M014 = '014_p0_legal_v1_0.sql'
const M015_SOURCE = readFileSync(join(MIGRATIONS_DIR, M015), 'utf8')
// Later migrations (016 onwards, WF05-PROD-02) are applied by the same runner
// pass; the 015 expectations below hold whatever follows it.
const MIGRATION_FILES = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith('.sql'))
  .sort()
const AFTER_014 = MIGRATION_FILES.filter((name) => name > M014)
/** Tables later migrations create; 015's own "adds no table" check leaves them out. */
const LATER_TABLES = MIGRATION_FILES.filter((name) => name > M015).flatMap((name) =>
  [
    ...readFileSync(join(MIGRATIONS_DIR, name), 'utf8').matchAll(
      /^CREATE TABLE (?:IF NOT EXISTS )?(\w+)/gm,
    ),
  ].map((match) => match[1]!),
)

const FRESH = 'hubnetwork_p0_prod02_fresh'
const UPGRADE = 'hubnetwork_p0_prod02_upgrade'
const RECOVERY = 'hubnetwork_p0_prod02_recovery'

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const SEED_CHALLENGE = 'c0000000-0000-0000-0000-000000000001'
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const SEED_VENTURE = '50000000-0000-0000-0000-000000000001'
const SEED_ACCOUNT = '30000000-0000-0000-0000-000000000001'
// Test-only rows, outside every fixture id range.
const LEGACY_ARCHIVED = 'f0150000-0000-0000-0000-000000000001'

// The runner's ledger, as every environment holds it (scripts/db.mjs).
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

/** The runner's failure message, which carries the migration's STOP text. */
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
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql') && name <= last)
    .sort()
  for (const filename of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations(filename, sha256) VALUES ($1, $2)', [
      filename,
      createHash('sha256').update(sql).digest('hex'),
    ])
  }
}

const SNAPSHOT: Record<string, string> = {
  programmes: `SELECT id, organization_id, programme_type::text AS programme_type, slug, name,
                      summary, status::text AS status, starts_at, ends_at, metadata,
                      created_at, updated_at FROM programmes`,
  programme_application_forms: 'SELECT * FROM programme_application_forms',
  applications: 'SELECT * FROM applications',
  events: 'SELECT * FROM events',
  organizations: 'SELECT * FROM organizations',
}

type Snapshot = Record<string, { n: number; h: string }>

/** Row count and an order-independent digest of every row of each table. */
async function snapshot(client: Client): Promise<Snapshot> {
  const out: Snapshot = {}
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

async function tables(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  )
  return rows.map((r) => r.table_name)
}

async function labels(client: Client, typeName: string): Promise<string[]> {
  const { rows } = await client.query<{ label: string }>(
    `SELECT e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE t.typname = $1 ORDER BY e.enumsortorder`,
    [typeName],
  )
  return rows.map((r) => r.label)
}

async function column(client: Client, table: string, name: string) {
  const { rows } = await client.query<{
    udt_name: string
    is_nullable: string
    column_default: string | null
  }>(
    `SELECT udt_name, is_nullable, column_default FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, name],
  )
  return rows[0]
}

async function constraints(client: Client): Promise<Record<string, string>> {
  const { rows } = await client.query<{ conname: string; def: string }>(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'programmes'::regclass ORDER BY conname`,
  )
  return Object.fromEntries(rows.map((r) => [r.conname, r.def]))
}

async function refused(client: Client, sql: string, params: unknown[] = []) {
  try {
    await client.query('SAVEPOINT probe')
    await client.query(sql, params)
  } catch (error) {
    await client.query('ROLLBACK TO SAVEPOINT probe')
    const e = error as { code?: string; constraint?: string }
    return { code: e.code, constraint: e.constraint }
  }
  await client.query('RELEASE SAVEPOINT probe')
  throw new Error(`accepted: ${sql}`)
}

let slugSeq = 0
function insertProgramme(
  client: Client,
  values: {
    organization?: string | null
    type?: 'PROGRAMME' | 'CHALLENGE'
    status?: string
    starts?: string | null
    ends?: string | null
    metadata?: unknown
  },
) {
  slugSeq += 1
  return client.query<{ id: string }>(
    `INSERT INTO programmes (organization_id, programme_type, slug, name, status, starts_at, ends_at, metadata)
     VALUES ($1, $2, $3, 'Chương trình thử 015', $4, $5, $6, $7) RETURNING id::text`,
    [
      values.organization === undefined ? CHAPTER_01 : values.organization,
      values.type ?? 'PROGRAMME',
      `prod02-test-${slugSeq}`,
      values.status ?? 'DRAFT',
      values.starts ?? null,
      values.ends ?? null,
      JSON.stringify(values.metadata ?? {}),
    ],
  )
}

/** The rollback block documented in the migration header, uncommented. */
function documentedRollback(): string {
  const lines = M015_SOURCE.split('\n')
  const start = lines.findIndex((line) => line.startsWith('-- ROLLBACK'))
  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('--')) break
    if (line.startsWith('--   ')) body.push(line.slice(5))
  }
  return body.join('\n')
}

afterAll(async () => {
  for (const database of [FRESH, UPGRADE, RECOVERY]) {
    await onAdmin(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
  }
})

describe('WF04-PROD-02 migration 015 on a fresh database', () => {
  let db: Client

  beforeAll(async () => {
    await recreate(FRESH)
    runner(FRESH, 'migrate')
    db = await connect(FRESH)
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  it('(1) applies every migration in order, 015 with its checksum', async () => {
    const { rows } = await db.query<{ filename: string; sha256: string }>(
      'SELECT filename, sha256 FROM schema_migrations ORDER BY filename',
    )

    expect(rows.map((r) => r.filename)).toEqual(MIGRATION_FILES)
    expect(rows.find((r) => r.filename === M015)!.sha256).toBe(
      createHash('sha256').update(M015_SOURCE).digest('hex'),
    )
  })

  it('(1) gives programmes its own lifecycle domain, a required owner and the two checks', async () => {
    expect(await labels(db, 'programme_status')).toEqual(['DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED'])
    expect(await column(db, 'programmes', 'status')).toEqual({
      udt_name: 'programme_status',
      is_nullable: 'NO',
      column_default: "'DRAFT'::programme_status",
    })
    expect((await column(db, 'programmes', 'organization_id'))!.is_nullable).toBe('NO')
    expect(Object.keys(await constraints(db))).toEqual([
      'ck_programmes_dates',
      'ck_programmes_metadata',
      'programmes_organization_id_fkey',
      'programmes_pkey',
      'programmes_slug_key',
    ])
    // The shared domain keeps serving organizations only, unchanged.
    expect(await labels(db, 'publication_status')).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    const { rows } = await db.query<{ t: string }>(
      `SELECT table_name AS t FROM information_schema.columns
        WHERE table_schema = 'public' AND udt_name = 'publication_status' ORDER BY 1`,
    )
    expect(rows.map((r) => r.t)).toEqual(['organizations'])
  })

  it('(1) needs no fixture: the migrations alone leave every programme table empty', async () => {
    const { rows } = await db.query<{ p: number; f: number; a: number }>(
      `SELECT (SELECT count(*) FROM programmes)::int AS p,
              (SELECT count(*) FROM programme_application_forms)::int AS f,
              (SELECT count(*) FROM applications)::int AS a`,
    )
    expect(rows[0]).toEqual({ p: 0, f: 0, a: 0 })
    // 015 writes no row of any kind.
    expect(M015_SOURCE).not.toMatch(/^\s*(INSERT|UPDATE|DELETE)\b/im)
  })

  it('(13) seeds the same two programme rows on every run, valid under the new constraints', async () => {
    runner(FRESH, 'seed')
    const first = await snapshot(db)
    runner(FRESH, 'seed')
    const second = await snapshot(db)

    expect(second).toEqual(first)
    const { rows } = await db.query(
      `SELECT id::text, organization_id::text AS owner, programme_type::text AS type,
              status::text AS status, metadata
         FROM programmes ORDER BY id`,
    )
    expect(rows).toEqual([
      { id: SEED_CHALLENGE, owner: CHAPTER_01, type: 'CHALLENGE', status: 'DRAFT', metadata: {} },
      { id: SEED_PROGRAMME, owner: CHAPTER_01, type: 'PROGRAMME', status: 'PUBLISHED', metadata: {} },
    ])
    expect(first.programme_application_forms!.n).toBe(1)
  })

  it('(4) every programme has exactly one owning organization, an operational unit', async () => {
    const defs = await constraints(db)
    expect(defs.programmes_organization_id_fkey).toBe(
      'FOREIGN KEY (organization_id) REFERENCES organizations(id)',
    )
    const { rows } = await db.query<{ type: string; n: number }>(
      `SELECT o.type::text AS type, count(*)::int AS n
         FROM programmes p JOIN organizations o ON o.id = p.organization_id
        GROUP BY o.type ORDER BY o.type`,
    )
    expect(rows).toEqual([{ type: 'CHAPTER', n: 2 }])
  })

  it('(8) refuses a programme without an owner, with an unknown owner, or an owner deleted under it', async () => {
    await db.query('BEGIN')
    try {
      expect(
        await refused(
          db,
          `INSERT INTO programmes (organization_id, programme_type, slug, name)
           VALUES (NULL, 'PROGRAMME', 'prod02-no-owner', 'X')`,
        ),
      ).toMatchObject({ code: '23502' })
      expect(
        await refused(
          db,
          `INSERT INTO programmes (organization_id, programme_type, slug, name)
           VALUES ('99999999-9999-9999-9999-999999999999', 'PROGRAMME', 'prod02-unknown-owner', 'X')`,
        ),
      ).toEqual({ code: '23503', constraint: 'programmes_organization_id_fkey' })

      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO organizations (type, slug, name, status)
         VALUES ('CLB', 'prod02-owner', 'CLB 015', 'PUBLISHED') RETURNING id::text`,
      )
      await insertProgramme(db, { organization: rows[0]!.id })
      expect(await refused(db, 'DELETE FROM organizations WHERE id = $1', [rows[0]!.id])).toEqual({
        code: '23503',
        constraint: 'programmes_organization_id_fkey',
      })
    } finally {
      await db.query('ROLLBACK')
    }
  })

  it('(6) persists CLOSED, on insert and as a transition, and refuses a label outside the domain', async () => {
    const closed = (await insertProgramme(db, { status: 'CLOSED' })).rows[0]!.id
    const draft = (await insertProgramme(db, { status: 'DRAFT' })).rows[0]!.id
    await db.query(`UPDATE programmes SET status = 'CLOSED' WHERE id = $1`, [draft])

    const { rows } = await db.query<{ id: string; status: string }>(
      `SELECT id::text, status::text FROM programmes WHERE id = ANY($1::uuid[]) ORDER BY status, id`,
      [[closed, draft]],
    )
    expect(rows.map((r) => r.status)).toEqual(['CLOSED', 'CLOSED'])

    await db.query('BEGIN')
    try {
      for (const status of ['LIVE', 'ENDED']) {
        expect(
          await refused(
            db,
            `INSERT INTO programmes (organization_id, programme_type, slug, name, status)
             VALUES ($1, 'PROGRAMME', 'prod02-bad-status', 'X', $2)`,
            [CHAPTER_01, status],
          ),
        ).toMatchObject({ code: '22P02' })
      }
    } finally {
      await db.query('ROLLBACK')
    }
  })

  it('keeps end >= start when both dates are set, and leaves open dates open', async () => {
    await insertProgramme(db, { starts: '2026-11-01T00:00:00Z', ends: '2026-11-01T00:00:00Z' })
    await insertProgramme(db, { starts: '2026-11-01T00:00:00Z', ends: null })
    await insertProgramme(db, { starts: null, ends: '2026-11-01T00:00:00Z' })

    await db.query('BEGIN')
    try {
      expect(
        await refused(
          db,
          `INSERT INTO programmes (organization_id, programme_type, slug, name, starts_at, ends_at)
           VALUES ($1, 'PROGRAMME', 'prod02-inverted', 'X', '2026-11-02T00:00:00Z', '2026-11-01T00:00:00Z')`,
          [CHAPTER_01],
        ),
      ).toEqual({ code: '23514', constraint: 'ck_programmes_dates' })
    } finally {
      await db.query('ROLLBACK')
    }
  })

  it('(9) stores the Challenge problem statements and the journey inside the aggregate', async () => {
    const content = {
      journey: {
        schema_version: 1,
        stages: [
          {
            id: 'stage-1',
            position: 1,
            name: 'Ươm tạo',
            summary: 'Giai đoạn đầu',
            starts_on: '2026-11-01',
            ends_on: '2026-11-30',
          },
        ],
      },
      challenge: {
        schema_version: 1,
        problem_statements: [{ id: 'problem-1', title: 'Bài toán 1', summary: 'Mô tả' }],
      },
    }
    const id = (await insertProgramme(db, { type: 'CHALLENGE', metadata: content })).rows[0]!.id
    // No cardinality rule: a Challenge may hold no problem yet (contract Q7).
    await insertProgramme(db, {
      type: 'CHALLENGE',
      metadata: { challenge: { schema_version: 1, problem_statements: [] } },
    })

    const { rows } = await db.query<{ metadata: unknown }>(
      'SELECT metadata FROM programmes WHERE id = $1',
      [id],
    )
    expect(rows[0]!.metadata).toEqual(content)
  })

  it('(9) refuses problem statements outside a Challenge and content outside the documented shape', async () => {
    const challenge = { challenge: { schema_version: 1, problem_statements: [] } }
    const bad: [string, unknown][] = [
      ['PROGRAMME', challenge],
      ['CHALLENGE', { challenge: { schema_version: 1, problem_statements: {} } }],
      ['CHALLENGE', { challenge: { schema_version: 1 } }],
      ['CHALLENGE', { challenge: [] }],
      ['PROGRAMME', { journey: {} }],
      ['PROGRAMME', { journey: { schema_version: 1, stages: null } }],
      ['PROGRAMME', []],
    ]

    await db.query('BEGIN')
    try {
      for (const [type, metadata] of bad) {
        expect(
          await refused(
            db,
            `INSERT INTO programmes (organization_id, programme_type, slug, name, metadata)
             VALUES ($1, $2, 'prod02-bad-metadata', 'X', $3)`,
            [CHAPTER_01, type, JSON.stringify(metadata)],
          ),
          JSON.stringify([type, metadata]),
        ).toEqual({ code: '23514', constraint: 'ck_programmes_metadata' })
      }
    } finally {
      await db.query('ROLLBACK')
    }
  })

  it('(12) keeps CLOSED and the aggregate content across a reconnect', async () => {
    const before = await snapshot(db)
    await db.end()
    db = await connect(FRESH)

    expect(await snapshot(db)).toEqual(before)
    const { rows } = await db.query<{ closed: number; challenge: number }>(
      `SELECT count(*) FILTER (WHERE status = 'CLOSED')::int AS closed,
              count(*) FILTER (WHERE metadata ? 'challenge')::int AS challenge
         FROM programmes`,
    )
    expect(rows[0]).toEqual({ closed: 2, challenge: 2 })
  })
})

describe('WF04-PROD-02 migration 015 on the schema production holds (014 → 015)', () => {
  let db: Client
  let before: Snapshot
  let tablesBefore: string[]
  let statusLabelsBefore: string[]
  let migrateOutput: string

  beforeAll(async () => {
    await recreate(UPGRADE)
    db = await connect(UPGRADE)
    await applyThrough(db, M014)
    runner(UPGRADE, 'seed')

    // Data an existing database can hold: a legacy ARCHIVED row (a value the
    // column has accepted since 001), a SUBMITTED and a DRAFT application.
    await db.query(
      `INSERT INTO programmes (id, organization_id, programme_type, slug, name, status, starts_at, ends_at)
       VALUES ($1, $2, 'PROGRAMME', 'prod02-legacy-archived', 'Legacy', 'ARCHIVED',
               '2025-01-01T00:00:00Z', '2025-06-01T00:00:00Z')`,
      [LEGACY_ARCHIVED, HUB],
    )
    await db.query(
      `INSERT INTO applications (programme_id, venture_id, primary_applicant_type, status, answers,
                                 question_set_version, created_by_account_id,
                                 submitted_at, submitted_by_account_id, snapshot)
       VALUES ($1, $2, 'STARTUP', 'SUBMITTED', '[{"id":"q-problem","value":"A"}]', 1, $3,
               '2026-09-20T03:00:00Z', $3, '{"venture":{"name":"Demo Startup"}}'),
              ($4, $2, 'TEAM', 'DRAFT', '[]', 1, $3, NULL, NULL, NULL)`,
      [SEED_PROGRAMME, SEED_VENTURE, SEED_ACCOUNT, SEED_CHALLENGE],
    )

    before = await snapshot(db)
    tablesBefore = await tables(db)
    statusLabelsBefore = await labels(db, (await column(db, 'programmes', 'status'))!.udt_name)
    migrateOutput = runner(UPGRADE, 'migrate')
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  it('(2) the runner applies 015 and nothing before it; 001–014 match their recorded checksums', async () => {
    expect(migrateOutput).toContain(`applied ${M015}`)
    expect(migrateOutput.match(/applied /g)).toHaveLength(AFTER_014.length)
    expect(migrateOutput.match(/skip /g)).toHaveLength(14)

    const second = runner(UPGRADE, 'migrate')
    expect(second).toContain(`skip    ${M015} (already applied)`)
    expect(second).not.toContain('applied ')
  })

  it('(3)(5) keeps every programme row and its status, the legacy ARCHIVED one included', async () => {
    expect((await snapshot(db)).programmes).toEqual(before.programmes)
    const { rows } = await db.query<{ id: string; status: string }>(
      'SELECT id::text, status::text FROM programmes ORDER BY id',
    )
    expect(rows).toEqual([
      { id: SEED_CHALLENGE, status: 'DRAFT' },
      { id: SEED_PROGRAMME, status: 'PUBLISHED' },
      { id: LEGACY_ARCHIVED, status: 'ARCHIVED' },
    ])
  })

  it('(7) adds CLOSED only: ARCHIVED was already in the column domain before WF04', async () => {
    expect(statusLabelsBefore).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    const after = await labels(db, 'programme_status')
    expect(after.filter((label) => !statusLabelsBefore.includes(label))).toEqual(['CLOSED'])
    expect(statusLabelsBefore.filter((label) => !after.includes(label))).toEqual([])
    expect(await labels(db, 'publication_status')).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  })

  it('(10) leaves WF05 applications, forms, events and organizations byte-identical', async () => {
    const after = await snapshot(db)
    for (const table of ['applications', 'programme_application_forms', 'events', 'organizations']) {
      expect(after[table], table).toEqual(before[table])
    }
    expect(after.applications!.n).toBe(2)
    // The SUBMITTED application is still final (013 trigger).
    await db.query('BEGIN')
    try {
      expect(
        await refused(db, `UPDATE applications SET answers = '[]' WHERE status = 'SUBMITTED'`),
      ).toMatchObject({ code: '23514' })
    } finally {
      await db.query('ROLLBACK')
    }
  })

  it('(11) adds no table: no second Application, Challenge, Problem or Stage store', async () => {
    const after = await tables(db)
    expect(after.filter((name) => !LATER_TABLES.includes(name))).toEqual(tablesBefore)
    expect(after.filter((name) => /application/.test(name))).toEqual([
      'applications',
      'programme_application_forms',
    ])
    expect(after.filter((name) => /challenge|problem|stage|journey|wf04|_v2$/.test(name))).toEqual([])
  })
})

describe('WF04-PROD-02 migration 015 stops on rows it cannot carry, and rolls back', () => {
  let db: Client

  beforeAll(async () => {
    await recreate(RECOVERY)
    db = await connect(RECOVERY)
    await applyThrough(db, M014)
    runner(RECOVERY, 'seed')
  }, 60_000)

  afterAll(async () => {
    await db?.end()
  })

  async function ledgerAndType() {
    const { rows } = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM schema_migrations')
    return { ledger: rows[0]!.n, status: (await column(db, 'programmes', 'status'))!.udt_name }
  }

  it.each([
    [
      'an ownerless programme',
      `INSERT INTO programmes (id, organization_id, programme_type, slug, name)
       VALUES ('f0150000-0000-0000-0000-0000000000a1', NULL, 'PROGRAMME', 'prod02-orphan', 'X')`,
      '015 stopped: programmes without an owning organization: f0150000-0000-0000-0000-0000000000a1',
    ],
    [
      'an end before the start',
      `INSERT INTO programmes (id, organization_id, programme_type, slug, name, starts_at, ends_at)
       VALUES ('f0150000-0000-0000-0000-0000000000a2', '${CHAPTER_01}', 'PROGRAMME', 'prod02-inverted', 'X',
               '2026-11-02T00:00:00Z', '2026-11-01T00:00:00Z')`,
      '015 stopped: programmes ending before they start: f0150000-0000-0000-0000-0000000000a2',
    ],
    [
      'problem statements on a Programme',
      `INSERT INTO programmes (id, organization_id, programme_type, slug, name, metadata)
       VALUES ('f0150000-0000-0000-0000-0000000000a3', '${CHAPTER_01}', 'PROGRAMME', 'prod02-shape', 'X',
               '{"challenge":{"schema_version":1,"problem_statements":[]}}')`,
      '015 stopped: programme metadata outside the documented shape: f0150000-0000-0000-0000-0000000000a3',
    ],
  ])('STOPS on %s and changes nothing', async (_case, insert, message) => {
    await db.query(insert)
    const before = await snapshot(db)

    expect(runnerFailure(RECOVERY)).toContain(message)
    expect(await ledgerAndType()).toEqual({ ledger: 14, status: 'publication_status' })
    expect(await snapshot(db)).toEqual(before)

    await db.query(`DELETE FROM programmes WHERE id::text LIKE 'f0150000-%'`)
  })

  it('applies once the data is clean; the documented rollback restores the 014 schema with the data', async () => {
    const before = await snapshot(db)
    runner(RECOVERY, 'migrate')
    expect(await ledgerAndType()).toEqual({
      ledger: MIGRATION_FILES.length,
      status: 'programme_status',
    })

    await db.query(documentedRollback())

    // Only 015 leaves the ledger; later migrations do not depend on it.
    expect(await ledgerAndType()).toEqual({
      ledger: MIGRATION_FILES.length - 1,
      status: 'publication_status',
    })
    expect((await column(db, 'programmes', 'organization_id'))!.is_nullable).toBe('YES')
    expect(Object.keys(await constraints(db))).toEqual([
      'programmes_organization_id_fkey',
      'programmes_pkey',
      'programmes_slug_key',
    ])
    expect(await labels(db, 'programme_status')).toEqual([])
    expect(await snapshot(db)).toEqual(before)

    // Recovery: the runner re-applies 015 cleanly.
    expect(runner(RECOVERY, 'migrate')).toContain(`applied ${M015}`)
    expect(await snapshot(db)).toEqual(before)
  })

  it('the rollback refuses while a CLOSED programme exists, and leaves 015 in place', async () => {
    await db.query(`UPDATE programmes SET status = 'CLOSED' WHERE id = $1`, [SEED_CHALLENGE])

    await expect(db.query(documentedRollback())).rejects.toThrow(
      'CLOSED programmes exist; publication_status cannot hold them',
    )
    await db.query('ROLLBACK')
    expect(await ledgerAndType()).toEqual({
      ledger: MIGRATION_FILES.length,
      status: 'programme_status',
    })
  })
})
