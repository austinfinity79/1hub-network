'use client'

import Link from 'next/link'
import { Fragment, useCallback, useRef, useState, type ReactNode } from 'react'

import { Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { authWithReturn } from '@/lib/auth/return-path'
import { INERT_REASONS } from '@/lib/member/nav'
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import type { EditResult } from '@/lib/programme-demo/journey'
import { demoRoutes, type SetupStep } from '@/lib/programme-demo/routes'
import type { ProgrammeDemoDetail } from '@/lib/programme-demo/types'
import type { ProgrammeDetailDTO } from '@/lib/programme/types'
import { patchFor, toScreen, type ProgrammeScreen } from '@/lib/programme/view'

import buttons from './demo-buttons.module.css'
import { DemoPage } from './demo-page'
import styles from './journey.module.css'
import { SetupStepper } from './setup-stepper'

/**
 * WF04 — the frame of every setup step and the detail page (DEC-WF04-S03-D2/D3,
 * S04-D3; WF04-PROD-04). The programme comes from the server-rendered page
 * (`GET /programmes/{id}` semantics, the actor's scope); every change goes to
 * the canonical API and the screen shows what the server returns, never an
 * optimistic copy. One request at a time.
 *
 * States: read only (closed or archived programme, archived owner — the
 * server's `actions`), a save error with "Thử lại" (same request, same
 * Idempotency-Key), invalid data (422), a conflict (409: the programme is
 * re-read and the reason shown), not found (404 / 403), and an expired session
 * (401: back through sign-in to this page).
 */

export type Applied<E> = { ok: boolean; errors?: E }
/** One edit the screen computed with the shared rules; persisted through PATCH. */
export type Apply = <E>(
  result: EditResult<E> | { ok: false; reason: string },
) => Promise<Applied<E>>
export type SendRequest = {
  path: string
  method: 'PATCH' | 'PUT' | 'POST'
  body?: unknown
  idempotencyKey?: string
}
export type Sent = { ok: boolean; fields?: Record<string, string> }
/** A direct request (registration, publish, close) whose answer replaces the screen's data. */
export type Send = (request: SendRequest) => Promise<Sent>

type Failure = { kind: 'retry'; request: SendRequest } | { kind: 'invalid' } | { kind: 'conflict' }

const COPY = {
  next: 'Tiếp theo',
  missingTitle: 'Không tìm thấy chương trình',
  missing: 'Không tìm thấy chương trình này hoặc bạn không còn quyền xem.',
  toList: 'Về danh sách',
  failed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
  invalid: 'Chưa lưu được: dữ liệu chưa hợp lệ.',
  conflict:
    'Chưa lưu được vì chương trình vừa thay đổi (ví dụ đã xuất bản hoặc đã đóng). Dữ liệu mới nhất đã được tải lại.',
  retry: 'Thử lại',
  closed: 'Chương trình đã đóng nên chỉ xem được.',
  archived: 'Chương trình đã lưu trữ nên chỉ xem được.',
  ownerArchived: 'Đơn vị chủ trì đã ngừng hoạt động nên chương trình chỉ xem được.',
} as const

/** Why the programme is read only, or null when it can be edited. */
export function readOnlyReason(detail: ProgrammeScreen): string | null {
  if (detail.actions.edit) return null
  if (detail.owner_archived) return COPY.ownerArchived
  if (detail.programme.status === 'CLOSED') return COPY.closed
  if (detail.programme.status === 'ARCHIVED') return COPY.archived
  return null
}

export function SetupScreen({
  initial,
  step,
  screen,
  back,
  next,
  actions,
  children,
}: {
  initial: ProgrammeDetailDTO
  /** The setup step; none on the detail page (no stepper). */
  step?: SetupStep
  screen: string
  back?: { href: string; label: string; nav: string }
  /** The next step's route, or null while it is not built (disabled with its reason). */
  next?: string | null
  /** Replaces the back / next pair (the detail page's own actions). */
  actions?: (detail: ProgrammeScreen, send: Send) => ReactNode
  children: (context: { detail: ProgrammeScreen; apply: Apply; send: Send }) => ReactNode
}) {
  const [detail, setDetail] = useState<ProgrammeScreen>(() => toScreen(initial))
  const [failure, setFailure] = useState<Failure | null>(null)
  const [missing, setMissing] = useState(false)
  // A successful retry re-mounts the step body, so the editor that failed closes.
  const [epoch, setEpoch] = useState(0)
  const pending = useRef(false)
  const path = `/programmes/${encodeURIComponent(initial.programme.id)}`

  const refresh = useCallback(async () => {
    try {
      setDetail(toScreen(await apiRequest<ProgrammeDetailDTO>(path)))
    } catch (error) {
      if (isApiError(error) && (error.status === 404 || error.status === 403)) setMissing(true)
    }
  }, [path])

  const send: Send = useCallback(
    async (request) => {
      if (pending.current) return { ok: false }
      pending.current = true
      try {
        const response = await apiRequest<ProgrammeDetailDTO>(request.path, {
          method: request.method,
          body: request.body,
          idempotencyKey: request.idempotencyKey,
        })
        setDetail(toScreen(response))
        setFailure(null)
        return { ok: true }
      } catch (error) {
        if (!isApiError(error) || error.status >= 500) {
          setFailure({ kind: 'retry', request })
          return { ok: false }
        }
        if (error.status === 401) {
          window.location.assign(authWithReturn(window.location.pathname))
          return { ok: false }
        }
        if (error.status === 404 || error.status === 403) {
          setMissing(true)
          return { ok: false }
        }
        if (error.status === 409) {
          await refresh()
          setFailure({ kind: 'conflict' })
          return { ok: false }
        }
        setFailure({ kind: 'invalid' })
        return { ok: false, fields: error.fields }
      } finally {
        pending.current = false
      }
    },
    [refresh],
  )

  const apply: Apply = async (result) => {
    if (!result.ok) {
      return 'errors' in result && result.reason === 'invalid'
        ? { ok: false, errors: result.errors }
        : { ok: false }
    }
    const body = patchFor(detail, result.detail as ProgrammeDemoDetail)
    if (Object.keys(body).length === 0) return { ok: true }
    return { ok: (await send({ path, method: 'PATCH', body })).ok }
  }

  if (missing) {
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
  const readOnly = readOnlyReason(detail)

  return (
    <div data-screen={screen} data-programme-type={programme.type}>
      <DemoPage
        title={programme.name}
        meta={`${TYPE_LABEL[programme.type]} · ${STATUS_LABEL[programme.status]} · ${organization.name}`}
        actions={
          actions ? (
            actions(detail, send)
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
        {/* The detail page states the lifecycle in its own status block. */}
        {readOnly && step ? (
          <div className={styles.notice} data-state="read-only">
            <Notice>{readOnly}</Notice>
          </div>
        ) : null}
        {failure?.kind === 'retry' ? (
          <div
            className={`${styles.notice} ${styles.failed}`}
            role="alert"
            data-state="save-failed"
          >
            <Notice tone="error">{COPY.failed}</Notice>
            <button
              type="button"
              className={`weight-medium ${buttons.secondary}`}
              onClick={async () => {
                if ((await send(failure.request)).ok) setEpoch((e) => e + 1)
              }}
              data-action="retry"
            >
              {COPY.retry}
            </button>
          </div>
        ) : null}
        {failure?.kind === 'invalid' || failure?.kind === 'conflict' ? (
          <div
            className={`${styles.notice} ${styles.failed}`}
            role="alert"
            data-state={failure.kind === 'invalid' ? 'save-invalid' : 'save-conflict'}
          >
            <Notice tone="error">
              {failure.kind === 'invalid' ? COPY.invalid : COPY.conflict}
            </Notice>
          </div>
        ) : null}
        <Fragment key={epoch}>{children({ detail, apply, send })}</Fragment>
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
  busy,
}: {
  text: string
  yes: string
  no: string
  onYes: () => void
  onNo: () => void
  busy?: boolean
}) {
  return (
    <div className={styles.confirm} role="group" aria-label={text} data-confirm>
      <p className={`type-body-sm weight-medium ${styles.confirmText}`}>{text}</p>
      <button
        type="button"
        className={`weight-medium ${buttons.primary}`}
        onClick={onYes}
        disabled={busy}
        aria-busy={busy || undefined}
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
