import { ProjectDemoProvider } from '@/components/project-demo/demo-store'
import { MemberShell } from '@/components/shell/member-shell'
import { hasMemberSession } from '@/lib/member/guard'
import { requireProjectDemo } from '@/lib/project-demo/guard'

/**
 * WF05 — every /demo/projects/* page inside MemberShell (DEC-WF05-G1/G2), with
 * the Project / Startup entry current. A guest is left to the page, which
 * sends them to `/auth?redirect=<its path>` (WF05-PROD-04, G23); onboarding
 * not done → its resolver step. Venture data is authorized by the read model
 * on every request.
 */
export const dynamic = 'force-dynamic'

export default async function ProjectDemoLayout({ children }: { children: React.ReactNode }) {
  if (!(await hasMemberSession())) return children
  const { member } = await requireProjectDemo()
  return (
    <MemberShell active="project-demo" member={member}>
      <ProjectDemoProvider>
        <div data-demo="projects">{children}</div>
      </ProjectDemoProvider>
    </MemberShell>
  )
}
