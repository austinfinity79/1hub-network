import { SHARED_DATABASES } from '../../../scripts/db-target.mjs'

/**
 * DB-SAFETY-01 — the database `pnpm test:db` may write to.
 *
 * The DB suite inserts, updates and deletes rows, and its migration tests drop
 * and recreate their own databases. It therefore runs only against an
 * explicitly exported, isolated database: never without DATABASE_URL and never
 * on a shared one (`hubnetwork_p0`). Checked once, before any test connects.
 */
export function assertIsolatedTestDatabase(env: Record<string, string | undefined>): string {
  const url = env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      'DATABASE_URL_REQUIRED: export DATABASE_URL for an isolated test database before `pnpm test:db`.',
    )
  }
  const database = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''))
  if (SHARED_DATABASES.includes(database)) {
    throw new Error(
      `SHARED_DB_TEST_RUN_REFUSED: the DB suite writes and deletes rows; "${database}" is shared. ` +
        'Point DATABASE_URL at an isolated task database.',
    )
  }
  return database
}
