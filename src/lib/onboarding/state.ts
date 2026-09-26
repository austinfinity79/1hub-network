import { ApiError } from '@/lib/api/errors'
import { query, type Executor } from '@/lib/db/client'
import { getLegalState } from '@/lib/legal/legal'
import { loadCompletionFacts } from '@/lib/profile/completion'
import { profileStepComplete } from '@/lib/profile/profile'

import { isPrimaryIntent, type PrimaryIntent } from './intent'

/**
 * WF01 onboarding state — the ONE server-side resolver (DEC-WF01-RESUME-D1).
 *
 * Used by GET /me/onboarding, PUT /me/onboarding/intent, the sign-in
 * `next_step` (consumeMagicLink), `/session` and the onboarding page guards.
 * Derived only from persisted canonical data; nothing the client sends can
 * move it. First incomplete step, in the frozen WF01 order:
 *
 *   DONE      status ACTIVE and onboarding_completed_at set          → /me
 *   PURPOSE   purpose_step_completed_at NULL (S05 never completed)   → /onboarding/purpose
 *   PROFILE   S06 progression fields missing (DEC-WF01-S06-D2)      → /onboarding/profile
 *   PRIVACY   current Terms or Privacy not accepted (by document)   → /onboarding/privacy
 *   COMPLETE  everything above done, S08 not yet run                → /onboarding/complete
 *
 * `primary_intent` may stay NULL for good: skipping S05 records the step,
 * never an intent (DEC-WF01-S05-D3 as amended by DEC-WF01-RESUME-D1).
 */

export type OnboardingStep = 'PURPOSE' | 'PROFILE' | 'PRIVACY' | 'COMPLETE'

export type OnboardingState = {
  completed: boolean
  /** Null once onboarding is complete, as in the consume response. */
  current_step: OnboardingStep | null
  intent: PrimaryIntent | null
}

export const STEP_ROUTES: Record<OnboardingStep, string> = {
  PURPOSE: '/onboarding/purpose',
  PROFILE: '/onboarding/profile',
  PRIVACY: '/onboarding/privacy',
  COMPLETE: '/onboarding/complete',
}

/** Where the account belongs now: its current step, or /me when done. */
export function routeFor(state: OnboardingState): string {
  return state.current_step ? STEP_ROUTES[state.current_step] : '/me'
}

type Row = {
  status: string
  primary_intent: string | null
  purpose_done: boolean
  onboarding_completed_at: Date | null
}

export async function getOnboardingState(
  accountId: string,
  exec: Executor = query,
): Promise<OnboardingState> {
  const [row] = await exec<Row>(
    `SELECT status::text AS status, primary_intent,
            purpose_step_completed_at IS NOT NULL AS purpose_done, onboarding_completed_at
       FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
  // A stored value outside the P0 allowlist is not surfaced as a selection.
  const intent = isPrimaryIntent(row?.primary_intent) ? row!.primary_intent : null
  const done = row?.status === 'ACTIVE' && Boolean(row.onboarding_completed_at)
  if (done) return { completed: true, current_step: null, intent }

  let step: OnboardingStep
  if (!row?.purpose_done) step = 'PURPOSE'
  else if (!profileStepComplete(await loadCompletionFacts(accountId, exec))) step = 'PROFILE'
  else if (!(await getLegalState(accountId, exec)).satisfied) step = 'PRIVACY'
  else step = 'COMPLETE'
  return { completed: false, current_step: step, intent }
}

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Purpose step request is not valid.', {
    [field]: reason,
  })

/**
 * PUT /me/onboarding/intent (05 §4.2, amended by DEC-WF01-RESUME-D1).
 *
 *   { "action": "SAVE", "primary_intent": "<P0 code>" }   (action may be omitted: frozen shape)
 *   { "action": "SKIP" }                                   "Bỏ qua, làm sau"
 *
 * SAVE stores the intent (exact allowlist, DEC-WF01-S05-D1); SKIP stores no
 * intent and leaves an existing one untouched. Both record the Purpose step
 * once (`purpose_step_completed_at`, server time, never reset). Any other
 * field — a client timestamp included — is refused. The first write creates
 * the DRAFT profile; UNIQUE account_id keeps it one per account.
 */
export async function submitPurpose(accountId: string, body: unknown): Promise<OnboardingState> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('body', 'invalid')
  }
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (key !== 'action' && key !== 'primary_intent') throw invalid(key, 'not_accepted')
  }
  const action = input.action ?? 'SAVE'

  if (action === 'SKIP') {
    if ('primary_intent' in input) throw invalid('primary_intent', 'not_allowed_with_skip')
    await query(
      `INSERT INTO individual_profiles (account_id, purpose_step_completed_at) VALUES ($1, now())
       ON CONFLICT (account_id) DO UPDATE
         SET purpose_step_completed_at =
               COALESCE(individual_profiles.purpose_step_completed_at, now()),
             updated_at = now()`,
      [accountId],
    )
    return getOnboardingState(accountId)
  }
  if (action !== 'SAVE') throw invalid('action', 'unsupported')
  if (!isPrimaryIntent(input.primary_intent)) {
    throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Unsupported primary intent.', {
      primary_intent: 'unsupported',
    })
  }
  await query(
    `INSERT INTO individual_profiles (account_id, primary_intent, purpose_step_completed_at)
     VALUES ($1, $2, now())
     ON CONFLICT (account_id) DO UPDATE
       SET primary_intent = EXCLUDED.primary_intent,
           purpose_step_completed_at =
             COALESCE(individual_profiles.purpose_step_completed_at, now()),
           updated_at = now()`,
    [accountId, input.primary_intent],
  )
  return getOnboardingState(accountId)
}

/** Frozen-shape helper kept for callers that only save an intent. */
export async function setPrimaryIntent(
  accountId: string,
  value: unknown,
): Promise<OnboardingState> {
  return submitPurpose(accountId, { action: 'SAVE', primary_intent: value })
}
