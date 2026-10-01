import { ProgrammeReview } from '@/components/programme-demo/programme-review'
import { requireProgrammeRoute } from '@/lib/programme/guard'

/**
 * WF04-S07 — review and publish (/demo/programmes/:id/setup/review). The programme is read on the
 * server with the actor's scope: unknown, malformed or out of scope → 404.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { detail } = await requireProgrammeRoute(id)
  return <ProgrammeReview id={detail.programme.id} initial={detail} />
}
