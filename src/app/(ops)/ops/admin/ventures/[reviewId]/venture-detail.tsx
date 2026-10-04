'use client'

import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'

import styles from '../../admin.module.css'
import {
  AdminActionNotice,
  AdminLoadFailure,
  AdminLoading,
  classifyAdminError,
  fieldReason,
  isConflict,
  adminDateTime,
} from '../../shared'

/**
 * ADMIN-PROD-06 — venture review detail (05 §27, A10; PD-2, PD-3, C2). The
 * server already computes the diff (`changed_fields`/`diff`) and vocabulary
 * labels: this screen renders them, never a generic document-diff engine.
 * `public_version` (null before a first publication) is always labelled
 * apart from `proposed` — the two are never collapsed into one view, so a
 * pending candidate can never read as the live public state.
 *
 * Team membership is private, not a core field (DEC-ADM C2): no team diff is
 * rendered — nothing in 05 §27 exposes one.
 */

const COPY = {
  approve: 'Duyệt công khai',
  reject: 'Từ chối',
  confirmReject: 'Xác nhận từ chối',
  hidden: 'Hồ sơ không công khai',
  publicCurrent: 'ĐANG CÔNG KHAI',
  pendingCandidate: 'CHỜ DUYỆT',
  noPublic: 'Chưa có phiên bản công khai (lần đầu đăng)',
  diffTitle: 'Thay đổi đề xuất',
  diffField: 'Trường',
  diffBefore: 'Đang công khai',
  diffAfter: 'Đề xuất mới',
  logoTitle: 'Logo',
  logoPublic: 'Logo đang công khai',
  logoProposed: 'Logo đề xuất',
  noLogo: 'Chưa có logo',
  history: 'Lịch sử',
  previous: 'Các lần duyệt trước',
  rejectReason: 'Lý do từ chối (đã ghi nhận)',
  reasonLabel: 'Lý do (không bắt buộc)',
  cancel: 'Huỷ',
} as const

const FIELD_LABELS: Record<string, string> = {
  name: 'Tên startup',
  summary: 'Giới thiệu ngắn',
  domain_ids: 'Lĩnh vực',
  stage_id: 'Giai đoạn',
  region_id: 'Khu vực',
  website: 'Website',
  logo_asset_id: 'Logo',
  owner_role_label: 'Vai trò người sáng lập',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Đang chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
  WITHDRAWN: 'Đã rút',
}

type AssetView = { asset_id: string; url: string } | null
type Core = {
  name: string
  summary: string | null
  domain_ids: string[]
  stage_id: string | null
  region_id: string | null
  website: string | null
  logo_asset_id: string | null
  owner_role_label: string | null
}

/** History events, shown as labels like the verification detail, never raw codes. */
const EVENT_LABELS: Record<string, string> = {
  SUBMITTED: 'Gửi duyệt',
  RESUBMITTED: 'Gửi lại',
  UPDATED: 'Cập nhật',
  WITHDRAWN: 'Rút yêu cầu',
  APPROVED: 'Duyệt',
  REJECTED: 'Từ chối',
}

type Detail = {
  id: string
  kind: string
  status: string
  version: number
  venture: { id: string; name: string }
  owner: { profile_id: string; display_name: string | null }
  submitted_at: string
  can_act: boolean
  public_version: Core | null
  proposed: Core
  diff: Array<{ field: string; before: unknown; after: unknown }>
  vocabulary: Record<string, string>
  logo: { public: AssetView; proposed: AssetView }
  reject_reason: string | null
  history: Array<{
    event: string
    at: string
    by: string
    status: string | null
    reason: string | null
  }>
  previous_reviews: Array<{ id: string; status: string; submitted_at: string }>
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; detail: Detail }

/** A core value rendered with vocabulary labels; ids never shown raw. */
function formatCoreValue(
  field: string,
  value: unknown,
  vocabulary: Record<string, string>,
): string {
  if (value === null || value === undefined || value === '') return '—'
  if (Array.isArray(value)) {
    if (value.length === 0) return '—'
    return value.map((id) => vocabulary[String(id)] ?? String(id)).join(', ')
  }
  if (field === 'stage_id' || field === 'region_id')
    return vocabulary[String(value)] ?? String(value)
  if (field === 'logo_asset_id') return '—'
  return String(value)
}

