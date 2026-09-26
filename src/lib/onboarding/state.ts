import { ApiError } from '@/lib/api/errors'
import { query } from '@/lib/db/client'

import { isPrimaryIntent, type PrimaryIntent } from './intent'

/**
 * WF01-S05 — onboarding state for GET /me/onboarding and
 * PUT /me/onboarding/intent (05 §4.2).
 *
 * The intent lives on individual_profiles.primary_intent (migration 001). A
 * new account has no profile until its first onboarding write, so that write
 * creates the DRAFT profile; the UNIQUE account_id keeps it one profile per
 * account (Data SOT). No other column is set here.
 */

/** WF01 order: Purpose → Profile → Privacy → Complete. */
export type OnboardingStep = 'PURPOSE' | 'PROFILE'

export type OnboardingState = {
  completed: boolean
  /** Null once onboarding is complete, as in the consume response. */
  current_step: OnboardingStep | null
  intent: PrimaryIntent | null
}

type Row = { primary_intent: string | null; onboarding_completed_at: Date | null }

function toState(row: Row | undefined): OnboardingState {
  const completed = Boolean(row?.onboarding_completed_at)
  // A stored value outside the P0 allowlist is not surfaced as a selection.
  const intent = isPrimaryIntent(row?.primary_intent) ? row!.primary_intent : null
  return {
    completed,
    current_step: completed ? null : intent ? 'PROFILE' : 'PURPOSE',
    intent: intent as PrimaryIntent | null,
  }
}

export async function getOnboardingState(accountId: string): Promise<OnboardingState> {
  const rows = await query<Row>(
    `SELECT primary_intent, onboarding_completed_at FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
  return toState(rows[0])
}

/**
 * Validates against the exact allowlist (DEC-WF01-S05-D1) and stores it. The
 * skip action never calls this: skipping leaves the value NULL (D3).
 */
export async function setPrimaryIntent(
  accountId: string,
  value: unknown,
): Promise<OnboardingState> {
  if (!isPrimaryIntent(value)) {
    throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Unsupported primary intent.', {
      primary_intent: 'unsupported',
    })
  }
  const rows = await query<Row>(
    `INSERT INTO individual_profiles (account_id, primary_intent)
     VALUES ($1, $2)
     ON CONFLICT (account_id) DO UPDATE
       SET primary_intent = EXCLUDED.primary_intent, updated_at = now()
     RETURNING primary_intent, onboarding_completed_at`,
    [accountId, value],
  )
  return toState(rows[0])
}
