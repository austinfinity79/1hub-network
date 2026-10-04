import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { FeedbackDetail } from './feedback-detail'

/** ADMIN-PROD-06 — /ops/admin/feedback/{id} (05 §28, A11): detail, triage. */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ feedbackId: string }> }) {
  const { feedbackId } = await params
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('feedback:manage')) notFound()
  return <FeedbackDetail feedbackId={feedbackId} />
}
