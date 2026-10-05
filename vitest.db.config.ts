import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * M0-T06A — integration tests that need a live PostgreSQL.
 *
 * Kept out of `pnpm test` on purpose: the main gate must stay hermetic and
 * runnable without Docker. Run with `pnpm db:up && pnpm test:db`.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.db-test.ts'],
    // A shared database cannot take parallel writers.
    fileParallelism: false,
    // DB-SAFETY-01: refuses a missing DATABASE_URL or the shared dev database.
    setupFiles: ['src/lib/db/db-test-setup.ts'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
