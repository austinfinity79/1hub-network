import { PageContainer } from '@/components/shell/page-container'
import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF01-S04 — /auth/error. Frozen route placeholder; see M0-T03. */
export default function Page() {
  // The auth group layout no longer wraps pages (WF01-S01), so the placeholder
  // keeps its container here.
  return (
    <PageContainer>
      <RoutePlaceholder pattern="/auth/error" />
    </PageContainer>
  )
}
