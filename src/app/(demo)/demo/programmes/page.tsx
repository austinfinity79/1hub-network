import { ProgrammeList } from '@/components/programme-demo/programme-list'

/**
 * WF04-S01 — /demo/programmes, the Programme / Challenge list. The layout has
 * already applied the demo guard; the list reads `GET /api/v1/demo/programmes`,
 * which re-authorizes on its own.
 */
export const dynamic = 'force-dynamic'

export default function ProgrammeDemoPage() {
  return <ProgrammeList />
}
