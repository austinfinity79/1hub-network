import { trackEvent } from '@/lib/analytics/analytics'
import { ApiError, unauthenticated } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { withTransaction } from '@/lib/db/client'
import { getLegalState, LEGAL_TYPES } from '@/lib/legal/legal'
import { fileClaimedMemberships } from '@/lib/network/membership-request'
import { computeCompletion, loadCompletionFacts } from '@/lib/profile/completion'

import { claimFilings, type StoredClaim } from './roles'

/**
 * POST /me/onboarding/complete — 05 §4.6, sent by "Hoàn tất hồ sơ" on ACC-09
 * (DEC-L1R-D6, which supersedes the trigger of DEC-WF01-S08-D1).
 *
 * Checks the activation minimum of the four-stage flow: a valid account, the
 * fields ACC-06 marks required (full name, display name, country, province),
 * stages 2 and 3 passed, and acceptance of the CURRENT Terms and Privacy
 * documents. That is the frozen minimum (Freeze D3; 05:474) plus what the
 * board adds. Headline, expertise, avatar, bio, declared roles, membership and
 * the 80% KPI are not requirements. `OnboardingCompletion` is logical: the
 * profile's status and onboarding_completed_at, no table of its own.
 *
 * One transaction with the profile row locked: DRAFT → ACTIVE and the
 * server's timestamp, the membership requests for the HUB units named in
 * stage 3, plus PROFILE_ACTIVATED (audit) and onboarding_completed (analytics)
 * only on the real first transition. Repeats return the same 200 response and
 * change nothing; a failure changes nothing.
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
  full_name: string | null
  display_name: string | null
  country_ok: boolean
  region_ok: boolean
  capability_done: boolean
  role_done: boolean
  claims: StoredClaim[]
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
      `SELECT p.id::text, p.status::text AS status, p.full_name, p.display_name,
              EXISTS (SELECT 1 FROM vocabulary_items v
                       WHERE v.id = p.country_vocab_id AND v.type_code = 'COUNTRY') AS country_ok,
              EXISTS (SELECT 1 FROM vocabulary_items v
                       WHERE v.id = p.region_vocab_id AND v.type_code = 'REGION') AS region_ok,
              p.capability_step_completed_at IS NOT NULL AS capability_done,
              p.role_step_completed_at IS NOT NULL AS role_done,
              p.onboarding_hub_claims AS claims,
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
    if (!profile?.full_name?.trim()) missing.full_name = 'missing'
    if (!profile?.display_name?.trim()) missing.display_name = 'missing'
    if (!profile?.country_ok) missing.country_id = 'missing'
    if (!profile?.region_ok) missing.region_id = 'missing'
    if (!profile?.capability_done) missing.capability_stage = 'missing'
    if (!profile?.role_done) missing.role_stage = 'missing'
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
              onboarding_completed_at = now(), onboarding_hub_claims = '[]'::jsonb,
              updated_at = now()
        WHERE id = $1
        RETURNING status::text AS status`,
      [profile.id],
    )
    // The draft is sent exactly once: the membership request is its record from here on.
    await fileClaimedMemberships(exec, {
      accountId,
      profileId: profile.id,
      claims: claimFilings(profile.claims),
      requestId,
    })
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
