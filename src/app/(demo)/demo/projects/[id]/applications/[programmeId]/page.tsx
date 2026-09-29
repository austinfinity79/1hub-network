import { redirect } from 'next/navigation'

import { applicationRoutes } from '@/lib/application/routes'

/**
 * WF05-S03 path, superseded by TASK 24.4 (HD-A10, DEC-L5-D4): the application
 * lives on the server and its form on the member route.
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string; programmeId: string }>
}) {
  const { id, programmeId } = await params
  redirect(applicationRoutes.form(id, programmeId))
}
