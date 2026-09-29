import { redirect } from 'next/navigation'

import { ApplicationReview } from '@/components/application/application-review'
import { findApplication } from '@/lib/application/application'
import { applicationRoutes } from '@/lib/application/routes'
import { requireMember } from '@/lib/member/guard'

/**
 * TASK 24.4 — …/review, SUB2 (L42, DEC-L5-D4). The owner's DRAFT; without one
 * the form opens (anyone who is not the owner lands there and gets its 404); a
 * submitted application opens SUB3.
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; programmeId: string }>
}) {
  const member = await requireMember()
  const { id, programmeId } = await params
  const application = await findApplication(member.accountId, id, programmeId)
  if (!application) redirect(applicationRoutes.form(id, programmeId))
  if (application.status === 'SUBMITTED') redirect(applicationRoutes.submitted(id, programmeId))
  return <ApplicationReview application={application} ventureId={id} />
}
