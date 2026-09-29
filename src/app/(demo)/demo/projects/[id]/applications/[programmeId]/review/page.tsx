import { redirect } from 'next/navigation'

import { applicationRoutes } from '@/lib/application/routes'

/**
 * WF05-S04 path, superseded by TASK 24.4 (HD-A10, DEC-L5-D4): review and
 * submit live on the member route.
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; programmeId: string }>
}) {
  const { id, programmeId } = await params
  redirect(applicationRoutes.review(id, programmeId))
}
