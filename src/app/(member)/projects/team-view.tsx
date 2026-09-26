'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { EditorHeader } from '@/components/shell/editor-header'
import { Button, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { TeamDTO, TeamRow } from '@/lib/venture/team'

import styles from './team.module.css'

/**
 * WF02-S06 — venture team (DEC-WF02-H7, DEC-WF02-S06-G1..G9).
 *
 * One table: the owner row (derived from `owner_profile_id`, never removable),
 * ACTIVE members and, for the owner only, pending invitations. "Quyền" shows
 * the ownership category only ("Chủ sở hữu" / "Thành viên"), never a
 * permission tier (G4). The owner's row menu holds only "Sửa vai trò" and
 * "Gỡ khỏi đội"; a pending invitation can be cancelled. There is no resend:
 * P0 sends no email, and the copy never claims one was sent (G2/G3). A member
 * sees a read-only list with no pending data (G8). The server enforces all of it.
 */

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF02-S06-D). */
const COPY = {
  title: 'Thành viên đội',
  members: 'thành viên',
  pending: 'lời mời chưa nhận',
  invite: 'Mời thành viên',
  ownerCategory: 'Chủ sở hữu',
  memberCategory: 'Thành viên',
  notRemovable: 'Không gỡ được',
  menu: 'Tuỳ chọn',
  editRole: 'Sửa vai trò',
  remove: 'Gỡ khỏi đội',
  cancelInvite: 'Huỷ lời mời',
  invitedOn: 'lời mời gửi',
  save: 'Lưu',
  back: 'Không',
  confirmRemove: 'Gỡ người này khỏi đội?',
  confirmCancel: 'Huỷ lời mời này?',
  yesRemove: 'Gỡ',
  yesCancel: 'Huỷ lời mời',
  inviteTitle: 'Mời thành viên mới',
  inviteEmail: 'Email người được mời',
  inviteRole: 'Vai trò (không bắt buộc)',
  inviteRoleHint: 'Chỉ để hiển thị, không cấp thêm quyền.',
  inviteNote:
    'Hệ thống chưa gửi email mời. Hãy báo người được mời đăng nhập bằng đúng email này và mở trang đội để nhận lời mời.',
  inviteSubmit: 'Tạo lời mời',
  inviteClose: 'Đóng',
  created: 'Đã tạo lời mời. Chưa có email nào được gửi.',
  duplicate: 'Email này đã có một lời mời đang chờ.',
  invalidEmail: 'Email chưa hợp lệ.',
  tooLong: 'Vai trò quá dài.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
  readOnly: 'Chỉ chủ sở hữu mới quản lý được đội. Bạn đang xem danh sách đội.',
  archived: 'Dự án đã lưu trữ nên đội chỉ xem được.',
  noteRoleTitle: 'Vai trò chỉ để hiển thị',
  noteRoleBody:
    'Chủ sở hữu mời, sửa vai trò và gỡ thành viên · Thành viên xem được danh sách đội nhưng không sửa. Vai trò như CTO hay Cố vấn không cấp thêm quyền.',
  noteHistoryTitle: 'Gỡ thành viên không xoá lịch sử',
  noteHistoryBody:
    'Người được gỡ khỏi đội hoặc lời mời đã huỷ vẫn được lưu trong lịch sử của dự án, kèm thời điểm tham gia và kết thúc.',
  columns: ['Thành viên', 'Vai trò', 'Quyền', 'Tham gia từ'],
} as const

const TZ = 'Asia/Ho_Chi_Minh'
/** Numeric date parts in Vietnam time; the reference prints 01/2024 and 20/09. */
const parts = (iso: string) => {
  const out: Record<string, string> = {}
  for (const p of new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(new Date(iso)))
    out[p.type] = p.value
  return out
}
const monthYear = (iso: string) => {
  const p = parts(iso)
  return `${p.month}/${p.year}`
}
const dayMonth = (iso: string) => {
  const p = parts(iso)
  return `${p.day}/${p.month}`
}

type ApiFailure = { code?: string; fields?: Record<string, string> } | null

