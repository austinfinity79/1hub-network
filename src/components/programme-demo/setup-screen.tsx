'use client'

import Link from 'next/link'
import { Fragment, useState, type ReactNode } from 'react'

import { Notice } from '@/components/ui'
import { INERT_REASONS } from '@/lib/member/nav'
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import type { EditResult } from '@/lib/programme-demo/journey'
import type { OrganizationAllowance } from '@/lib/programme-demo/readiness'
import { demoRoutes, type SetupStep } from '@/lib/programme-demo/routes'
import { effectiveDetail, inAllowance } from '@/lib/programme-demo/session-store'
import type { ProgrammeDemoDetail, ProgrammeDemoDetailDTO } from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import { DemoPage } from './demo-page'
import { useProgrammeDemo } from './demo-store'
import styles from './journey.module.css'
import { SetupStepper } from './setup-stepper'

/**
 * WF04 — the frame of every setup step (DEC-WF04-S03-D2/D3, DEC-WF04-S04-D3):
 * resolves the programme (the server fixture or the actor's session draft,
 * inside the actor's allowance), shows loading / not-found / a read error with
 * "Thử lại" (DEC-WF04-S06-D2), the header with back / next, the stepper, and a
 * save error with "Thử lại". `apply` stores
 * one atomic edit of the session copy; nothing reaches the server. "Đặt lại
 * demo" re-mounts the step body and drops a pending retry, so no open editor
 * or failed save outlives the reset.
 */

export type Applied<E> = { ok: boolean; errors?: E }
export type Apply = <E>(result: EditResult<E> | { ok: false; reason: string }) => Applied<E>

const COPY = {
  next: 'Tiếp theo',
  loading: 'Đang tải…',
  missingTitle: 'Không tìm thấy chương trình',
  missing: 'Không tìm thấy chương trình này trong bản demo của bạn.',
  toList: 'Về danh sách',
  failed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
  readFailedTitle: 'Chưa tải được dữ liệu',
  readFailed: 'Trình duyệt chưa cho đọc dữ liệu demo của phiên này.',
  retry: 'Thử lại',
} as const

