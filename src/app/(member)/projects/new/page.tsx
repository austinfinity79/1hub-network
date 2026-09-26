import { PageContainer } from '@/components/shell/page-container'
import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF02-S05 — /projects/new. Frozen route placeholder; see M0-T03. */
export default function Page() {
  return (
    <PageContainer>
      <RoutePlaceholder pattern="/projects/new" />
    </PageContainer>
  )
}
