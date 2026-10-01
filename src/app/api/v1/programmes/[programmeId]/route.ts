import { withApi } from '@/lib/api/handler'
import { getProgramme, updateProgramme } from '@/lib/programme/programme'
import { programmeRequest } from '@/lib/programme/request'

/**
 * GET / PATCH /api/v1/programmes/{programmeId} — 05 §22 (amendment A5).
 * GET: `programme:read` on the owning organization; the aggregate, its linked
 * events (read only) and its registration form. PATCH: `programme:manage`;
 * name, summary, dates, stages, problem statements (CHALLENGE) in DRAFT or
 * PUBLISHED; type and owner are immutable. Unknown, malformed and out-of-scope
 * ids are the same 404.
 */
export const dynamic = 'force-dynamic'

export const GET = withApi(async ({ request }) => {
  const { accountId, programmeId } = await programmeRequest(request)
  return getProgramme(accountId, programmeId)
})

export const PATCH = withApi(async ({ request, requestId }) => {
  const { accountId, programmeId } = await programmeRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return updateProgramme(accountId, programmeId, body, requestId)
})
