import type { ReactNode } from 'react'

/**
 * M0-T04 — notice / alert primitive.
 *
 * An error notice uses role="alert" so it interrupts and is announced. An
 * informational notice uses role="status", which is polite and waits for a
 * pause. Tone is therefore a semantic choice, not just a colour.
 */
export type NoticeProps = {
  tone?: 'info' | 'error'
  children: ReactNode
}

export function Notice({ tone = 'info', children }: NoticeProps) {
  return (
    <div className="ui-notice" data-tone={tone} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
