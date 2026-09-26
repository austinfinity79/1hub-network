import { ProgrammeDemoProvider } from '@/components/programme-demo/demo-store'
import { OpsShell } from '@/components/shell/ops-shell'
import { requireProgrammeDemo } from '@/lib/programme-demo/guard'

/**
 * WF04-T00 — every /demo/programmes/* page inside OpsShell (DEC-WF04-H1/H2).
 * Guest → /auth; onboarding not done → its resolver step; no ops scope or no
 * `programme:read` anywhere → 404. The provider receives the actor's allowance
 * (display filtering of session drafts) and an opaque per-actor store key.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeDemoLayout({ children }: { children: React.ReactNode }) {
  const { actorKey, allowance } = await requireProgrammeDemo()
  return (
    <OpsShell>
      <ProgrammeDemoProvider actorKey={actorKey} allowance={allowance}>
        <div data-demo="programmes">{children}</div>
      </ProgrammeDemoProvider>
    </OpsShell>
  )
}
