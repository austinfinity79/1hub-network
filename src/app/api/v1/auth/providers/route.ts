import { withApi } from '@/lib/api/handler'

/**
 * GET /api/v1/auth/providers — 05:234-242.
 *
 * P0 must work when this returns an empty list, and no provider is configured.
 * No OAuth, SSO or OTP is implemented: none is in the frozen P0 design, and the
 * future 1Hub identity/CCCD integration attaches behind this boundary later.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(() => ({ providers: [] as const }))
