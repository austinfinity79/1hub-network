import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF03-S07 — /ops/org/:orgId/events. Frozen route placeholder; see M0-T03. */
export default function Page() {
  return <RoutePlaceholder pattern="/ops/org/[orgId]/events" />
}