export function SetupScreen({
  id,
  server,
  step,
  screen,
  back,
  next,
  actions,
  children,
}: {
  id: string
  server: ProgrammeDemoDetailDTO | null
  /** The setup step; none on the detail page (no stepper). */
  step?: SetupStep
  screen: string
  back?: { href: string; label: string; nav: string }
  /** The next step's route, or null while it is not built (disabled with its reason). */
  next?: string | null
  /** Replaces the back / next pair (the detail page's own actions). */
  actions?: (detail: ProgrammeDemoDetailDTO) => ReactNode
  children: (context: {
    detail: ProgrammeDemoDetailDTO
    apply: Apply
    allowance: OrganizationAllowance
  }) => ReactNode
}) {
  const { state, allowance, ready, save, readFailed, reread, generation } = useProgrammeDemo()
  const [failedSave, setFailedSave] = useState<{
    copy: ProgrammeDemoDetailDTO
    generation: number
  } | null>(null)
  // A save that failed before a reset is not retried over the reset state.
  const retry = failedSave?.generation === generation ? failedSave.copy : null
  // A successful retry re-mounts the step body, so the editor that failed closes.
  const [epoch, setEpoch] = useState(0)

  if (!ready) {
    return (
      <div data-screen={screen}>
        <DemoPage title={COPY.loading}>
          <p className="type-body-sm" data-state="setup-loading">
            {COPY.loading}
          </p>
        </DemoPage>
      </div>
    )
  }

  if (readFailed) {
    return (
      <div data-screen={screen}>
        <DemoPage title={COPY.readFailedTitle}>
          <div className={styles.missing} role="alert" data-state="setup-read-failed">
            <p className="type-body-sm">{COPY.readFailed}</p>
            <button
              type="button"
              className={`weight-medium ${buttons.secondary}`}
              onClick={reread}
              data-action="reread"
            >
              {COPY.retry}
            </button>
          </div>
        </DemoPage>
      </div>
    )
  }

  const detail = effectiveDetail(state, id, server ?? undefined)
  if (!detail || !inAllowance(detail, allowance)) {
    return (
      <div data-screen={screen}>
        <DemoPage title={COPY.missingTitle}>
          <div className={styles.missing} data-state="setup-missing">
            <p className="type-body-sm">{COPY.missing}</p>
            <Link href={demoRoutes.list()} className={`weight-medium ${buttons.secondary}`}>
              {COPY.toList}
            </Link>
          </div>
        </DemoPage>
      </div>
    )
  }

  const { programme, organization } = detail
  const store = (copy: ProgrammeDemoDetailDTO) => {
    if (save(copy)) {
      setFailedSave(null)
      return true
    }
    setFailedSave({ copy, generation })
    return false
  }
  const apply: Apply = (result) => {
    if (!result.ok) {
      return 'errors' in result && result.reason === 'invalid'
        ? { ok: false, errors: result.errors }
        : { ok: false }
    }
    const copy: ProgrammeDemoDetailDTO = {
      ...(result.detail as ProgrammeDemoDetail),
      organization,
      demo: true,
    }
    return { ok: store(copy) }
  }

  return (
    <div data-screen={screen} data-programme-type={programme.type}>
      <DemoPage
        title={programme.name}
        meta={`${TYPE_LABEL[programme.type]} · ${STATUS_LABEL[programme.status]} · ${organization.name}`}
        actions={
          actions ? (
            actions(detail)
          ) : (
            <div className={buttons.group}>
              {back ? (
                <Link
                  href={back.href}
                  className={`weight-medium ${buttons.secondary}`}
                  data-nav={back.nav}
                >
                  {back.label}
                </Link>
              ) : null}
              {next ? (
                <Link href={next} className={`weight-medium ${buttons.primary}`} data-setup-next>
                  {COPY.next}
                </Link>
              ) : (
                <button
                  type="button"
                  className={`weight-medium ${buttons.primary}`}
                  disabled
                  aria-disabled="true"
                  title={INERT_REASONS.NO_P0_SCREEN}
                  aria-label={`${COPY.next} — ${INERT_REASONS.NO_P0_SCREEN}`}
                  data-nav-kind="INERT"
                  data-setup-next
                >
                  {COPY.next}
                </button>
              )}
            </div>
          )
        }
      >
        {step ? (
          <div className={styles.stepper}>
            <SetupStepper current={step} />
          </div>
        ) : null}
        {retry ? (
          <div
            className={`${styles.notice} ${styles.failed}`}
            role="alert"
            data-state="save-failed"
          >
            <Notice tone="error">{COPY.failed}</Notice>
            <button
              type="button"
              className={`weight-medium ${buttons.secondary}`}
              onClick={() => {
                if (store(retry)) setEpoch((e) => e + 1)
              }}
              data-action="retry"
            >
              {COPY.retry}
            </button>
          </div>
        ) : null}
        <Fragment key={`${generation}.${epoch}`}>{children({ detail, apply, allowance })}</Fragment>
      </DemoPage>
    </div>
  )
}

/** The inline confirmation used for removals (the WF02 settings pattern). */
export function Confirm({
  text,
  yes,
  no,
  onYes,
  onNo,
}: {
  text: string
  yes: string
  no: string
  onYes: () => void
  onNo: () => void
}) {
  return (
    <div className={styles.confirm} role="group" aria-label={text} data-confirm>
      <p className={`type-body-sm weight-medium ${styles.confirmText}`}>{text}</p>
      <button
        type="button"
        className={`weight-medium ${buttons.primary}`}
        onClick={onYes}
        data-confirm="yes"
      >
        {yes}
      </button>
      <button
        type="button"
        className={`weight-medium ${buttons.secondary}`}
        onClick={onNo}
        data-confirm="no"
      >
        {no}
      </button>
    </div>
  )
}
