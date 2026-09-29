'use client'

import { useCallback, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import type { LeadershipRecordDTO, OpsMemberDetailDTO } from '@/lib/ops/member-detail'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'

import styles from './detail.module.css'

/**
 * WF03-S04 — membership review and leadership operations
 * (DEC-WF03-G3/G4/G5/G6/G14, DEC-WF03-S04-D1..D4).
 *
 * The approved ADM18 frame (header with two actions, alert card, two fact
 * cards, history card) mapped onto the P0 relationship model: the header
 * actions approve or reject a PENDING_APPROVAL membership, the alert explains
 * a pending request, "Tổ chức & vai trò" states the membership and leadership
 * facts and opens leadership assignment, "Đồng ý hiện tại" shows the one
 * consent summary ops may read (discovery visibility, read-only), and the
 * history lists the membership and leadership records' own dates. Account
 * administration (resend link, lock account, account log, email) is not a WF03
 * capability and is not rendered (G3). Buttons are shown from the server's
 * `permissions` for display only; each call is authorized again server-side.
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF03-S04-D1). */
const COPY = {
  hidden: 'Hồ sơ không công khai',
  approve: 'Duyệt thành viên',
  reject: 'Từ chối',
  pendingTitle: 'Yêu cầu tham gia đang chờ duyệt',
  declarationBody:
    'Người này tự khai báo là thành viên HUB khi đăng ký. Chỉ quản trị nền tảng xác minh khai báo này.',
  pendingBody: (org: string, at: string) =>
    `Gửi lúc ${at}. Duyệt sẽ ghi nhận thành viên ${org} do tổ chức xác nhận; từ chối vẫn giữ yêu cầu trong lịch sử.`,
  orgRole: 'Tổ chức & vai trò',
  noLeadership: 'chưa giữ vai trò lãnh đạo',
  addLeadership: 'Thêm vai trò lãnh đạo →',
  titleLabel: 'Chức danh',
  validFromLabel: 'Bắt đầu từ',
  save: 'Lưu vai trò',
  cancel: 'Huỷ',
  endAlumni: 'Kết thúc',
  endRevoke: 'Thu hồi',
  consent: 'Đồng ý hiện tại',
  discovery: 'Hiện thẻ trong Thư viện',
  on: 'đang bật',
  off: 'chưa bật',
  consentNote: 'Quản trị chỉ xem trạng thái đồng ý, không bật hộ được — thành viên tự thay đổi.',
  history: 'Lịch sử quan hệ',
  kindMembership: 'tư cách thành viên',
  kindLeadership: 'vai trò lãnh đạo',
  loading: 'Đang tải thông tin thành viên…',
  failed: 'Không tải được thông tin thành viên.',
  actionFailed: 'Không thực hiện được thao tác. Tải lại để xem trạng thái mới nhất.',
  duplicate: 'Người này đang giữ chức danh này.',
  invalid: 'Kiểm tra lại chức danh và ngày bắt đầu.',
  retry: 'Thử lại',
} as const

// Same wording as S03 and the member's own roles screen (WF02-S04).
const STATE_LABELS: Record<string, string> = {
  ACTIVE: 'Thành viên',
  PENDING_APPROVAL: 'Đang chờ duyệt',
  REJECTED: 'Không được duyệt',
  WITHDRAWN: 'Đã rút yêu cầu',
  SUSPENDED: 'Tạm ngưng',
  ALUMNI: 'Cựu thành viên',
}

const zone = 'Asia/Ho_Chi_Minh'
/** dd/MM/yyyy HH:mm — the drawn dd/MM plus the year, since history spans years. */
const dateTime = (iso: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}
const calendarDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))

type HistoryEntry = { at: string; text: string; kind: 'membership' | 'leadership'; key: string }

/** One entry per recorded date on the records themselves — no actor, no audit data. */
function historyOf(detail: OpsMemberDetailDTO, org: string): HistoryEntry[] {
  const out: HistoryEntry[] = []
  for (const m of detail.memberships) {
    out.push({
      at: m.requested_at,
      text: `Gửi yêu cầu tham gia ${org}`,
      kind: 'membership',
      key: `${m.id}-r`,
    })
    if (m.started_at)
      out.push({
        at: m.started_at,
        text: `Bắt đầu là thành viên ${org}`,
        kind: 'membership',
        key: `${m.id}-s`,
      })
    if (m.ended_at)
      out.push({
        at: m.ended_at,
        text: `${STATE_LABELS[m.state] ?? m.state} — ${org}`,
        kind: 'membership',
        key: `${m.id}-e`,
      })
  }
  for (const l of detail.leadership) {
    out.push({
      at: l.started_at,
      text: `Nhận vai trò ${l.title}`,
      kind: 'leadership',
      key: `${l.id}-s`,
    })
    if (l.ended_at)
      out.push({
        at: l.ended_at,
        text: `${l.state === 'REVOKED' ? 'Thu hồi' : 'Kết thúc'} vai trò ${l.title}`,
        kind: 'leadership',
        key: `${l.id}-e`,
      })
  }
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.key.localeCompare(b.key)))
}

