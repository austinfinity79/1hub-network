import { PageContainer } from '@/components/shell/page-container'
import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF03-S08 — /ops/org/:orgId/settings. Frozen route placeholder (see M0-T03) inside OpsShell (WF03-T00). */
export default function Page() {
  return (
    <PageContainer>
      <RoutePlaceholder pattern="/ops/org/[orgId]/settings" />
    </PageContainer>
  )
}
