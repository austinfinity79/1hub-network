'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { PrimaryIntent } from '@/lib/onboarding/intent'

import styles from './purpose.module.css'

/**
 * WF01-S05 — onboarding purpose (DEC-WF01-S05-D1..D6).
 *
 * - Options map explicitly to the P0 allowlist (D1). The approved bitmap's
 *   investor option is NOT rendered: investor/VC/dataroom is Future scope
 *   (INTENTIONAL-P0-SCOPE).
 * - Continue persists via PUT /api/v1/me/onboarding/intent (D2) and moves on
 *   only after the server confirms.
 * - Nothing is selected unless an intent was saved before (D4, D6).
 * - Skip lives in the header: no intent, but the step is recorded (D3 as
 *   amended by DEC-WF01-RESUME-D1); see skip-purpose.tsx.
 */

/** Approved copy, verbatim from the reference, mapped to P0 codes. */
export const PURPOSE_OPTIONS: readonly { code: PrimaryIntent; title: string; hint: string }[] = [
  {
    code: 'SUBMIT_SOLUTION',
    title: 'Tôi có giải pháp và muốn nộp cho bài toán',
    hint: 'Bước sau sẽ hỏi chuyên môn và mời bạn lập hồ sơ đội.',
  },
  {
    code: 'POST_CHALLENGE',
    title: 'Đơn vị tôi có bài toán cần giải',
    hint: 'Bước sau sẽ hỏi pháp nhân. HUB xác minh trước khi bạn đăng được đề bài.',
  },
  {
    code: 'ORGANIZE_COMMUNITY',
    title: 'Tôi tổ chức cộng đồng ở địa phương',
    hint: 'Bước sau sẽ hỏi tỉnh và dẫn tới đơn xin vào chapter hoặc mở CLB.',
  },
  {
    code: 'EXPLORE_NETWORK',
    title: 'Tôi chỉ muốn xem trước đã',
    hint: 'Không hỏi thêm gì. Vào thẳng, quyết định sau.',
  },
]

/** Copy for states the approved bitmap does not show; pending design copy review. */
const MESSAGES = {
  invalid: 'Lựa chọn này chưa được hỗ trợ. Vui lòng chọn lại.',
  failed: 'Chưa lưu được lựa chọn. Vui lòng thử lại.',
} as const

export function PurposeForm({ initialIntent }: { initialIntent: PrimaryIntent | null }) {
  const router = useRouter()
  const [intent, setIntent] = useState<PrimaryIntent | null>(initialIntent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  // A ref, not state: a second click can land before React re-renders.
  const inFlight = useRef(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!intent || inFlight.current) return
    inFlight.current = true
    setSaving(true)
    setError(undefined)
    try {
      await apiRequest('/me/onboarding/intent', {
        method: 'PUT',
        body: { action: 'SAVE', primary_intent: intent },
      })
      router.push('/onboarding/profile')
      // Stay busy while navigating, so the mutation cannot repeat.
    } catch (caught) {
      inFlight.current = false
      setSaving(false)
      const code = (caught as { code?: string } | null)?.code
      setError(code === 'PROFILE_VALIDATION_FAILED' ? MESSAGES.invalid : MESSAGES.failed)
    }
  }

  return (
    <div className={styles.card}>
      <Surface as="section">
        <form onSubmit={onSubmit} noValidate aria-labelledby="purpose-title">
          <h1 id="purpose-title" className={`type-heading-2 ${styles.title}`}>
            Bạn đến HUB để làm gì?
          </h1>
          <p className={`type-body-md ${styles.lede}`}>
            Chọn một. Chọn sai không sao — đổi được bất cứ lúc nào trong Cài đặt, và chọn cái này
            không khoá bạn khỏi những việc khác.
          </p>

          <fieldset className={styles.options} disabled={saving}>
            <legend className={styles.legend}>Mục đích chính của bạn</legend>
            {PURPOSE_OPTIONS.map((option) => (
              <label key={option.code} className={styles.option} data-intent={option.code}>
                <input
                  className={styles.radio}
                  type="radio"
                  name="primary_intent"
                  value={option.code}
                  checked={intent === option.code}
                  onChange={() => setIntent(option.code)}
                />
                <span className={styles.optionText}>
                  <span className={`type-body-md weight-medium ${styles.optionTitle}`}>
                    {option.title}
                  </span>
                  <span className={`type-meta-xs ${styles.optionHint}`}>{option.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {error ? (
            <div className={styles.error}>
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}

          <hr className={styles.divider} />

          <div className={styles.footer}>
            <p className={`type-meta-xs ${styles.progress}`}>Bước 1 trong 3 · khoảng 2 phút</p>
            <Button type="submit" disabled={!intent} loading={saving}>
              Tiếp tục
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  )
}
