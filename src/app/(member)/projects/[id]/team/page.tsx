import { PageContainer } from '@/components/shell/page-container'
import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF02-S06 — /projects/:id/team. Frozen route placeholder; see M0-T03. */
export default function Page() {
  return (
    <PageContainer>
      <RoutePlaceholder pattern="/projects/[id]/team" />
    </PageContainer>
  )
}
