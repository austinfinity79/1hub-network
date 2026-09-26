/**
 * Route-group boundary for the public group.
 *
 * Route groups organise layouts only. Per the frozen architecture a frontend
 * route is NOT a security boundary: the server re-authorises every request.
 * Since WF03-S09 the group's only screen draws its own full-bleed public page,
 * so the group adds no width container.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div data-route-group="public">{children}</div>
}
