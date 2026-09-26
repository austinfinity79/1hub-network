import { OpsShell } from '@/components/shell/ops-shell'
import { requireOps } from '@/lib/ops/guard'

/**
 * WF03-T00 — /ops/network inside OpsShell. Guest → /auth; onboarding not done →
 * its resolver step; no ops scope at all → 404 (DEC-WF03-G11/G15).
 */
export const dynamic = 'force-dynamic'

export default async function NetworkLayout({ children }: { children: React.ReactNode }) {
  await requireOps()
  return <OpsShell>{children}</OpsShell>
}
