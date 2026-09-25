/**
 * Route-group boundary for the auth group.
 *
 * Route groups organise layouts only. Per the frozen architecture a frontend
 * route is NOT a security boundary: the server re-authorises every request.
 *
 * WF01-S01: the approved auth screens are full-bleed split layouts, so the group
 * no longer imposes PageContainer; each page chooses its own shell.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div data-route-group="auth">{children}</div>
}
