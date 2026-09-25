import { defineConfig } from '@playwright/test'
import path from 'node:path'

/**
 * Playwright visual/foundation harness.
 *
 * Playwright is the authoritative browser automation tool for this project; see
 * docs/implementation/browser-testing-rule.md. Nothing verified through a
 * browser extension counts as evidence.
 *
 * M0-T02b establishes this config and the typography foundation spec only.
 * Manifest-driven pixel comparison against design-reference/final belongs to
 * M0-T11 and is deliberately not implemented here.
 *
 * BASELINE RULE: design-reference/final is read-only design evidence. This
 * harness never reads from or writes to it. Baselines under tests/visual/baseline
 * belong to the harness itself and guard the foundation against regression; they
 * are not approved design baselines.
 */
// Playwright loads this config as CommonJS, so import.meta is unavailable.
const HERE = __dirname
const PORT = Number(process.env.VISUAL_PORT ?? 3972)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: path.join(HERE, 'specs'),

  // Playwright writes failure artifacts here, including <name>-diff.png.
  outputDir: path.join(HERE, 'diff'),

  // Harness-owned baselines, kept well away from design-reference/final.
  snapshotPathTemplate: path.join(HERE, 'baseline', '{arg}{ext}'),

  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(HERE, 'reports', 'html'), open: 'never' }],
    ['json', { outputFile: path.join(HERE, 'reports', 'results.json') }],
  ],

  use: {
    baseURL: BASE_URL,

    // Frozen capture conditions from the Design SOT and the QA architecture.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
    reducedMotion: 'reduce',

    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium-1440x900', use: { browserName: 'chromium' } }],

  // Serves the production build, not the dev server, so what is captured is
  // what ships. `pnpm build` stays an explicit step.
  webServer: {
    command: `PORT=${PORT} pnpm start`,
    // The typography harness is gated to dev/test only and 404s in production.
    // The suite is the sanctioned test context, so it opts in explicitly.
    env: {
      ENABLE_DEV_ROUTES: '1',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://hubnetwork:hubnetwork_local_dev@localhost:55432/hubnetwork_p0',
    },
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
