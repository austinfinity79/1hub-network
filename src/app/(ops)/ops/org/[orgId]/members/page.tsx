import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF03-S03 — /ops/org/:orgId/members. Frozen route placeholder; see M0-T03. */
export default function Page() {
  return <RoutePlaceholder pattern="/ops/org/[orgId]/members" />
}
