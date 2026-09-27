import { ProjectDemoDetail } from '@/components/project-demo/project-detail'
import { requireDemoVentureRoute } from '@/lib/project-demo/guard'

/**
 * WF05-S02 — /demo/projects/:id: one canonical Project / Startup and its
 * participation (DEC-WF05-G3..G5). The server guard applies the WF02 rule
 * (owner or ACTIVE member); a malformed, unknown or unreadable id — including
 * another member's venture for an admin or a leader — is the same 404. The
 * page then reads the demo API itself (loading, error + retry).
 */
export const dynamic = 'force-dynamic'

export default async function ProjectDemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireDemoVentureRoute(id)
  return <ProjectDemoDetail id={id} />
}
