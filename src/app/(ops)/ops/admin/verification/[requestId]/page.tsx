import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { VerificationDetail } from './verification-detail'

/** ADMIN-PROD-06 — /ops/admin/verification/{id} (05 §26, A9): detail, approve, reject. */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('verification:review')) notFound()
  return <VerificationDetail requestId={requestId} />
}
