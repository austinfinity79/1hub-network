import { notFound } from 'next/navigation'

import { ProjectDemoReview } from '@/components/project-demo/project-review'
import { requireDemoVentureRoute } from '@/lib/project-demo/guard'

/**
 * WF05-S04 — /demo/projects/:id/applications/:programmeId/review: review and
 * submit the demo application (DEC-WF05-G5). Same server guard as S03: the
 * venture by the WF02 relation rule, the programme PUBLISHED (else 404). The
 * application itself lives in the actor's browser session: the page shows it,
 * or says there is none — it never creates one.
 */
export const dynamic = 'force-dynamic'

export default async function ProjectDemoReviewPage({
  params,
}: {
  params: Promise<{ id: string; programmeId: string }>
}) {
  const { id, programmeId } = await params
  const { detail } = await requireDemoVentureRoute(id)
  if (!detail.programmes.some((p) => p.id === programmeId)) notFound()
  return <ProjectDemoReview ventureId={id} programmeId={programmeId} />
}
