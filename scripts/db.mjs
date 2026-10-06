/**
 * M0-T06A — database lifecycle commands.
 *
 * Usage: node scripts/db.mjs <migrate|seed|catalog|demo|reset|introspect|status>
 *
 * TARGET RULE (DB-SAFETY-01, scripts/db-target.mjs): migrate, seed and reset
 * need an explicitly exported DATABASE_URL and never fall back to a default;
 * reset on the shared `hubnetwork_p0` also needs --confirm-shared-db=hubnetwork_p0
 * on the command line. The target is printed before anything is written.
 *
 * MIGRATION RULE: db/migrations/001_p0_init.sql is applied byte-for-byte, in a
 * single transaction, and is never edited. CLAUDE.md:80 requires additive
 * migrations and forbids rewriting an applied one. This runner therefore has no
 * "fix up" path: if the frozen SQL is wrong, the answer is a new numbered
 * migration, not a patched runner.
 *
 * A schema_migrations ledger records what has been applied, so `migrate` is
 * idempotent and a second run is a no-op rather than an error.
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { DbTargetError, maskUrl, resolveDbTarget } from './db-target.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
// seed_dev.sql is frozen evidence and stays byte-identical; it is neither read
// nor applied. M0-T07 replaced it because it contradicted its own README:
// non-deterministic ids and timestamps, and two inserts that duplicated on a
// second run. The deterministic fixture set supersedes it.
const SEED_FILE = join(ROOT, 'db', 'seed', 'seed_p0_deterministic.sql')
// S1-UAT-03 (DEC-S1O): the Sprint 1 canonical catalogue (countries, Vietnamese
// provinces, HUB Network Tổng · 13 Chapters · 55 CLBs). `seed` applies it after
// the fixtures; `catalog` applies it alone, for an environment that keeps its
// own data (UAT, production). Idempotent.
const CATALOG_FILE = join(ROOT, 'db', 'seed', 'catalog_sprint1.sql')

// DEMO-0710 (docs/demo-0710/DEMO_DATA_CONTRACT.md): the deterministic demo
// ventures of the 07/10 demo. Never part of `seed`; `demo` applies it alone,
// after the catalogue, on a demo / visual-QA database only. Idempotent.
const DEMO_FILE = join(ROOT, 'db', 'seed', 'demo_0710.sql')

/** Set once, before any command runs (see the end of this file). */
let DATABASE_URL

const LEDGER = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    text PRIMARY KEY,
    sha256      text NOT NULL,
    applied_at  timestamptz NOT NULL DEFAULT now()
  )
`

async function withClient(fn) {
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort()
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

async function migrate() {
  await withClient(async (client) => {
    await client.query(LEDGER)

    for (const filename of migrationFiles()) {
      const sql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8')
      const checksum = sha256(sql)

      const { rows } = await client.query(
        'SELECT sha256 FROM schema_migrations WHERE filename = $1',
        [filename],
      )

      if (rows.length > 0) {
        // An applied migration that changed on disk means the frozen file was
        // edited. Refuse loudly rather than silently diverging from what the
        // database actually contains.
        if (rows[0].sha256 !== checksum) {
          throw new Error(
            `${filename} was modified after being applied. Applied migrations are immutable; add a new numbered migration instead.`,
          )
        }
        console.log(`  skip    ${filename} (already applied)`)
        continue
      }

      // The frozen file opens with BEGIN and ends with COMMIT, so it manages
      // its own transaction; it is sent verbatim.
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations(filename, sha256) VALUES ($1, $2)', [
        filename,
        checksum,
      ])
      console.log(`  applied ${filename}`)
    }
  })
}

async function seed() {
  const sql = readFileSync(SEED_FILE, 'utf8')

  await withClient(async (client) => {
    await client.query(sql)
    console.log(`  seeded  ${relative(ROOT, SEED_FILE)}`)
  })
  await catalog()
}

async function catalog() {
  const sql = readFileSync(CATALOG_FILE, 'utf8')

  await withClient(async (client) => {
    await client.query(sql)
    console.log(`  applied ${relative(ROOT, CATALOG_FILE)}`)
  })
}

async function demo() {
  const sql = readFileSync(DEMO_FILE, 'utf8')

  await withClient(async (client) => {
    await client.query(sql)
    console.log(`  applied ${relative(ROOT, DEMO_FILE)}`)
  })
}

/**
 * Drops and recreates the public schema, then migrates and seeds. Local only:
 * CLAUDE.md:80 forbids rewriting applied migrations in a real environment, and
 * this destroys data.
 */
async function reset() {
  await withClient(async (client) => {
    await client.query('DROP SCHEMA public CASCADE')
    await client.query('CREATE SCHEMA public')
    console.log('  dropped public schema')
  })
  await migrate()
  await seed()
}

async function status() {
  await withClient(async (client) => {
    const version = await client.query('SHOW server_version')
    const tables = await client.query(
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    )
    console.log(`  server_version ${version.rows[0].server_version}`)
    console.log(`  tables         ${tables.rows[0].n}`)

    const applied = await client
      .query('SELECT filename, applied_at FROM schema_migrations ORDER BY filename')
      .catch(() => ({ rows: [] }))
    for (const row of applied.rows) {
      console.log(`  applied        ${row.filename} at ${row.applied_at.toISOString()}`)
    }
  })
}

/** Dumps the live schema as JSON, so the audit compares against reality. */
async function introspect() {
  const report = await withClient(async (client) => {
    const enums = await client.query(`
      SELECT t.typname AS name, array_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname
    `)

    const columns = await client.query(`
      SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `)

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const rowCounts = {}
    for (const { table_name } of tables.rows) {
      const { rows } = await client.query(`SELECT count(*)::int AS n FROM "${table_name}"`)
      rowCounts[table_name] = rows[0].n
    }

    return {
      server_version: (await client.query('SHOW server_version')).rows[0].server_version,
      tables: tables.rows.map((r) => r.table_name),
      enums: Object.fromEntries(enums.rows.map((r) => [r.name, r.values])),
      row_counts: rowCounts,
      columns: columns.rows,
    }
  })

  console.log(JSON.stringify(report, null, 2))
}

const COMMANDS = { migrate, seed, catalog, demo, reset, status, introspect }

const command = process.argv[2]
if (!command || !(command in COMMANDS)) {
  console.error(`usage: node scripts/db.mjs <${Object.keys(COMMANDS).join('|')}>`)
  process.exit(1)
}

// Decided before any connection: a refusal leaves every database untouched.
let target
try {
  target = resolveDbTarget(command, { env: process.env, argv: process.argv.slice(3) })
} catch (error) {
  if (!(error instanceof DbTargetError)) throw error
  console.error(`db ${command} refused: ${error.message}`)
  process.exit(2)
}
DATABASE_URL = target.url
if (target.commandClass !== 'READ_ONLY') {
  console.log(`  TARGET_DB       ${maskUrl(target.url)}`)
  console.log(`  TARGET_HOST     ${target.host}`)
  console.log(`  TARGET_DATABASE ${target.database}`)
  console.log(`  COMMAND_CLASS   ${target.commandClass}`)
}

try {
  await COMMANDS[command]()
} catch (error) {
  console.error(`db ${command} failed: ${error.message}`)
  process.exit(1)
}
