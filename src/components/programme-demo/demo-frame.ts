'use client'

import { createContext, useContext } from 'react'

/**
 * WF05-T00 (DEC-WF05-G1, DEC-WF05-T00-D3) — what the shared demo frame
 * (`DemoPage`: the "Dữ liệu demo" notice, "Đặt lại demo", the one-off message)
 * needs from the demo it frames. The WF04 Programme demo and the WF05 Project /
 * Startup demo each provide their own reset, message and notice copy; the frame
 * itself is one component.
 */
export type DemoFrameCopy = Record<
  'noticeEyebrow' | 'noticeBody' | 'reset' | 'resetConfirm' | 'resetYes' | 'resetNo' | 'resetDone',
  string
>

export type DemoFrame = {
  flash: string | null
  setFlash: (message: string | null) => void
} & (
  | {
      notice?: true
      /** Clears this demo's browser-session state only. */
      reset: () => void
      copy: DemoFrameCopy
    }
  // WF04-PROD-04: the production WF04 screens keep the frame without the demo
  // notice and reset (contract §16); WF05-PROD-04 the WF05 screens likewise.
  | { notice: false }
)

export const DemoFrameContext = createContext<DemoFrame | null>(null)

export function useDemoFrame(): DemoFrame {
  const frame = useContext(DemoFrameContext)
  if (!frame) throw new Error('DemoPage must be rendered inside a demo provider')
  return frame
}
