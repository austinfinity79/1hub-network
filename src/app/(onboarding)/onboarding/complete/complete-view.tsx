'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { Button, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import styles from './complete.module.css'

/**
 * WF01-S08 — completion view (DEC-WF01-S08-D1, D6, D7).
 *
 * Pending → POST /me/onboarding/complete (idempotent) → done. Success copy
 * appears only after the server confirms; a refusal names what is missing
 * and links back to the step that collects it. The percent is the server's.
 *
 * P0-SHELL: card 02 "Lập hồ sơ đội" is rendered now that WF02-S05 is
 * Production (DEC-WF01-S08-D3's dependency, resolved; DEC-P0-SHELL-D6). It is
 * numbered 01 because the drawn card 01 (WF04 challenges) stays omitted (D2);
 * card 03 stays omitted (D4: no region → chapter mapping).
 *
 * TASK 22.2 (DEC-L1-D7): the card follows the corrected ACC-10 reference in
 * Space Grotesk. Kept from D5–D7: intent-neutral lede, the one project card,
 * the server's percent with neutral info copy. The exit to /me is the header
 * action the reference draws (see page.tsx), so the card has no footer button.
 */

/** The header slot the page leaves for the exit; filled only in the done state. */
export const EXIT_SLOT_ID = 'onboarding-exit'

type View =
  | { kind: 'pending' }
  | { kind: 'done'; percent: number }
  | { kind: 'missing'; fields: string[] }
  | { kind: 'failed' }

/** Copy for states the approved bitmap does not show; pending design copy review. */
const MESSAGES = {
  pending: 'Đang hoàn tất hồ sơ của bạn…',
  missingTitle: 'Chưa hoàn tất được',
  missingLede: 'Còn thiếu một vài thông tin bắt buộc:',
  profile: 'Họ và tên, tỉnh / thành phố',
  legal: 'Đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư',
  failed: 'Chưa hoàn tất được. Vui lòng thử lại.',
  retry: 'Thử lại',
  /** DEC-P0-SHELL-D6: the drawn title and button; the body drops the WF04 claim. */
  projectTitle: 'Lập hồ sơ đội',
  projectBody: 'Hồ sơ dự án hoặc startup, dùng lại cho mọi chương trình.',
  projectAction: 'Lập hồ sơ đội',
} as const

export function CompleteView({
  initial,
}: {
  initial: { kind: 'pending' } | { kind: 'done'; percent: number }
}) {
  const [view, setView] = useState<View>(initial)
  const [exitSlot, setExitSlot] = useState<HTMLElement | null>(null)
  const inFlight = useRef(false)

  useEffect(() => setExitSlot(document.getElementById(EXIT_SLOT_ID)), [])

  async function complete() {
    if (inFlight.current) return
    inFlight.current = true
    setView({ kind: 'pending' })
    try {
      const result = await apiRequest<{ completion_percent: number }>('/me/onboarding/complete', {
        method: 'POST',
      })
      setView({ kind: 'done', percent: result.completion_percent })
    } catch (caught) {
      const error = caught as { code?: string; fields?: Record<string, string> } | null
      setView(
        error?.code === 'ONBOARDING_REQUIREMENTS_MISSING'
          ? { kind: 'missing', fields: Object.keys(error.fields ?? {}) }
          : { kind: 'failed' },
      )
    } finally {
      inFlight.current = false
    }
  }

  useEffect(() => {
    if (initial.kind === 'pending') void complete()
    // Runs once on entry (D1); complete() is idempotent on the server anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={styles.frame}>
      {view.kind === 'done' && exitSlot
        ? createPortal(
            <Link href="/me" className={styles.exit} data-nav="exit-me">
              Vào Tài khoản của tôi
            </Link>,
            exitSlot,
          )
        : null}
      <div className={styles.card}>
        <Surface as="section" aria-live="polite">
          {view.kind === 'done' ? (
            <>
              <div className={styles.done} aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M6 12.5 10.5 17 18.5 7" />
                </svg>
              </div>
              <h1 className={styles.title}>Hồ sơ của bạn đã sẵn sàng</h1>
              <p className={styles.lede}>Không làm gì cũng được — mọi thứ vẫn ở đó.</p>
              <ol className={styles.cards}>
                <li className={styles.action} data-action-card="project">
                  <span className={styles.index}>01</span>
                  <div className={styles.actionText}>
                    <p className={styles.actionTitle}>{MESSAGES.projectTitle}</p>
                    <p className={styles.actionBody}>{MESSAGES.projectBody}</p>
                  </div>
                  <Link
                    href="/projects/new"
                    className="ui-button"
                    data-variant="secondary"
                    data-nav="create-project"
                  >
                    <span>{MESSAGES.projectAction}</span>
                  </Link>
                </li>
              </ol>
              <div className={styles.info} data-completion>
                <span className={styles.icon} aria-hidden="true">
                  i
                </span>
                <p className={styles.infoText}>
                  Hồ sơ của bạn đang ở mức {view.percent}%. Bạn có thể cập nhật hồ sơ bất cứ lúc
                  nào.
                </p>
              </div>
            </>
          ) : view.kind === 'pending' ? (
            <p role="status" className={styles.lede}>
              {MESSAGES.pending}
            </p>
          ) : view.kind === 'missing' ? (
            <div role="alert">
              <h1 className={styles.title}>{MESSAGES.missingTitle}</h1>
              <p className={styles.lede}>{MESSAGES.missingLede}</p>
              <ul className={styles.missing}>
                {view.fields.some((f) => f === 'display_name' || f === 'region_id') ? (
                  <li>
                    <Link href="/onboarding/profile">{MESSAGES.profile}</Link>
                  </li>
                ) : null}
                {view.fields.some(
                  (f) => f === 'TERMS_ACCEPTANCE' || f === 'PRIVACY_DATA_PROCESSING',
                ) ? (
                  <li>
                    <Link href="/onboarding/privacy">{MESSAGES.legal}</Link>
                  </li>
                ) : null}
              </ul>
            </div>
          ) : (
            <div role="alert">
              <p className={styles.lede}>{MESSAGES.failed}</p>
              <div className={styles.footer}>
                <Button onClick={() => void complete()}>{MESSAGES.retry}</Button>
              </div>
            </div>
          )}
        </Surface>
      </div>
    </div>
  )
}
