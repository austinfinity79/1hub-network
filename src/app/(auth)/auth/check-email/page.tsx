import { AuthSplitLayout } from '@/components/shell/auth-split-layout'

import { CheckEmailCard } from './check-email-card'

/**
 * WF01-S02 — /auth/check-email. Confirms the link was sent; resend or change
 * email. Next: WF01-S03 (callback) or WF01-S04 (errors).
 * Approved baseline: design-reference/final/WF01/WF01-S02__check-email__1440x900.png
 */
export default function Page() {
  return (
    <AuthSplitLayout>
      <CheckEmailCard />
    </AuthSplitLayout>
  )
}
