import { ProjectDemoList } from '@/components/project-demo/project-list'
import { requireProjectDemo } from '@/lib/project-demo/guard'

/**
 * WF05-S01 — /demo/projects: the member's Projects / Startups, their
 * applications and the open programmes (DEC-WF05-G1..G3). Guest →
 * `/auth?redirect=/demo/projects` (WF05-PROD-04, G23).
 */
export const dynamic = 'force-dynamic'

export default async function ProjectDemoListPage() {
  await requireProjectDemo()
  return <ProjectDemoList />
}
