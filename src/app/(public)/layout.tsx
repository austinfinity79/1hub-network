import { PageContainer } from '@/components/shell/page-container'

/**
 * Route-group boundary for the public group.
 *
 * Route groups organise layouts only. Per the frozen architecture a frontend
 * route is NOT a security boundary: the server re-authorises every request.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-route-group="public">
      <PageContainer>{children}</PageContainer>
    </div>
  )
}
