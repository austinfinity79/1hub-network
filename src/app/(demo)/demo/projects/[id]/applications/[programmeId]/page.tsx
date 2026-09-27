import { notFound } from 'next/navigation'

import { ProjectDemoApplication } from '@/components/project-demo/project-application'
import { requireDemoVentureRoute } from '@/lib/project-demo/guard'

/**
 * WF05-S03 — /demo/projects/:id/applications/:programmeId: the demo
 * application draft of one venture for one PUBLISHED programme
 * (DEC-WF05-G3..G5). The server guard applies the WF02 relation rule to the
 * venture (else 404); a programme that is not PUBLISHED, unknown, random or
 * malformed is the same 404. Whether this actor may edit is decided by the
 * eligibility rules (owner, not archived, type taken); the page then reads the
 * demo API itself. Opening the page stores nothing.
 */
export const dynamic = 'force-dynamic'

export default async function ProjectDemoApplicationPage({
  params,
}: {
  params: Promise<{ id: string; programmeId: string }>
}) {
  const { id, programmeId } = await params
  const { detail } = await requireDemoVentureRoute(id)
  if (!detail.programmes.some((p) => p.id === programmeId)) notFound()
  return <ProjectDemoApplication ventureId={id} programmeId={programmeId} />
}
