import { DemoHome } from '@/components/programme-demo/demo-home'
import { requireProgrammeDemo } from '@/lib/programme-demo/guard'
import { listDemoProgrammes } from '@/lib/programme-demo/read-model'

/**
 * WF04 — /demo/programmes. T00 renders the demo frame with the in-scope totals;
 * WF04-S01 adds the list inside the same frame.
 */
export const dynamic = 'force-dynamic'

export default async function ProgrammeDemoPage() {
  const { accountId } = await requireProgrammeDemo()
  return <DemoHome server={await listDemoProgrammes(accountId)} />
}
