import { notFound } from 'next/navigation'

import { listDelegationOrganizations } from '@/lib/admin/access-api'
import { requireOpsAdmin } from '@/lib/ops/guard'

import { AccessManager } from './access-manager'

/**
 * ADMIN-PROD-06 — /ops/admin/access/{orgId} (05 §27, A10, PD-6): grant / revoke
 * / history for one unit. `orgId` is context only — every call re-authorizes
 * on the server (`GET/POST .../access`, `GET .../access/history`,
 * `POST .../access/{grantId}/revoke`); an id outside this actor's reach is the
 * same 403 the component already renders as "permission denied".
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params
  const { accountId, capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('access:delegate')) notFound()
  const organizations = await listDelegationOrganizations(accountId).catch(() => [])
  const organization = organizations.find((o) => o.id === orgId) ?? { id: orgId, name: orgId }
  return <AccessManager organization={organization} />
}
