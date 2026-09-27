import { AuthSplitLayout } from '@/components/shell/auth-split-layout'

import { AuthEntryForm } from './auth-entry-form'

/**
 * WF01-S01 — /auth. Guest entry to the email magic-link flow; next is WF01-S02.
 * Reference (TASK 22.2): design-reference/final/revision/L1/AUTH1__auth-entry__SOURCE.png
 */
export default function Page() {
  return (
    <AuthSplitLayout>
      <AuthEntryForm />
    </AuthSplitLayout>
  )
}
