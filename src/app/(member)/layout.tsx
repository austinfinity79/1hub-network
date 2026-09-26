/**
 * Route-group boundary for the member group.
 *
 * Route groups organise layouts only. Per the frozen architecture a frontend
 * route is NOT a security boundary: the server re-authorises every request.
 *
 * WF02-T00: the approved member screens are full-bleed (member shell or editor
 * header), so the group no longer imposes PageContainer; each page chooses,
 * as the onboarding group does.
 */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return <div data-route-group="member">{children}</div>
}
