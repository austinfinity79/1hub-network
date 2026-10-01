import { withApi } from '@/lib/api/handler'
import { putProgrammeRegistration } from '@/lib/programme/programme'
import { programmeRequest } from '@/lib/programme/request'

/**
 * PUT /api/v1/programmes/{programmeId}/registration — 05 §22 (amendment A5).
 * Replaces the canonical form WF05 reads (`programme_application_forms`); a
 * change bumps `version`; refused with 409 once applications exist (Q3).
 */
export const dynamic = 'force-dynamic'

export const PUT = withApi(async ({ request, requestId }) => {
  const { accountId, programmeId } = await programmeRequest(request)
  const body: unknown = await request.json().catch(() => null)
  return putProgrammeRegistration(accountId, programmeId, body, requestId)
})
