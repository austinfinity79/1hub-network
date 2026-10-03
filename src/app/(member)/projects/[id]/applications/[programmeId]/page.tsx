import { notFound, redirect } from 'next/navigation'

import { ApplicationForm } from '@/components/application/application-form'
import { isApiError } from '@/lib/api/errors'
import { getApplicationContext } from '@/lib/application/application'
import { applicationOrigin, applicationRoutes } from '@/lib/application/routes'
import type { FormStep } from '@/lib/application/types'
import { requireMember } from '@/lib/member/guard'
import { projectDemoRoutes } from '@/lib/project-demo/routes'

/**
 * TASK 24.4 — /projects/:id/applications/:programmeId, SUB1 (L38–L41,
 * DEC-L5-D4). The venture owner only; anyone else or an unreadable venture is
 * the same 404; a closed programme opens only the owner's existing draft, read
 * only (WF05-PROD-04). A submitted application opens SUB3. `?buoc=1..4`
 * selects the step; `?tu=` names where the journey started, for the back link.
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; programmeId: string }>
  searchParams: Promise<{ buoc?: string; tu?: string }>
}) {
  const { id, programmeId } = await params
  const { buoc, tu } = await searchParams
  const step = Number(buoc)
  const initialStep = [1, 2, 3, 4].includes(step) ? (step as FormStep) : null
  const from = applicationOrigin(tu)
  const member = await requireMember(
    applicationRoutes.form(id, programmeId, initialStep ?? undefined, from),
  )
  let context
  try {
    context = await getApplicationContext(member.accountId, id, programmeId)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
  if (context.application?.status === 'SUBMITTED')
    redirect(applicationRoutes.submitted(id, programmeId))

  const editable = context.eligibility.eligible && (context.application?.editable ?? true)
  return (
    <ApplicationForm
      // A draft that turns read only (a refused save re-reads the page) remounts
      // with the answers the server holds.
      key={editable ? 'edit' : 'read'}
      ventureId={id}
      programme={context.form.programme}
      questions={context.form.questions}
      team={context.team}
      application={context.application}
      eligibility={context.eligibility}
      initialStep={initialStep}
      from={from}
      backHref={
        from === 'list'
          ? projectDemoRoutes.list()
          : from === 'choose'
            ? applicationRoutes.apply(programmeId)
            : projectDemoRoutes.detail(id)
      }
    />
  )
}
