'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

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
 */

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
  const inFlight = useRef(false)

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
      <div className={styles.card}>
        <Surface as="section" aria-live="polite">
          {view.kind === 'done' ? (
            <>
              <h1 className={`type-heading-2 ${styles.title}`}>Xong. Giờ làm gì?</h1>
              <p className={`type-body-md ${styles.lede}`}>
                Không làm gì cũng được — mọi thứ vẫn ở đó.
              </p>
              <ol className={styles.cards}>
                <li className={styles.action} data-action-card="project">
                  <span className={`type-meta-xs weight-semibold ${styles.index}`}>01</span>
                  <div className={styles.actionText}>
                    <p className={`type-body-md weight-medium ${styles.actionTitle}`}>
                      {MESSAGES.projectTitle}
                    </p>
                    <p className={`type-meta-xs ${styles.actionBody}`}>{MESSAGES.projectBody}</p>
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
                <svg
                  viewBox="0 0 16 16"
                  className={styles.icon}
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="8" cy="8" r="7.25" />
                  <path d="M8 7v4.5M8 4.6v.1" />
                </svg>
                <p className={`type-meta-xs ${styles.infoText}`}>
                  Hồ sơ của bạn đang ở mức {view.percent}%. Bạn có thể cập nhật hồ sơ bất cứ lúc
                  nào.
                </p>
              </div>
              <div className={styles.footer}>
                <Link href="/me" className="ui-button" data-variant="primary">
                  <span>Vào 1hub.network</span>
                </Link>
              </div>
            </>
          ) : view.kind === 'pending' ? (
            <p role="status" className={`type-body-md ${styles.lede}`}>
              {MESSAGES.pending}
            </p>
          ) : view.kind === 'missing' ? (
            <div role="alert">
              <h1 className={`type-heading-2 ${styles.title}`}>{MESSAGES.missingTitle}</h1>
              <p className={`type-body-md ${styles.lede}`}>{MESSAGES.missingLede}</p>
              <ul className={`type-body-md ${styles.missing}`}>
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
              <p className={`type-body-md ${styles.lede}`}>{MESSAGES.failed}</p>
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
