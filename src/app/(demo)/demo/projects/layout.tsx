import { ProjectDemoProvider } from '@/components/project-demo/demo-store'
import { MemberShell } from '@/components/shell/member-shell'
import { requireProjectDemo } from '@/lib/project-demo/guard'

/**
 * WF05 — every /demo/projects/* page inside MemberShell (DEC-WF05-G1/G2), with
 * the demo entry current. Guest → /auth; onboarding not done → its resolver
 * step. The provider receives the opaque per-actor key of the browser
 * application store; venture data is authorized by the read model on every
 * request.
 */
export const dynamic = 'force-dynamic'

export default async function ProjectDemoLayout({ children }: { children: React.ReactNode }) {
  const { member, actorKey } = await requireProjectDemo()
  return (
    <MemberShell active="project-demo" member={member}>
      <ProjectDemoProvider actorKey={actorKey}>
        <div data-demo="projects">{children}</div>
      </ProjectDemoProvider>
    </MemberShell>
  )
}
