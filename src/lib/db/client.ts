import { Pool } from 'pg'

/**
 * M0-T06A — application PostgreSQL access.
 *
 * A single pooled client, reused across hot reloads in development so the dev
 * server does not exhaust connections on every file change.
 *
 * This layer intentionally exposes only a query function. The frozen contract
 * forbids returning ORM rows to clients (05:16), so the boundary between a row
 * and a DTO is drawn in the API layer, not here.
 */
declare global {
  var __hubnetworkPool: Pool | undefined
}

export function databaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not set. See .env.example.')
  }
  return url
}

export function getPool(): Pool {
  if (!globalThis.__hubnetworkPool) {
    globalThis.__hubnetworkPool = new Pool({
      connectionString: databaseUrl(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  }
  return globalThis.__hubnetworkPool
}

/**
 * How every data-access function talks to PostgreSQL.
 *
 * Taking an `Executor` rather than importing `query` directly is what lets a
 * function run either on its own or inside a caller's transaction, without the
 * function knowing which. M0-T10 depends on this: an idempotency claim and the
 * mutation it guards must commit or roll back together.
 */
export type Executor = <T extends Record<string, unknown>>(
  text: string,
  params?: readonly unknown[],
) => Promise<T[]>

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params as unknown[])
  return result.rows as T[]
}

/**
 * Runs `fn` inside a single transaction on a single pooled connection.
 *
 * Rollback on any throw is the mechanism M0-T10 relies on to guarantee that a
 * failed attempt leaves no claimed key behind: the claim row was written in the
 * same transaction, so it disappears with the work it was guarding. That is why
 * there is no lease, no reclamation timer and no FAILED state to sweep.
 */
export async function withTransaction<T>(fn: (exec: Executor) => Promise<T>): Promise<T> {
  const client = await getPool().connect()

  const exec: Executor = async (text, params = []) => {
    const result = await client.query(text, params as unknown[])
    return result.rows
  }

  try {
    await client.query('BEGIN')
    const value = await fn(exec)
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function closePool(): Promise<void> {
  const pool = globalThis.__hubnetworkPool
  if (!pool) return
  globalThis.__hubnetworkPool = undefined
  await pool.end()
}
