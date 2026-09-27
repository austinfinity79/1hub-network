'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { Button, Notice } from '@/components/ui'
import { DEMO_COPY } from '@/lib/programme-demo/copy'

import { useProgrammeDemo } from './demo-store'
import styles from './demo-page.module.css'

/**
 * WF04-T00 — the frame every Programme demo screen renders in: the header band,
 * then the "Dữ liệu demo" notice with "Đặt lại demo", then the screen. The
 * notice is part of the frame so no demo screen can omit it; no WF01–WF03
 * screen uses this frame.
 */
export function DemoPage({
  title,
  meta,
  actions,
  children,
}: {
  title: string
  meta?: ReactNode
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className={styles.page} data-demo-page>
      <header className={styles.header}>
        <div>
          <h1 className={`type-section-sm ${styles.title}`}>{title}</h1>
          {meta ? (
            <p className={`type-meta-xs ${styles.meta}`} data-demo-meta>
              {meta}
            </p>
          ) : null}
        </div>
        {actions}
      </header>
      <div className={styles.body}>
        <DemoNotice />
        <DemoFlash />
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
    </div>
  )
}

/** "Dữ liệu demo" + reset with an inline confirmation (the WF02 settings pattern). */
export function DemoNotice() {
  const { reset } = useProgrammeDemo()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  return (
    <section className={styles.notice} aria-label={DEMO_COPY.noticeEyebrow} data-demo-notice>
      <div className={styles.noticeText}>
        <p className={`weight-semibold ${styles.eyebrow}`}>{DEMO_COPY.noticeEyebrow}</p>
        <p className={`type-body-sm ${styles.noticeBody}`} aria-live="polite">
          {done ? DEMO_COPY.resetDone : DEMO_COPY.noticeBody}
        </p>
      </div>
      <div className={styles.noticeAction}>
        {confirming ? (
          <div className={styles.noticeAction} role="group" aria-label={DEMO_COPY.resetConfirm}>
            <p className={`type-body-sm weight-medium ${styles.confirmText}`}>
              {DEMO_COPY.resetConfirm}
            </p>
            <Button
              onClick={() => {
                reset()
                setConfirming(false)
                setDone(true)
              }}
              data-demo-reset="confirm"
            >
              {DEMO_COPY.resetYes}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {DEMO_COPY.resetNo}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={() => {
              setDone(false)
              setConfirming(true)
            }}
            data-demo-reset="start"
          >
            {DEMO_COPY.reset}
          </Button>
        )}
      </div>
    </section>
  )
}

/** A one-off confirmation handed over by the previous screen (e.g. a created draft). */
function DemoFlash() {
  const { flash, setFlash } = useProgrammeDemo()
  const [shown] = useState(flash)
  useEffect(() => {
    if (shown) setFlash(null)
  }, [shown, setFlash])
  return shown ? (
    <div className={styles.flash} data-state="flash">
      <Notice>{shown}</Notice>
    </div>
  ) : null
}
