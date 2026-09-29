import path from 'node:path'

import { defineConfig } from '@playwright/test'

import visual from '../visual/visual.config'

/**
 * L1 + L2 business UAT (Thảo, "Use cases: Tài khoản, hồ sơ và quyền").
 * The visual harness's browser, viewport, locale and production server, with
 * its own test directory. Artifacts and the JSON result go to paths Git
 * already ignores.
 *
 *   pnpm exec playwright test --config=tests/uat/uat.config.ts
 */
const VISUAL = path.join(__dirname, '..', 'visual')

export default defineConfig({
  ...visual,
  testDir: path.join(__dirname, 'l1-l2'),
  outputDir: path.join(VISUAL, 'diff', 'uat-l1-l2'),
  reporter: [['list'], ['json', { outputFile: path.join(VISUAL, 'reports', 'uat-l1-l2.json') }]],
})
