'use client'

import { DEMO_COPY, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { mergedSummaries } from '@/lib/programme-demo/session-store'
import type { ProgrammeDemoSummaryDTO } from '@/lib/programme-demo/types'

import { DemoPage } from './demo-page'
import { useProgrammeDemo } from './demo-store'

/** The /demo/programmes frame: in-scope totals over the fixture and this session's drafts. */
export function DemoHome({ server }: { server: ProgrammeDemoSummaryDTO[] }) {
  const { state, allowance } = useProgrammeDemo()
  const items = mergedSummaries(server, state, allowance)
  const count = (type: keyof typeof TYPE_LABEL) => items.filter((i) => i.type === type).length
  const meta = `${count('PROGRAMME')} ${TYPE_LABEL.PROGRAMME.toLowerCase()} · ${count('CHALLENGE')} ${TYPE_LABEL.CHALLENGE.toLowerCase()}`
  return <DemoPage title={DEMO_COPY.title} meta={meta} />
}
