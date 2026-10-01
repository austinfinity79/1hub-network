import { ProgrammeProvider } from '@/components/programme-demo/programme-provider'
import { OpsShell } from '@/components/shell/ops-shell'
import { requireProgrammeArea } from '@/lib/programme/guard'

/**
 * WF04 — every Programme / Challenge operator page inside OpsShell
 * (DEC-WF04-H1/H2; WF04-PROD-04). Guest → /auth; onboarding not done → its
 * resolver step; no ops scope or no `programme:read` anywhere → 404. The pages
 * read the canonical rows; the provider keeps only a one-off confirmation.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeLayout({ children }: { children: React.ReactNode }) {
  await requireProgrammeArea()
  return (
    <OpsShell>
      <ProgrammeProvider>
        <div data-demo="programmes">{children}</div>
      </ProgrammeProvider>
    </OpsShell>
  )
}