export function VentureDetail({ reviewId }: { reviewId: string }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    try {
      const detail = await apiRequest<Detail>(`/ops/venture-reviews/${reviewId}`)
      setState({ kind: 'ready', detail })
    } catch (error) {
      setState({ kind: 'failed', failure: classifyAdminError(error) })
    }
  }, [reviewId])

  useEffect(() => {
    void load()
  }, [load])

  const decide = async (action: 'approve' | 'reject', withReason?: string) => {
    if (state.kind !== 'ready') return
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`/ops/venture-reviews/${reviewId}/${action}`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: { version: state.detail.version, ...(withReason ? { reason: withReason } : {}) },
      })
      setRejecting(false)
      setReason('')
      await load()
    } catch (error) {
      setNotice(
        isConflict(error)
          ? 'Mục này vừa thay đổi. Đã tải lại trạng thái mới nhất.'
          : (fieldReason(error) ??
              'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.'),
      )
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  if (state.kind !== 'ready') {
    return (
      <div className={styles.page} data-screen="ADMIN-VENTURE-DETAIL">
        {state.kind === 'loading' ? (
          <AdminLoading />
        ) : (
          <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
        )}
      </div>
    )
  }

  const { detail } = state
  const diff = detail.diff.filter((d) => d.field !== 'logo_asset_id')
  const logoChanged = detail.diff.some((d) => d.field === 'logo_asset_id')

  return (
    <div className={styles.page} data-screen="ADMIN-VENTURE-DETAIL" data-status={detail.status}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title} data-venture-name>
            {detail.venture.name}
          </h1>
          <p className={styles.subtitle}>
            {detail.owner.display_name ?? COPY.hidden} ·{' '}
            {STATUS_LABELS[detail.status] ?? detail.status} · gửi{' '}
            {adminDateTime(detail.submitted_at)}
          </p>
        </div>
        {detail.can_act && !rejecting ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void decide('approve')}
              data-action="approve"
            >
              {COPY.approve}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => setRejecting(true)}
              data-action="reject"
            >
              {COPY.reject}
            </button>
          </div>
        ) : null}
      </header>

      {notice ? <AdminActionNotice tone="error" text={notice} /> : null}

      {rejecting ? (
        <form
          className={`${styles.confirmForm} ${styles.confirmCard}`}
          onSubmit={(e) => {
            e.preventDefault()
            void decide('reject', reason.trim() || undefined)
          }}
          data-reject-form
        >
          <p className={styles.confirmText}>{COPY.confirmReject}</p>
          <input
            className={`${styles.input} ${styles.inputWide}`}
            placeholder={COPY.reasonLabel}
            aria-label={COPY.reasonLabel}
            // Keyboard users land in the form the action button just opened.
            autoFocus
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button type="submit" className={styles.danger} disabled={busy}>
            {COPY.confirmReject}
          </button>
          <button type="button" className={styles.secondary} onClick={() => setRejecting(false)}>
            {COPY.cancel}
          </button>
        </form>
      ) : null}

      <section className={styles.card} data-card="diff">
        <h2 className={styles.eyebrow}>{COPY.diffTitle}</h2>
        <div className={styles.diffTable} role="table" aria-label={COPY.diffTitle}>
          <span role="columnheader" className={styles.diffHead}>
            {COPY.diffField}
          </span>
          <span role="columnheader" className={styles.diffHead} data-column="public-current">
            {detail.public_version ? COPY.publicCurrent : COPY.noPublic}
          </span>
          <span role="columnheader" className={styles.diffHead} data-column="pending-candidate">
            {COPY.pendingCandidate}
          </span>
          {diff.map((d) => (
            <div key={d.field} role="row" className={styles.diffRow} data-diff-field={d.field}>
              <span role="cell" className={styles.diffField}>
                {FIELD_LABELS[d.field] ?? d.field}
              </span>
              <span role="cell" className={styles.diffBefore} data-column="public-current">
                {detail.public_version
                  ? formatCoreValue(d.field, d.before, detail.vocabulary)
                  : '—'}
              </span>
              <span role="cell" className={styles.diffAfter} data-column="pending-candidate">
                {formatCoreValue(d.field, d.after, detail.vocabulary)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {logoChanged || detail.logo.public || detail.logo.proposed ? (
        <section className={styles.card} data-card="logo">
          <h2 className={styles.eyebrow}>{COPY.logoTitle}</h2>
          <div className={styles.actions}>
            <div>
              <p className={`${styles.line} ${styles.muted}`}>{COPY.logoPublic}</p>
              {detail.logo.public ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.logo.public.url} alt="" className={styles.screenshot} />
              ) : (
                <p className={`${styles.line} ${styles.muted}`}>{COPY.noLogo}</p>
              )}
            </div>
            <div>
              <p className={`${styles.line} ${styles.muted}`}>{COPY.logoProposed}</p>
              {detail.logo.proposed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={detail.logo.proposed.url} alt="" className={styles.screenshot} />
              ) : (
                <p className={`${styles.line} ${styles.muted}`}>{COPY.noLogo}</p>
              )}
            </div>
          </div>
        </section>
      ) : null}

      {detail.reject_reason ? (
        <section className={styles.card} data-card="reject-reason">
          <h2 className={styles.eyebrow}>{COPY.rejectReason}</h2>
          <p className={styles.line}>{detail.reject_reason}</p>
        </section>
      ) : null}

      {detail.previous_reviews.length > 0 ? (
        <section className={styles.card} data-card="previous-reviews">
          <h2 className={styles.eyebrow}>{COPY.previous}</h2>
          <ol className={styles.history}>
            {detail.previous_reviews.map((r) => (
              <li key={r.id} className={styles.historyEntry}>
                <span className={styles.historyWhen}>{adminDateTime(r.submitted_at)}</span>
                <span className={styles.historyWhat}>{STATUS_LABELS[r.status] ?? r.status}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className={styles.card} data-card="history">
        <h2 className={styles.eyebrow}>{COPY.history}</h2>
        <ol className={styles.history}>
          {detail.history.map((h, i) => (
            <li key={i} className={styles.historyEntry} data-history-entry>
              <span className={styles.historyWhen}>{adminDateTime(h.at)}</span>
              <span className={styles.historyWhat}>{EVENT_LABELS[h.event] ?? h.event}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
