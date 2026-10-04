import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { VentureDetail } from './venture-detail'

/** ADMIN-PROD-06 — /ops/admin/ventures/{id} (05 §27, A10): public vs pending, diff, decide. */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ reviewId: string }> }) {
  const { reviewId } = await params
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('venture:review')) notFound()
  return <VentureDetail reviewId={reviewId} />
}
