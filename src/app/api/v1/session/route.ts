import { withApi } from '@/lib/api/handler'
import type { SessionDTO } from '@/lib/api/types'

/**
 * GET /api/v1/session — 05:113-149.
 *
 * App bootstrap. The contract permits either 200 {authenticated:false} or 401
 * when unauthenticated and requires one to be chosen consistently; this takes
 * the contract's own recommendation of 200.
 *
 * M0-T05 SCOPE: there is no session store and no database yet (M0-T06 and
 * M0-T08), so this always reports unauthenticated. It is the real contract
 * shape, not a stub with invented data: returning a fabricated account would be
 * a fake success path.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi<SessionDTO>(() => {
  return { authenticated: false }
})
