/**
 * WF01-S05 — the P0 allowlist for OnboardingIntent.primary_intent.
 *
 * DEC-WF01-S05-D1 (docs/decisions/DECISION_LOG.md). The API contract makes the
 * value config-backed and freezes no enum; this is the human-approved P0 launch
 * set. INVESTOR is deliberately absent: investor/VC/dataroom is Future scope.
 *
 * Browser-safe (no imports), so the form and the server share one list.
 */
export const PRIMARY_INTENTS = [
  'SUBMIT_SOLUTION',
  'POST_CHALLENGE',
  'ORGANIZE_COMMUNITY',
  'EXPLORE_NETWORK',
] as const

export type PrimaryIntent = (typeof PRIMARY_INTENTS)[number]

/** Exact match only: no trimming, case folding or label coercion. */
export function isPrimaryIntent(value: unknown): value is PrimaryIntent {
  return typeof value === 'string' && (PRIMARY_INTENTS as readonly string[]).includes(value)
}
