import { AuthSplitLayout } from '@/components/shell/auth-split-layout'

import { CheckEmailCard } from './check-email-card'

/**
 * WF01-S02 — /auth/check-email. Confirms the link was sent; resend or change
 * email. Next: WF01-S03 (callback) or WF01-S04 (errors).
 * Reference (TASK 22.2): design-reference/final/revision/L1/AUTH2__check-email__SOURCE.png
 */
export default function Page() {
  return (
    <AuthSplitLayout>
      <CheckEmailCard />
    </AuthSplitLayout>
  )
}
