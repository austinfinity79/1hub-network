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
  const { id, programmeId } = await params
  const member = await requireMember(applicationRoutes.review(id, programmeId))
  const application = await findApplication(member.accountId, id, programmeId)
  if (!application) redirect(applicationRoutes.form(id, programmeId))
  if (application.status === 'SUBMITTED') redirect(applicationRoutes.submitted(id, programmeId))
  // A draft that can no longer be submitted (closed programme, archived venture)
  // reads on the form, read only with its reason: no enabled submit (WF05-PROD-04).
  if (!application.editable) redirect(applicationRoutes.form(id, programmeId))
  return <ApplicationReview application={application} ventureId={id} />
}
