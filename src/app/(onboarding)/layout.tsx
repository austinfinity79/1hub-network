/**
 * Route-group boundary for the onboarding group.
 *
 * Route groups organise layouts only. Per the frozen architecture a frontend
 * route is NOT a security boundary: the server re-authorises every request.
 *
 * WF01-S05: the approved onboarding screens are full-bleed with their own
 * header, so the group no longer imposes PageContainer; each page chooses.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <div data-route-group="onboarding">{children}</div>
}
