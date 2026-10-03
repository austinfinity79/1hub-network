import { redirect } from 'next/navigation'

import { ApplicationSubmitted } from '@/components/application/application-submitted'
import { findApplication } from '@/lib/application/application'
import { applicationRoutes } from '@/lib/application/routes'
import { requireMember } from '@/lib/member/guard'

/**
 * TASK 24.4 — …/submitted, SUB3 (L43, DEC-L5-D4), read from the snapshot only.
 * Without a submitted application of the owner, the form opens (and gives
 * anyone else its 404).
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; programmeId: string }>
}) {
  const { id, programmeId } = await params
  const member = await requireMember(applicationRoutes.submitted(id, programmeId))
  const application = await findApplication(member.accountId, id, programmeId)
  if (application?.status !== 'SUBMITTED') redirect(applicationRoutes.form(id, programmeId))
  return <ApplicationSubmitted application={application} ventureId={id} />
}
