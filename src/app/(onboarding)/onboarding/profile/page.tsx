import { PageContainer } from '@/components/shell/page-container'
import { RoutePlaceholder } from '@/components/shell/route-placeholder'

/** WF01-S06 — /onboarding/profile. Frozen route placeholder; see M0-T03. */
export default function Page() {
  // The onboarding group layout no longer wraps pages (WF01-S05), so the
  // placeholder keeps its container here.
  return (
    <PageContainer>
      <RoutePlaceholder pattern="/onboarding/profile" />
    </PageContainer>
  )
}
