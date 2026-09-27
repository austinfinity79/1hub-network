import { notFound } from 'next/navigation'

import { ProjectDemoProvider } from '@/components/project-demo/demo-store'
import { devRoutesEnabled } from '@/lib/dev-routes'
import { requireDemoVentureRoute, requireProjectDemo } from '@/lib/project-demo/guard'
import { getDemoVenture, listDemoVentures } from '@/lib/project-demo/read-model'

import { ProjectDemoHarness } from './harness'

/**
 * WF05-T00 — development / test harness for the Project / Startup demo
 * foundation (DEC-WF05-T00-D3). NOT a product screen and never linked: WF05-S01
 * is the first product screen. It mounts the real guard, read model, provider,
 * application store and the shared demo frame so the browser-session semantics
 * (refresh, a new session, "Đặt lại demo") can be proven before S01 exists.
 *
 * GATING: 404 unless ENABLE_DEV_ROUTES=1 (dev server and the Playwright visual
 * config only), like every /dev harness; absent from the route manifest.
 * `?venture=<id>` goes through the resource guard (unreadable → 404).
 */
export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  if (!devRoutesEnabled()) notFound()
  const { venture } = await searchParams
  if (typeof venture === 'string') {
    const { actorKey, detail } = await requireDemoVentureRoute(venture)
    return (
      <ProjectDemoProvider actorKey={actorKey}>
        <ProjectDemoHarness details={[detail]} />
      </ProjectDemoProvider>
    )
  }
  const { member, actorKey } = await requireProjectDemo()
  const { ventures } = await listDemoVentures(member.accountId)
  const details = await Promise.all(ventures.map((v) => getDemoVenture(member.accountId, v.id)))
  return (
    <ProjectDemoProvider actorKey={actorKey}>
      <ProjectDemoHarness details={details} />
    </ProjectDemoProvider>
  )
}
