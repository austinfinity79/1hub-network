import { PageContainer } from '@/components/shell/page-container'
import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF03-S01 — /ops/network. Frozen route placeholder (see M0-T03) inside OpsShell (WF03-T00). */
export default function Page() {
  return (
    <PageContainer>
      <RoutePlaceholder pattern="/ops/network" />
    </PageContainer>
  )
}
