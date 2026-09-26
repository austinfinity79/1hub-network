import { trackEvent } from '@/lib/analytics/analytics'
import { ApiError, unauthenticated } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { withTransaction } from '@/lib/db/client'
import { getLegalState, LEGAL_TYPES } from '@/lib/legal/legal'
import { computeCompletion, loadCompletionFacts } from '@/lib/profile/completion'

/**
 * POST /me/onboarding/complete — 05 §4.6, WF01-S08 (DEC-WF01-S08-D1..D8).
 *
 * Checks ONLY the frozen activation minimum (Freeze D3; 05:474): a valid
 * account, display_name, a REGION, and acceptance of the CURRENT Terms and
 * Privacy documents. Headline, expertise, avatar, bio, intent, membership and
 * the 80% KPI are not requirements. `OnboardingCompletion` is logical: the
 * profile's status and onboarding_completed_at, no table of its own.
 *
 * One transaction with the profile row locked: DRAFT → ACTIVE and the
 * server's timestamp, plus PROFILE_ACTIVATED (audit) and onboarding_completed
 * (analytics) only on the real first transition. Repeats return the same
 * 200 response and change nothing; a failure changes nothing.
 */

export type CompletionResponse = {
  completed: true
  profile_status: string
  completion_percent: number
  next: '/me'
}

type Row = {
  id: string
  status: string
  display_name: string | null
  region_ok: boolean
  completed_at: Date | null
}

export async function completeOnboarding(
  accountId: string,
  requestId: string,
): Promise<CompletionResponse> {
  return withTransaction(async (exec) => {
    const [account] = await exec<{ status: string }>(
      `SELECT status::text AS status FROM user_accounts WHERE id = $1`,
      [accountId],
    )
    if (account?.status !== 'ACTIVE') throw unauthenticated()

    const [profile] = await exec<Row>(
      `SELECT p.id::text, p.status::text AS status, p.display_name,
              EXISTS (SELECT 1 FROM vocabulary_items v
                       WHERE v.id = p.region_vocab_id AND v.type_code = 'REGION') AS region_ok,
              p.onboarding_completed_at AS completed_at
         FROM individual_profiles p WHERE p.account_id = $1 FOR UPDATE OF p`,
      [accountId],
    )
    if (profile?.status === 'DEACTIVATED') {
      throw new ApiError('PROFILE_DEACTIVATED', 409, 'Profile is deactivated.')
    }

    const respond = async (status: string): Promise<CompletionResponse> => ({
      completed: true,
      profile_status: status,
      completion_percent: computeCompletion(await loadCompletionFacts(accountId, exec)).percent,
      next: '/me',
    })
    // Already completed: idempotent success, nothing rewritten.
    if (profile?.completed_at) return respond(profile.status)

    const missing: Record<string, string> = {}
    if (!profile?.display_name?.trim()) missing.display_name = 'missing'
    if (!profile?.region_ok) missing.region_id = 'missing'
    const legal = await getLegalState(accountId, exec)
    for (const type of LEGAL_TYPES) {
      if (!legal.accepted[type]) missing[type] = 'missing'
    }
    if (!profile || Object.keys(missing).length > 0) {
      throw new ApiError(
        'ONBOARDING_REQUIREMENTS_MISSING',
        422,
        'Onboarding requirements are missing.',
        missing,
      )
    }

    const [updated] = await exec<{ status: string }>(
      `UPDATE individual_profiles
          SET status = CASE WHEN status = 'DRAFT' THEN 'ACTIVE'::profile_status ELSE status END,
              onboarding_completed_at = now(), updated_at = now()
        WHERE id = $1
        RETURNING status::text AS status`,
      [profile.id],
    )
    if (profile.status === 'DRAFT') {
      await writeAudit(exec, {
        actorAccountId: accountId,
        action: 'PROFILE_ACTIVATED',
        resourceType: 'individual_profile',
        resourceId: profile.id,
        before: { status: 'DRAFT' },
        after: { status: 'ACTIVE' },
        requestId,
      })
    }
    await trackEvent(exec, {
      name: 'onboarding_completed',
      accountId,
      profileId: profile.id,
      workflow: 'WF01',
      screenId: 'WF01-S08',
    })
    return respond(updated!.status)
  })
}
