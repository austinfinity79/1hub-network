import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { FeedbackQueue } from './feedback-queue'

/** ADMIN-PROD-06 — /ops/admin/feedback (05 §28, A11): queue, filters, weekly summary. */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('feedback:manage')) notFound()
  return <FeedbackQueue />
}
