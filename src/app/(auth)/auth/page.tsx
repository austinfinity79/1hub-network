import { AuthSplitLayout } from '@/components/shell/auth-split-layout'
import { googleConfig } from '@/lib/auth/google'
import { getCurrentDocuments } from '@/lib/legal/legal'

import { AuthEntryForm } from './auth-entry-form'

/**
 * WF01-S01 — /auth, the one canonical auth surface (BD-01). S1-UAT-01: username
 * /email + password sign-in, account creation, forgot password and Google
 * (Sprint1 UAT US-01.02 … US-01.05). Shell reference (TASK 22.2):
 * design-reference/final/revision/L1/AUTH1__auth-entry__SOURCE.png
 *
 * Read on the server: whether Google is configured (never the client id or
 * secret) and the CURRENT legal versions the sign-up checkbox accepts, so a
 * stale form is refused by the server (409 LEGAL_DOCUMENT_VERSION_STALE).
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const legal = (await getCurrentDocuments()).map(({ type, version }) => ({ type, version }))
  return (
    <AuthSplitLayout>
      <AuthEntryForm googleAvailable={googleConfig() !== null} legal={legal} />
    </AuthSplitLayout>
  )
}
