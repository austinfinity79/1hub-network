import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { AccountRequestsQueue } from './account-requests-queue'

/** ADMIN-PROD-06 — /ops/admin/accounts (05 §28, A11): account-request queue. */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('account:administer')) notFound()
  return <AccountRequestsQueue />
}
