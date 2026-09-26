import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { getOnboardingState } from '@/lib/onboarding/state'

import { PurposeForm } from './purpose-form'
import { SkipPurpose } from './skip-purpose'

/**
 * WF01-S05 — /onboarding/purpose. Next: WF01-S06 /onboarding/profile.
 * Approved baseline: design-reference/final/WF01/WF01-S05__onboarding-purpose__1440x900.png
 *
 * Server-authoritative guard (DEC-WF01-S05-D5): no session → /auth. Completed
 * onboarding → /me, the existing WF01 rule (D6). The saved intent, if any, is
 * read here so the form starts in the right state (D4, D6).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')

  const state = await getOnboardingState(session.accountId)
  if (state.completed) redirect('/me')

  return (
    <OnboardingShell
      currentStep={1}
      // DEC-WF01-S05-D3 / DEC-WF01-RESUME-D1: skip THIS step only; no intent,
      // but the server records the step so resume lands on S06.
      action={<SkipPurpose />}
    >
      <PurposeForm initialIntent={state.intent} />
    </OnboardingShell>
  )
}
