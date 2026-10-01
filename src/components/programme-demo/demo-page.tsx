'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { Button, Notice } from '@/components/ui'

import { useDemoFrame } from './demo-frame'
import styles from './demo-page.module.css'

/**
 * WF04-T00 — the frame every Programme demo screen renders in: the header band,
 * then the "Dữ liệu demo" notice with "Đặt lại demo", then the screen. The
 * notice is part of the frame so no demo screen can omit it; no WF01–WF03
 * screen uses this frame. WF05-T00: the reset, message and notice copy come
 * from the framing demo (`DemoFrameContext`), so WF04 and WF05 share it.
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
  const { notice } = useDemoFrame()
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
        {notice === false ? null : <DemoNotice />}
        <DemoFlash />
        {children ? <div className={styles.content}>{children}</div> : null}
      </div>
    </div>
  )
}

/** "Dữ liệu demo" + reset with an inline confirmation (the WF02 settings pattern). */
export function DemoNotice() {
  const frame = useDemoFrame()
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)
  if (frame.notice === false) return null
  const { reset, copy } = frame
  return (
    <section className={styles.notice} aria-label={copy.noticeEyebrow} data-demo-notice>
      <div className={styles.noticeText}>
        <p className={`weight-semibold ${styles.eyebrow}`}>{copy.noticeEyebrow}</p>
        <p className={`type-body-sm ${styles.noticeBody}`} aria-live="polite">
          {done ? copy.resetDone : copy.noticeBody}
        </p>
      </div>
      <div className={styles.noticeAction}>
        {confirming ? (
          <div className={styles.noticeAction} role="group" aria-label={copy.resetConfirm}>
            <p className={`type-body-sm weight-medium ${styles.confirmText}`}>
              {copy.resetConfirm}
            </p>
            <Button
              onClick={() => {
                reset()
                setConfirming(false)
                setDone(true)
              }}
              data-demo-reset="confirm"
            >
              {copy.resetYes}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {copy.resetNo}
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
            {copy.reset}
          </Button>
        )}
      </div>
    </section>
  )
}

/** A one-off confirmation handed over by the previous screen (e.g. a created draft). */
function DemoFlash() {
  const { flash, setFlash } = useDemoFrame()
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
