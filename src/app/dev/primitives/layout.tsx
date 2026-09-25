import { notFound } from 'next/navigation'

import { devRoutesEnabled } from '@/lib/dev-routes'

/**
 * M0-T04 — gate for the primitives harness.
 *
 * The harness page itself is a client component and cannot read server-only
 * env, so the gate lives here in a server layout. force-dynamic keeps the check
 * per-request rather than baking a build-time 404 into static output.
 */
export const dynamic = 'force-dynamic'

export default function PrimitivesHarnessLayout({ children }: { children: React.ReactNode }) {
  if (!devRoutesEnabled()) notFound()

  return children
}