export function TeamView({ team }: { team: TeamDTO }) {
  const router = useRouter()
  const manage = team.can_manage
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [inviteError, setInviteError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [rowError, setRowError] = useState<string>()
  const [menuFor, setMenuFor] = useState<string>()
  const [editFor, setEditFor] = useState<string>()
  const [editValue, setEditValue] = useState('')
  const [confirmFor, setConfirmFor] = useState<string>()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  async function run(action: () => Promise<unknown>) {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    setRowError(undefined)
    try {
      await action()
      router.refresh()
      return true
    } catch {
      setRowError(COPY.failed)
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setInviteError(undefined)
    try {
      await apiRequest(`/ventures/${team.venture.id}/team/invitations`, {
        method: 'POST',
        body: { email, role_label: roleLabel || null },
      })
      setEmail('')
      setRoleLabel('')
      setInviting(false)
      setNotice(COPY.created)
      router.refresh()
    } catch (caught) {
      const error = caught as ApiFailure
      setInviteError(
        error?.code === 'MEMBERSHIP_INVALID_TRANSITION'
          ? COPY.duplicate
          : error?.fields?.role_label
            ? COPY.tooLong
            : error?.fields?.email
              ? COPY.invalidEmail
              : COPY.failed,
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const base = `/ventures/${team.venture.id}/team`
  const pendingCount = team.counts.pending
  const status =
    pendingCount === null
      ? `${team.counts.members} ${COPY.members}`
      : `${team.counts.members} ${COPY.members} · ${pendingCount} ${COPY.pending}`

  function actions(row: TeamRow) {
    if (row.kind === 'OWNER') {
      return manage ? <span className={`${styles.badge}`}>{COPY.notRemovable}</span> : null
    }
    if (!manage) return null
    const id = row.membership_id
    if (confirmFor === id) {
      return (
        <div className={styles.inline} role="group" aria-label={COPY.confirmRemove}>
          <span className={`type-body-sm ${styles.confirmText}`}>
            {row.kind === 'PENDING_INVITATION' ? COPY.confirmCancel : COPY.confirmRemove}
          </span>
          <button
            type="button"
            className={`${styles.rowButton} ${styles.danger}`}
            disabled={busy}
            onClick={() =>
              run(() => apiRequest(`${base}/${id}`, { method: 'DELETE' })).then(() =>
                setConfirmFor(undefined),
              )
            }
          >
            {row.kind === 'PENDING_INVITATION' ? COPY.yesCancel : COPY.yesRemove}
          </button>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => setConfirmFor(undefined)}
          >
            {COPY.back}
          </button>
        </div>
      )
    }
    if (row.kind === 'PENDING_INVITATION') {
      return (
        <button type="button" className={styles.rowButton} onClick={() => setConfirmFor(id)}>
          {COPY.cancelInvite}
        </button>
      )
    }
    if (editFor === id) {
      return (
        <div className={styles.inline}>
          <button
            type="button"
            className={styles.rowButton}
            disabled={busy}
            onClick={() =>
              run(() =>
                apiRequest(`${base}/${id}`, {
                  method: 'PATCH',
                  body: { role_label: editValue || null },
                }),
              ).then((ok) => ok && setEditFor(undefined))
            }
          >
            {COPY.save}
          </button>
          <button type="button" className={styles.rowButton} onClick={() => setEditFor(undefined)}>
            {COPY.back}
          </button>
        </div>
      )
    }
    return (
      <div className={styles.menuWrap}>
        <button
          type="button"
          className={styles.rowButton}
          aria-haspopup="menu"
          aria-expanded={menuFor === id}
          onClick={() => setMenuFor(menuFor === id ? undefined : id)}
        >
          {COPY.menu}
        </button>
        {menuFor === id ? (
          <ul className={styles.menu} role="menu">
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="type-body-sm"
                onClick={() => {
                  setMenuFor(undefined)
                  setEditValue(row.role_label ?? '')
                  setEditFor(id)
                }}
              >
                {COPY.editRole}
              </button>
            </li>
            <li role="none">
              <button
                type="button"
                role="menuitem"
                className="type-body-sm"
                onClick={() => {
                  setMenuFor(undefined)
                  setConfirmFor(id)
                }}
              >
                {COPY.remove}
              </button>
            </li>
          </ul>
        ) : null}
      </div>
    )
  }

  function roleCell(row: TeamRow) {
    if (row.kind === 'ACTIVE_MEMBER' && editFor === row.membership_id) {
      return (
        <TextInput
          id={`team-role-${row.membership_id}`}
          aria-label={COPY.editRole}
          value={editValue}
          maxLength={100}
          onChange={(e) => setEditValue(e.target.value)}
        />
      )
    }
    return row.role_label ?? '—'
  }

  return (
    <div className={styles.page} data-team-view data-viewer={team.viewer}>
      <EditorHeader
        className={styles.header}
        title={`${team.venture.name} · ${COPY.title}`}
        status={status}
        actions={
          manage ? (
            <Button onClick={() => setInviting((open) => !open)} aria-expanded={inviting}>
              {COPY.invite}
            </Button>
          ) : null
        }
      />
      <div className={styles.body}>
        {!manage ? (
          <div className={styles.notice} data-state="read-only">
            <Notice>{team.viewer === 'OWNER' ? COPY.archived : COPY.readOnly}</Notice>
          </div>
        ) : null}
        {notice ? (
          <div className={styles.notice} data-state="invite-created">
            <Notice>{notice}</Notice>
          </div>
        ) : null}
        {rowError ? (
          <div className={styles.notice}>
            <Notice tone="error">{rowError}</Notice>
          </div>
        ) : null}
        {inviting ? (
          <form className={styles.invite} onSubmit={onInvite} noValidate data-invite-form>
            <p className={`type-body-md weight-medium ${styles.inviteTitle}`}>{COPY.inviteTitle}</p>
            <div className={styles.inviteFields}>
              <label className={styles.inviteField}>
                <span className={`type-body-sm weight-semibold ${styles.label}`}>
                  {COPY.inviteEmail}
                </span>
                <TextInput
                  id="team-invite-email"
                  type="email"
                  autoComplete="off"
                  value={email}
                  invalid={inviteError === COPY.invalidEmail}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className={styles.inviteField}>
                <span className={`type-body-sm weight-semibold ${styles.label}`}>
                  {COPY.inviteRole}
                </span>
                <TextInput
                  id="team-invite-role"
                  value={roleLabel}
                  maxLength={100}
                  onChange={(e) => setRoleLabel(e.target.value)}
                />
                <span className={`type-meta-xs ${styles.hint}`}>{COPY.inviteRoleHint}</span>
              </label>
            </div>
            <p className={`type-meta-xs ${styles.hint}`}>{COPY.inviteNote}</p>
            {inviteError ? (
              <p className={`type-meta-xs ${styles.error}`} role="alert">
                {inviteError}
              </p>
            ) : null}
            <div className={styles.inviteActions}>
              <Button type="submit" loading={busy}>
                {COPY.inviteSubmit}
              </Button>
              <Button variant="secondary" onClick={() => setInviting(false)}>
                {COPY.inviteClose}
              </Button>
            </div>
          </form>
        ) : null}

        <div className={styles.table} role="table" aria-label={COPY.title} data-team-table>
          <div className={`${styles.row} ${styles.head}`} role="row">
            {COPY.columns.map((c) => (
              <span key={c} role="columnheader" className={styles.th}>
                {c}
              </span>
            ))}
            <span role="columnheader" className={styles.th} />
          </div>
          {team.rows.map((row) => {
            const pending = row.kind === 'PENDING_INVITATION'
            return (
              <div
                key={row.membership_id ?? 'owner'}
                role="row"
                className={styles.row}
                data-row-kind={row.kind}
              >
                <span role="cell" className={styles.person}>
                  <span
                    className={`${styles.avatar} ${pending ? styles.avatarPending : ''}`}
                    aria-hidden="true"
                  />
                  <span
                    className={`type-body-sm ${pending ? styles.muted : `weight-medium ${styles.name}`}`}
                  >
                    {pending ? row.email : row.display_name}
                  </span>
                </span>
                <span role="cell" className={`type-body-sm ${styles.cell}`}>
                  {roleCell(row)}
                </span>
                <span role="cell" className={`type-body-sm ${styles.cell}`}>
                  {row.kind === 'OWNER'
                    ? COPY.ownerCategory
                    : row.kind === 'ACTIVE_MEMBER'
                      ? COPY.memberCategory
                      : '—'}
                </span>
                <span role="cell" className={`type-body-sm ${styles.cell}`}>
                  {row.kind === 'ACTIVE_MEMBER'
                    ? monthYear(row.joined_at)
                    : row.kind === 'PENDING_INVITATION'
                      ? `${COPY.invitedOn} ${dayMonth(row.invited_at)}`
                      : '—'}
                </span>
                <span role="cell" className={styles.actions}>
                  {actions(row)}
                </span>
              </div>
            )
          })}
        </div>

        <div className={styles.notes}>
          <section className={styles.noteCard}>
            <p className={styles.eyebrow}>{COPY.noteRoleTitle}</p>
            <p className={`type-body-sm ${styles.noteBody}`}>{COPY.noteRoleBody}</p>
          </section>
          <section className={styles.noteCard}>
            <p className={styles.eyebrow}>{COPY.noteHistoryTitle}</p>
            <p className={`type-body-sm ${styles.noteBody}`}>{COPY.noteHistoryBody}</p>
          </section>
        </div>
      </div>
    </div>
  )
}
