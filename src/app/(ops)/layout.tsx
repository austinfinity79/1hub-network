/**
 * Route-group boundary for the ops group.
 *
 * Route groups organise layouts only. Per the frozen architecture a frontend
 * route is NOT a security boundary: the server re-authorises every request.
 *
 * WF03-T00: every `/ops/*` page is full-bleed inside OpsShell (applied by the
 * `/ops/network` and `/ops/org/[orgId]` layouts after their server checks), so
 * the group no longer imposes PageContainer; each page chooses.
 */
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return <div data-route-group="ops">{children}</div>
}
