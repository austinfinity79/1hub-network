import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * M0-T01 — unit/integration test harness.
 *
 * Playwright owns E2E and the pixel harness (M0-T11) and is configured
 * separately, so this config deliberately excludes those directories.
 *
 * tsconfig sets "jsx": "preserve" because Next.js owns the app build, so the
 * test transform must select the automatic runtime itself. Without this,
 * esbuild emits classic React.createElement calls and every component test
 * fails with "React is not defined".
 */
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['node_modules/**', '.next/**', 'tests/e2e/**', 'tests/visual/**'],
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