function relationshipLine(detail: OpsMemberDetailDTO, org: string) {
  const m = detail.membership
  const membership = m
    ? m.state === 'PENDING_APPROVAL'
      ? `Đang chờ duyệt vào ${org}`
      : `${STATE_LABELS[m.state] ?? m.state} ${org}`
    : `Chưa có tư cách thành viên ${org}`
  const active = detail.leadership.filter((l) => l.state === 'ACTIVE')
  return `${membership} — ${active.length ? active.map((l) => l.title).join(', ') : COPY.noLeadership}.`
}

type State =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; detail: OpsMemberDetailDTO }

export function MemberDetail({
  organization,
  profileId,
  initial,
}: {
  organization: Pick<OrganizationRefDTO, 'id' | 'name'>
  profileId: string
  /** Read on the server for the first render; reloaded from the API after each action. */
  initial: OpsMemberDetailDTO
}) {
  const [state, setState] = useState<State>({ kind: 'ready', detail: initial })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [validFrom, setValidFrom] = useState('')
  const base = `/ops/organizations/${organization.id}`

  const load = useCallback(async () => {
    try {
      const detail = await apiRequest<OpsMemberDetailDTO>(`${base}/members/${profileId}`)
      setState({ kind: 'ready', detail })
    } catch {
      // Never surface status codes, scope ids or raw errors.
      setState({ kind: 'failed' })
    }
  }, [base, profileId])

  const act = async (run: () => Promise<unknown>, failure: (code?: string) => string) => {
    setBusy(true)
    setNotice(null)
    try {
      await run()
      await load()
      return true
    } catch (error) {
      setNotice(failure((error as { code?: string }).code))
      await load()
      return false
    } finally {
      setBusy(false)
    }
  }

  if (state.kind !== 'ready') {
    return (
      <div className={styles.page} data-screen="WF03-S04">
        {state.kind === 'loading' ? (
          <p className={`type-body-sm ${styles.note}`} data-state="detail-loading">
            {COPY.loading}
          </p>
        ) : (
          <div className={styles.failed} role="alert" data-state="detail-failed">
            <p className="type-body-sm">{COPY.failed}</p>
            <button
              type="button"
              className={`type-body-sm ${styles.secondary}`}
              onClick={() => {
                setState({ kind: 'loading' })
                void load()
              }}
            >
              {COPY.retry}
            </button>
          </div>
        )}
      </div>
    )
  }

  const { detail } = state
  const org = organization.name
  const m = detail.membership
  const pending = m?.state === 'PENDING_APPROVAL'
  const canReview = pending && detail.permissions.includes('membership:confirm')
  const canLead = detail.permissions.includes('leadership:manage')
  const active = detail.leadership.filter((l) => l.state === 'ACTIVE')
  const history = historyOf(detail, org)

  const review = (status: 'ACTIVE' | 'REJECTED') =>
    act(
      () => apiRequest(`${base}/memberships/${m!.id}`, { method: 'PATCH', body: { status } }),
      () => COPY.actionFailed,
    )
  const end = (l: LeadershipRecordDTO, status: 'ALUMNI' | 'REVOKED') =>
    act(
      () => apiRequest(`${base}/leadership/${l.id}`, { method: 'PATCH', body: { status } }),
      () => COPY.actionFailed,
    )
  const create = async () => {
    const ok = await act(
      () =>
        apiRequest(`${base}/leadership`, {
          method: 'POST',
          body: {
            profile_id: detail.profile_id,
            title,
            ...(validFrom ? { valid_from: validFrom } : {}),
          },
        }),
      (code) =>
        code === 'MEMBERSHIP_INVALID_TRANSITION'
          ? COPY.duplicate
          : code === 'PROFILE_VALIDATION_FAILED'
            ? COPY.invalid
            : COPY.actionFailed,
    )
    if (ok) {
      setAdding(false)
      setTitle('')
      setValidFrom('')
    }
  }

  return (
    <div className={styles.page} data-screen="WF03-S04" data-membership-state={m?.state ?? 'NONE'}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h1 className={styles.title} data-member-name>
            {detail.profile?.display_name ?? COPY.hidden}
          </h1>
          <p className={styles.subtitle}>
            {org}
            {m ? ` · ${STATE_LABELS[m.state] ?? m.state}` : ''}
            {m ? ` · gửi ${calendarDate(m.requested_at)}` : ''}
          </p>
        </div>
        {canReview ? (
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={busy}
              onClick={() => void review('ACTIVE')}
              data-action="approve"
            >
              {COPY.approve}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={busy}
              onClick={() => void review('REJECTED')}
              data-action="reject"
            >
              {COPY.reject}
            </button>
          </div>
        ) : null}
      </header>

      {notice ? (
        <p className={`type-body-sm ${styles.notice}`} role="alert" data-state="action-failed">
          {notice}
        </p>
      ) : null}

      {pending ? (
        <section className={styles.alert} data-pending-alert>
          <span className={styles.alertIcon} aria-hidden="true">
            !
          </span>
          <div>
            <h2 className={styles.alertTitle}>{COPY.pendingTitle}</h2>
            <p className={styles.alertBody}>{COPY.pendingBody(org, dateTime(m!.requested_at))}</p>
            {m!.declaration && !canReview ? (
              <p className={styles.alertBody} data-declaration-note>
                {COPY.declarationBody}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className={styles.cards}>
        <section className={styles.card} data-card="relationship">
          <h2 className={styles.eyebrow}>{COPY.orgRole}</h2>
          <p className={styles.line}>{relationshipLine(detail, org)}</p>
          {active.length ? (
            <ul className={styles.leaders}>
              {active.map((l) => (
                <li key={l.id} className={styles.leader} data-leadership={l.id}>
                  <span className={styles.leaderTitle}>
                    {l.title} · từ {calendarDate(l.started_at)}
                  </span>
                  {canLead ? (
                    <span className={styles.leaderActions}>
                      <button
                        type="button"
                        className={styles.textAction}
                        disabled={busy}
                        onClick={() => void end(l, 'ALUMNI')}
                        data-action="end-alumni"
                      >
                        {COPY.endAlumni}
                      </button>
                      <button
                        type="button"
                        className={styles.textAction}
                        disabled={busy}
                        onClick={() => void end(l, 'REVOKED')}
                        data-action="end-revoked"
                      >
                        {COPY.endRevoke}
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {canLead && m ? (
            adding ? (
              <form
                className={styles.form}
                onSubmit={(e) => {
                  e.preventDefault()
                  void create()
                }}
                data-leadership-form
              >
                <label className={styles.field}>
                  <span>{COPY.titleLabel}</span>
                  <input
                    id="leadership-title"
                    className={styles.input}
                    value={title}
                    maxLength={100}
                    required
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  <span>{COPY.validFromLabel}</span>
                  <input
                    id="leadership-valid-from"
                    type="date"
                    className={styles.input}
                    value={validFrom}
                    onChange={(e) => setValidFrom(e.target.value)}
                  />
                </label>
                <span className={styles.formActions}>
                  <button type="submit" className={styles.primary} disabled={busy || !title.trim()}>
                    {COPY.save}
                  </button>
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => setAdding(false)}
                  >
                    {COPY.cancel}
                  </button>
                </span>
              </form>
            ) : (
              <button
                type="button"
                className={styles.link}
                onClick={() => setAdding(true)}
                data-action="add-leadership"
              >
                {COPY.addLeadership}
              </button>
            )
          ) : null}
        </section>

        <section className={styles.card} data-card="consent">
          <h2 className={styles.eyebrow}>{COPY.consent}</h2>
          <div className={styles.consentRow}>
            <span className={styles.line}>{COPY.discovery}</span>
            <span className={styles.value} data-consent-discovery>
              {detail.consent_summary.discovery_visible ? COPY.on : COPY.off}
            </span>
          </div>
          <p className={styles.consentNote}>{COPY.consentNote}</p>
        </section>
      </div>

      <section className={styles.historyCard} data-card="history">
        <h2 className={styles.eyebrow}>{COPY.history}</h2>
        <ol className={styles.history}>
          {history.map((h) => (
            <li key={h.key} className={styles.entry} data-history-entry>
              <span className={styles.when}>{dateTime(h.at)}</span>
              <span className={styles.what}>{h.text}</span>
              <span className={styles.kind}>
                {h.kind === 'membership' ? COPY.kindMembership : COPY.kindLeadership}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
