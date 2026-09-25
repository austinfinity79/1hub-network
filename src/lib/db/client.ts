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

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params as unknown[])
  return result.rows as T[]
}

export async function closePool(): Promise<void> {
  const pool = globalThis.__hubnetworkPool
  if (!pool) return
  globalThis.__hubnetworkPool = undefined
  await pool.end()
}
