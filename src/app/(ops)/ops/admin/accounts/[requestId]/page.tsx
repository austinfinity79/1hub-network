import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { AccountRequestDetail } from './account-request-detail'

/**
 * ADMIN-PROD-06 — /ops/admin/accounts/{id} (05 §28, A11; PD-7): process or
 * decline (a deletion requires a reason, DEC-ADM-PD7.1), plus LOCK / UNLOCK /
 * DEACTIVATE / REACTIVATE directly on the request's target account.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('account:administer')) notFound()
  return <AccountRequestDetail requestId={requestId} />
}
