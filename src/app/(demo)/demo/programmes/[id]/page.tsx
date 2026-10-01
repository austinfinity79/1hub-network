import { ProgrammeDetail } from '@/components/programme-demo/programme-detail'
import { requireProgrammeRoute } from '@/lib/programme/guard'

/**
 * WF04-S08 — the programme detail / manage page (authenticated operators; not
 * a public page). Unknown, malformed and out-of-scope ids are the same 404.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { detail } = await requireProgrammeRoute(id)
  return <ProgrammeDetail id={detail.programme.id} initial={detail} />
}
