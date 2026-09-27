import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { getOnboardingState } from '@/lib/onboarding/state'
import { getProfileCompletion } from '@/lib/profile/completion'

import { CompleteView, EXIT_SLOT_ID } from './complete-view'

/**
 * WF01-S08 — /onboarding/complete. Next: WF02-S01 /me.
 * Reference (TASK 22.2, ACC-10 subset): design-reference/final/revision/L1/ACC-10__onboarding-complete__SOURCE.png
 * Decisions DEC-WF01-S08-D1..D8.
 *
 * No session → /auth. Unlike S05–S07, a completed account is NOT sent away:
 * S08 stays viewable (refresh, revisit). A not-yet-completed account gets the
 * view in its pending state, which performs POST /me/onboarding/complete and
 * shows success only after the server confirms (D1). The Challenge, Project
 * and Chapter cards are not rendered (D2–D4); the only exit is /me (D6), drawn
 * by ACC-10 as the header's "Vào Tài khoản của tôi" and shown only once the
 * server confirms completion. The onboarding shell and its stepper stay: the
 * revision's 4-step header belongs to the Bucket B flow (HD-02, DEC-L1-D7).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')

  const state = await getOnboardingState(session.accountId)
  const initial = state.completed
    ? ({ kind: 'done', percent: (await getProfileCompletion(session.accountId)).percent } as const)
    : ({ kind: 'pending' } as const)

  return (
    <OnboardingShell currentStep={4} action={<div id={EXIT_SLOT_ID} />}>
      <CompleteView initial={initial} />
    </OnboardingShell>
  )
}
