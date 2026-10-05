import { spawnSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Client } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { databaseUrl } from './client'

/**
 * DB-SAFETY-01 — the runner against a real, throwaway database derived from
 * the isolated test database (never the shared one: the DB suite refuses it).
 */

const RUNNER = fileURLToPath(new URL('../../../scripts/db.mjs', import.meta.url))
const MIGRATIONS = readdirSync(fileURLToPath(new URL('../../../db/migrations', import.meta.url)))
  .filter((name) => name.endsWith('.sql'))
  .sort()
const SCRATCH = 'hubnetwork_dbsafety_scratch'

function urlFor(database: string): string {
  const url = new URL(databaseUrl())
  url.pathname = `/${database}`
  return url.toString()
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

async function onScratch<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: urlFor(SCRATCH) })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

function run(args: string[], databaseUrl?: string) {
  // The parent's database settings never leak into the child: only what the test names.
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key === 'DATABASE_URL' || key.startsWith('PG')) delete env[key]
  }
  if (databaseUrl) env.DATABASE_URL = databaseUrl
  return spawnSync(process.execPath, [RUNNER, ...args], { env, encoding: 'utf8' })
}

beforeAll(async () => {
  await onAdmin(`DROP DATABASE IF EXISTS ${SCRATCH} WITH (FORCE)`)
  await onAdmin(`CREATE DATABASE ${SCRATCH}`)
})

afterAll(async () => {
  await onAdmin(`DROP DATABASE IF EXISTS ${SCRATCH} WITH (FORCE)`)
})

describe('db.mjs against a real isolated database', () => {
  it('C/E: an explicit isolated reset runs, printing the target before dropping anything', () => {
    const result = run(['reset'], urlFor(SCRATCH))
    expect(result.status, result.stderr).toBe(0)
    const lines = result.stdout.split('\n')
    const target = lines.findIndex((l) => l.includes(`TARGET_DATABASE ${SCRATCH}`))
    const dropped = lines.findIndex((l) => l.includes('dropped public schema'))
    expect(target).toBeGreaterThanOrEqual(0)
    expect(dropped).toBeGreaterThan(target)
  })

  it('C: the reset left the full migration ledger', async () => {
    const files = await onScratch(async (c) =>
      (await c.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map(
        (r) => r.filename,
      ),
    )
    expect(files.sort()).toEqual(MIGRATIONS)
  })

  it('A: a refused reset changes nothing in the database it could have reached', async () => {
    await onScratch((c) => c.query('CREATE TABLE dbsafety_marker (id int); INSERT INTO dbsafety_marker VALUES (1)'))
    const refused = run(['reset'])
    expect(refused.status).toBe(2)
    expect(refused.stderr).toMatch(/DATABASE_URL_REQUIRED_FOR_DESTRUCTIVE_DB_COMMAND/)
    const marker = await onScratch(async (c) => (await c.query('SELECT id FROM dbsafety_marker')).rows)
    expect(marker).toEqual([{ id: 1 }])
  })

  it('D: read-only status still works against an explicit database', () => {
    const result = run(['status'], urlFor(SCRATCH))
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/server_version/)
    expect(result.stdout).not.toMatch(/TARGET_DB/)
  })
})
