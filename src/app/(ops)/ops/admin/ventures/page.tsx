import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { VentureQueue } from './venture-queue'

/** ADMIN-PROD-06 — /ops/admin/ventures (05 §27, A10): the venture review queue. */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('venture:review')) notFound()
  return <VentureQueue />
}
