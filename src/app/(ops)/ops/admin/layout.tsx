import { OpsShell } from '@/components/shell/ops-shell'
import { requireOpsAdmin } from '@/lib/ops/guard'
import { hasOpsAccess } from '@/lib/ops/scope'
import { resolveActor } from '@/lib/authz/actor'

/**
 * ADMIN-PROD-06 — /ops/admin/* inside OpsShell: the six platform-admin queues
 * frozen by ADMIN-PROD-03/04/05 (05 §26–28), integrated into the EXISTING
 * OpsShell (DEC-WF03-G15) rather than a new admin shell. Entry is
 * `requireOpsAdmin` (any of the six, platform-wide or on one organization),
 * not `requireOps` (`network:read`): a capability-only grantee (PD-6) who
 * holds none of `network:read` still reaches their one admin queue (the
 * PROD-05 handoff gap). The "Danh sách tổ chức" link is hidden for exactly
 * that actor (`hasNetworkAccess`); every other actor sees it unchanged.
 */
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { accountId, capabilities } = await requireOpsAdmin()
  const hasNetworkAccess = hasOpsAccess(await resolveActor(accountId))
  return (
    <OpsShell adminCapabilities={capabilities} hasNetworkAccess={hasNetworkAccess}>
      {children}
    </OpsShell>
  )
}
