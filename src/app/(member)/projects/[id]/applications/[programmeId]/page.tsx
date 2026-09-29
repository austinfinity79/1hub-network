import { notFound, redirect } from 'next/navigation'

import { ApplicationForm } from '@/components/application/application-form'
import { isApiError } from '@/lib/api/errors'
import { getApplicationContext } from '@/lib/application/application'
import { applicationRoutes } from '@/lib/application/routes'
import type { FormStep } from '@/lib/application/types'
import { requireMember } from '@/lib/member/guard'
import { projectDemoRoutes } from '@/lib/project-demo/routes'

/**
 * TASK 24.4 — /projects/:id/applications/:programmeId, SUB1 (L38–L41,
 * DEC-L5-D4). The venture owner only; anyone else, a closed programme or an
 * unreadable venture is the same 404. A submitted application opens SUB3.
 * `?buoc=1..4` selects the step.
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; programmeId: string }>
  searchParams: Promise<{ buoc?: string }>
}) {
  const member = await requireMember()
  const { id, programmeId } = await params
  const { buoc } = await searchParams
  let context
  try {
    context = await getApplicationContext(member.accountId, id, programmeId)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
  if (context.application?.status === 'SUBMITTED')
    redirect(applicationRoutes.submitted(id, programmeId))
  const step = Number(buoc)
  return (
    <ApplicationForm
      ventureId={id}
      programme={context.form.programme}
      questions={context.form.questions}
      team={context.team}
      application={context.application}
      eligibility={context.eligibility}
      initialStep={[1, 2, 3, 4].includes(step) ? (step as FormStep) : null}
      backHref={projectDemoRoutes.detail(id)}
    />
  )
}
