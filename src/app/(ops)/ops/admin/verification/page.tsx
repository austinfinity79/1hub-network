import { notFound } from 'next/navigation'

import { requireOpsAdmin } from '@/lib/ops/guard'

import { VerificationQueue } from './verification-queue'

/**
 * ADMIN-PROD-06 — /ops/admin/verification (05 §26, A9). Queue of role
 * verification requests routed to units where the actor holds
 * `verification:review` (platform-wide for PLATFORM_ADMIN); PD-1.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const { capabilities } = await requireOpsAdmin()
  if (!capabilities.includes('verification:review')) notFound()
  return <VerificationQueue />
}
