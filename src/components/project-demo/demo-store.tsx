'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { DemoFrameContext, type DemoFrame } from '@/components/programme-demo/demo-frame'
import { PROJECT_DEMO_COPY } from '@/lib/project-demo/copy'

/**
 * WF05 — the demo frame of /demo/projects/* (DEC-WF05-T00-D1). Since TASK 24.4
 * applications persist on the server (DEC-L5), so nothing of the member's is
 * kept in the browser: "Đặt lại demo" only clears what an earlier release left
 * in `sessionStorage` under this actor's key — never an application (HD-A10),
 * auth, the WF04 demo key or any canonical data.
 */

const LEGACY_KEY_PREFIX = 'hub.wf05-demo.v1.'

export function ProjectDemoProvider({
  actorKey,
  children,
}: {
  actorKey: string
  children: ReactNode
}) {
  const [flash, setFlash] = useState<string | null>(null)
  const reset = useCallback(() => {
    try {
      window.sessionStorage.removeItem(`${LEGACY_KEY_PREFIX}${actorKey}`)
    } catch {
      // A browser that refuses storage holds nothing to clear.
    }
    setFlash(null)
  }, [actorKey])
  const frame = useMemo<DemoFrame>(
    () => ({ reset, flash, setFlash, copy: PROJECT_DEMO_COPY }),
    [reset, flash],
  )
  return <DemoFrameContext.Provider value={frame}>{children}</DemoFrameContext.Provider>
}
