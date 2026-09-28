import { query } from '@/lib/db/client'
import { devRoutesEnabled } from '@/lib/dev-routes'

import { normalizeEmail } from './tokens'

/**
 * TASK 22-PREVIEW-AUTH — Internal Alpha is invite / pre-provisioned only
 * (DEC-AUTH-EMAIL-D1). An address may receive a link when it already has an
 * account (any status: a blocked account still reaches the AUTH4 blocked state
 * at the callback) or is on the launch roster (`membership_bootstrap`, whose
 * first sign-in creates the account, WF01-REMEDIATION-01).
 *
 * Test seam: with dev routes on (local / CI only, never on a server), review
 * personas on the reserved `@example.test` domain count as provisioned, so the
 * suites keep creating fresh test accounts through the real UI.
 */
export async function isProvisioned(email: string): Promise<boolean> {
  const normalized = normalizeEmail(email)
  const rows = await query<{ ok: number }>(
    `SELECT 1 AS ok FROM user_accounts WHERE email_normalized = $1
      UNION ALL
     SELECT 1 FROM membership_bootstrap WHERE email_normalized = $1 AND consumed_at IS NULL
      LIMIT 1`,
    [normalized],
  )
  if (rows.length > 0) return true
  return devRoutesEnabled() && normalized.endsWith('@example.test')
}
