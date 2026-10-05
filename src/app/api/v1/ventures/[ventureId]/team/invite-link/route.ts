import { withApi } from '@/lib/api/handler'
import { ensureInviteLink, getInviteLink } from '@/lib/venture/invite-link'
import { teamRequest } from '@/lib/venture/team-route'

/**
 * /api/v1/ventures/{ventureId}/team/invite-link — S1-UAT-07 (US-02.12, FB-18;
 * DEC-S1I; 05 amendment A15). Owner only (`venture:team_manage`).
 *
 * GET  → `{ link: { path, expires_at } | null }`: the live link, if any.
 * POST → `{ link, created }`: the live link, created when none is live.
 * The path is `/moi/{slug}-{token}`; it grants role "Thành viên", level VIEW.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, ventureId } = await teamRequest(request)
  return getInviteLink(accountId, ventureId)
})

export const POST = withApi(async ({ request, requestId }) => {
  const { accountId, ventureId } = await teamRequest(request)
  return ensureInviteLink(accountId, ventureId, requestId)
})
