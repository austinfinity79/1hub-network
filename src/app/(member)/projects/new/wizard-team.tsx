'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Button, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { TeamDTO, TeamRow } from '@/lib/venture/team'

import styles from './wizard.module.css'

/**
 * L13b PRJ2 subset (TASK 22.3, DEC-L2-D3): invite by email through the
 * existing POST /ventures/{id}/team/invitations and list the team the server
 * returns. The S06 rules hold (DEC-WF02-S06-G1..G9): a role label grants
 * nothing, P0 sends no email so the copy never claims one was sent (G2/G3),
 * and the list shows only the DTO (no member email). Not rendered (Bucket B):
 * permission levels, link invitations and the three-levels box.
 */

const COPY = {
  title: 'Ai cùng làm với bạn?',
  lede: 'Mời thành viên bằng email. Người được mời xác nhận thì mới vào đội — không ai bị thêm vào mà không biết.',
  email: 'Email thành viên',
  role: 'Vai trò',
  rolePlaceholder: 'Không bắt buộc',
  submit: 'Tạo lời mời',
  note: 'Vai trò chỉ để hiển thị, không cấp thêm quyền. Hệ thống chưa gửi email mời: hãy báo người được mời đăng nhập bằng đúng email này và mở trang đội để nhận lời mời.',
  current: 'ĐỘI HIỆN TẠI',
  owner: 'Chủ sở hữu',
  member: 'Thành viên',
  you: 'Bạn',
  pending: 'Chờ xác nhận',
  created: 'Đã tạo lời mời. Chưa có email nào được gửi.',
  duplicate: 'Email này đã có một lời mời đang chờ.',
  invalidEmail: 'Email chưa hợp lệ.',
  tooLong: 'Vai trò quá dài.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
  back: 'Quay lại',
  skip: 'Bỏ qua, mời sau',
  finish: 'Hoàn tất',
} as const

type ApiFailure = { code?: string; fields?: Record<string, string> } | null

function Chips({ row }: { row: TeamRow }) {
  return (
    <span className={styles.rowChips}>
      {row.role_label ? <span className={styles.pill}>{row.role_label}</span> : null}
      {row.kind === 'OWNER' ? (
        <>
          <span className={`${styles.pill} ${styles.pillDark}`}>{COPY.owner}</span>
          <span className={`${styles.pill} ${styles.pillYou}`}>{COPY.you}</span>
        </>
      ) : row.kind === 'ACTIVE_MEMBER' ? (
        <span className={styles.pill}>{COPY.member}</span>
      ) : (
        <span className={`${styles.pill} ${styles.pillPending}`}>{COPY.pending}</span>
      )}
    </span>
  )
}

export function WizardTeam({
  team,
  onBack,
  onDone,
}: {
  team: TeamDTO
  onBack: () => void
  onDone: () => void
}) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [roleLabel, setRoleLabel] = useState('')
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(undefined)
    setNotice(undefined)
    try {
      await apiRequest(`/ventures/${team.venture.id}/team/invitations`, {
        method: 'POST',
        body: { email, role_label: roleLabel || null },
      })
      setEmail('')
      setRoleLabel('')
      setNotice(COPY.created)
      router.refresh()
    } catch (caught) {
      const failure = caught as ApiFailure
      setError(
        failure?.code === 'MEMBERSHIP_INVALID_TRANSITION'
          ? COPY.duplicate
          : failure?.fields?.role_label
            ? COPY.tooLong
            : failure?.fields?.email
              ? COPY.invalidEmail
              : COPY.failed,
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <div data-step-form="team">
      <h1 className={styles.title}>{COPY.title}</h1>
      <p className={styles.lede}>{COPY.lede}</p>

      <form className={styles.invite} onSubmit={onInvite} noValidate data-invite-form>
        <div className={styles.inviteRow}>
          <div className={styles.inviteEmail}>
            <label htmlFor="team-invite-email" className={styles.label}>
              {COPY.email}
            </label>
            <TextInput
              id="team-invite-email"
              type="email"
              autoComplete="off"
              value={email}
              invalid={error === COPY.invalidEmail}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className={styles.inviteRole}>
            <label htmlFor="team-invite-role" className={styles.label}>
              {COPY.role}
            </label>
            <TextInput
              id="team-invite-role"
              value={roleLabel}
              maxLength={100}
              placeholder={COPY.rolePlaceholder}
              onChange={(e) => setRoleLabel(e.target.value)}
            />
          </div>
          <Button type="submit" loading={busy}>
            {COPY.submit}
          </Button>
        </div>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={styles.inviteNote}>{COPY.note}</p>
      </form>

      {notice ? (
        <div className={styles.notice} data-state="invite-created">
          <Notice>{notice}</Notice>
        </div>
      ) : null}

      <p className={`${styles.eyebrow} ${styles.teamHead}`}>
        {COPY.current} · {team.rows.length}
      </p>
      <ul className={styles.teamList} data-team-table>
        {team.rows.map((row) => (
          <li
            key={row.membership_id ?? 'owner'}
            className={styles.teamRow}
            data-row-kind={row.kind}
          >
            <span
              className={`${styles.avatar} ${row.kind === 'OWNER' ? styles.avatarOwner : ''}`}
              aria-hidden="true"
            />
            <span className={styles.person}>
              {row.kind === 'PENDING_INVITATION' ? row.email : row.display_name}
            </span>
            <Chips row={row} />
          </li>
        ))}
      </ul>

      <div className={styles.footer}>
        <Button variant="secondary" onClick={onBack}>
          {COPY.back}
        </Button>
        <div className={styles.footerEnd}>
          {team.counts.pending === 0 ? (
            <button type="button" className={styles.textAction} onClick={onDone}>
              {COPY.skip}
            </button>
          ) : null}
          <Button onClick={onDone}>{COPY.finish}</Button>
        </div>
      </div>
    </div>
  )
}
