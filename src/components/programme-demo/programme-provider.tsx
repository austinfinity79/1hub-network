'use client'

import { useMemo, useState, type ReactNode } from 'react'

import { DemoFrameContext, type DemoFrame } from './demo-frame'

/**
 * WF04-PROD-04 — the frame context of the production WF04 screens. The data
 * comes from the canonical API and the server-rendered pages; nothing is kept
 * in the browser except a one-off confirmation for the next screen (in memory,
 * gone on reload). No demo notice, no reset, no session store (contract §15,
 * §16).
 */
export function ProgrammeProvider({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<string | null>(null)
  const frame = useMemo<DemoFrame>(() => ({ notice: false, flash, setFlash }), [flash])
  return <DemoFrameContext.Provider value={frame}>{children}</DemoFrameContext.Provider>
}
