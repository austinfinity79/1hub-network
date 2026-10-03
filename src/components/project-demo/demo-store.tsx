'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { DemoFrameContext, type DemoFrame } from '@/components/programme-demo/demo-frame'

/**
 * WF05 — the page frame of /demo/projects/* (DEC-WF05-T00-D1). Everything on
 * these screens is the member's real data, read from the server, so the frame
 * carries no demo notice and no reset (WF05-PROD-01 demo artifact disposition,
 * as WF04-PROD-04): only the one-off message.
 */
export function ProjectDemoProvider({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<string | null>(null)
  const frame = useMemo<DemoFrame>(() => ({ notice: false, flash, setFlash }), [flash])
  return <DemoFrameContext.Provider value={frame}>{children}</DemoFrameContext.Provider>
}
