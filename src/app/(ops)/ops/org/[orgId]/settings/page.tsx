import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF03-S08 — /ops/org/:orgId/settings. Frozen route placeholder; see M0-T03. */
export default function Page() {
  return <RoutePlaceholder pattern="/ops/org/[orgId]/settings" />
}
