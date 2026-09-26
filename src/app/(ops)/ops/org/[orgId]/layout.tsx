import { OpsShell } from '@/components/shell/ops-shell'
import { requireOpsOrg } from '@/lib/ops/guard'

/**
 * WF03-T00 — every /ops/org/:orgId/* page inside OpsShell with its organization
 * context. The id in the URL is context only: `org:read` is checked for exactly
 * that organization on the server, and anything else is the same 404
 * (DEC-WF03-G11). Each screen still checks its own capability.
 */
export const dynamic = 'force-dynamic'

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = await params
  const context = await requireOpsOrg(orgId, 'org:read')
  return (
    <OpsShell organization={context.organization} capabilities={context.capabilities}>
      {children}
    </OpsShell>
  )
}
