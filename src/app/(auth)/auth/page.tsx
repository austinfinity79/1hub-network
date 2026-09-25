import { AuthSplitLayout } from '@/components/shell/auth-split-layout'
import { MAGIC_LINK_EXPIRES_IN_SECONDS } from '@/lib/auth/config'

import { AuthEntryForm } from './auth-entry-form'

/**
 * WF01-S01 — /auth. Guest entry to the email magic-link flow; next is WF01-S02.
 * Approved baseline: design-reference/final/WF01/WF01-S01__auth-entry__1440x900.png
 */
export default function Page() {
  return (
    <AuthSplitLayout>
      <AuthEntryForm expiresInMinutes={MAGIC_LINK_EXPIRES_IN_SECONDS / 60} />
    </AuthSplitLayout>
  )
}
