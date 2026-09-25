/**
 * M0-T04 — shared gate for development/test-only routes.
 *
 * Extracted from the M0-T02 typography harness so every dev harness is gated
 * the same way instead of each repeating the check.
 *
 * These routes are not production-facing. They return 404 unless
 * ENABLE_DEV_ROUTES=1, which only the dev server and the Playwright visual
 * config set, and none of them appears in the frozen route manifest, so they
 * cannot reach product navigation.
 */
export function devRoutesEnabled(): boolean {
  return process.env.ENABLE_DEV_ROUTES === '1'
}
