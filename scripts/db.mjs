/**
 * M0-T06A — database lifecycle commands.
 *
 * Usage: node scripts/db.mjs <migrate|seed|reset|introspect|status>
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
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MIGRATIONS_DIR = join(ROOT, 'db', 'migrations')
const SEED_FILE = join(ROOT, 'db', 'seed', 'seed_dev.sql')

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://hubnetwork:hubnetwork_local_dev@localhost:55432/hubnetwork_p0'

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
    console.log('  seeded  db/seed/seed_dev.sql')
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

const COMMANDS = { migrate, seed, reset, status, introspect }

const command = process.argv[2]
if (!command || !(command in COMMANDS)) {
  console.error(`usage: node scripts/db.mjs <${Object.keys(COMMANDS).join('|')}>`)
  process.exit(1)
}

try {
  await COMMANDS[command]()
} catch (error) {
  console.error(`db ${command} failed: ${error.message}`)
  process.exit(1)
}
