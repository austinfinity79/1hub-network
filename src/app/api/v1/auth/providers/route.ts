import { withApi } from '@/lib/api/handler'
import { googleConfig } from '@/lib/auth/google'

/**
 * GET /api/v1/auth/providers — 05:234-242.
 *
 * Configured provider entries only; P0 must work when the list is empty.
 * S1-UAT-01: Google is listed when its server-side OAuth client is configured
 * (GOOGLE_OAUTH_CLIENT_ID / _SECRET); the entry names where the flow starts.
 * No other provider is offered (task section 17).
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(() => ({
  providers: googleConfig()
    ? [{ id: 'GOOGLE' as const, start_url: '/api/v1/auth/google/start' }]
    : [],
}))
