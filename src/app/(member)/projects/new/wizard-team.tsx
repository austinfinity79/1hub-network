'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Button, Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isPlausibleEmail } from '@/lib/auth/email'
import type { TeamDTO, TeamRow } from '@/lib/venture/team'

import { InviteLinkControl } from '../invite-link'
import {
  inviteFailure,
  MAX_INVITE_BATCH,
  PERMISSION_LABELS,
  PERMISSION_LEVELS,
  TEAM_ROLES,
} from '../team-copy'
import styles from './wizard.module.css'

/**
 * L13b PRJ2 (DEC-L2R-D7, D8): invite by e-mail with a role and a level, and
 * list the team the server returns. The invitation is e-mailed; nobody joins
 * before accepting. A role is display text; the level is Biên tập or Xem, and
 * Chủ sở hữu is the creator's alone. Several addresses may be given at once,
 * each becomes its own invitation. A pending row shows the address only: the
 * server never tells whether an address has an account. Invitation by link
 * (S1-UAT-07, US-02.12, FB-18; DEC-S1I supersedes DEC-PDF-D2): the board's row
 * is the real "Sao chép link". US-02.11: at most 10 addresses per send; a
 * malformed or refused address is skipped and named while the others go out;
 * an address already invited is re-sent (+7 days). The clauses of the board's three levels about
 * submissions and ownership transfer are left out: neither exists.
 */

const COPY = {
  title: 'Ai cùng làm với bạn?',
  lede: 'Mời thành viên bằng email. Người được mời xác nhận thì mới vào đội — không ai bị thêm vào mà không biết.',
  email: 'Email thành viên',
  emailPlaceholder: 'tuan.le@example.com, thao.nguyen@...',
  role: 'Vai trò',
  permission: 'Quyền',
  submit: 'Gửi lời mời',
  current: 'ĐỘI HIỆN TẠI',
  you: 'Bạn',
  pending: 'Chờ xác nhận',
  sent: 'Đã gửi lời mời.',
  resent: 'Đã gửi lại lời mời; hạn mới 7 ngày.',
  batch: `Mỗi lần gửi tối đa ${MAX_INVITE_BATCH} email.`,
  notSent: 'Chưa gửi được:',
  levels: 'BA MỨC QUYỀN',
  back: 'Quay lại',
  skip: 'Bỏ qua, mời sau',
  finish: 'Hoàn tất',
} as const

/** What each level may do, as PRJ2 says it, without what does not exist yet. */
const LEVELS = [
  { value: 'OWNER', body: 'sửa mọi thứ, mời/xoá thành viên.' },
  { value: 'EDIT', body: 'sửa hồ sơ; không xoá thành viên.' },
  { value: 'VIEW', body: 'xem hồ sơ của đội.' },
] as const

function Chips({ row }: { row: TeamRow }) {
  return (
    <span className={styles.rowChips}>
      {row.role_label ? <span className={styles.pill}>{row.role_label}</span> : null}
      <span
        className={`${styles.pill} ${row.kind === 'OWNER' ? styles.pillDark : ''}`}
        data-permission={row.permission}
      >
        {PERMISSION_LABELS[row.permission]}
      </span>
      {row.kind === 'OWNER' ? (
        <span className={`${styles.pill} ${styles.pillYou}`}>{COPY.you}</span>
      ) : row.kind === 'PENDING_INVITATION' ? (
        <span className={`${styles.pill} ${styles.pillPending}`}>{COPY.pending}</span>
      ) : null}
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
  const [roleLabel, setRoleLabel] = useState<string>(TEAM_ROLES[1])
  const [permission, setPermission] = useState<'EDIT' | 'VIEW'>('EDIT')
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const addresses = [...new Set(email.split(/[\s,;]+/).filter(Boolean))]
    if (addresses.length === 0) {
      setError(inviteFailure({ fields: { email: 'invalid' } }))
      return
    }
    if (addresses.length > MAX_INVITE_BATCH) {
      setError(COPY.batch)
      return
    }
    inFlight.current = true
    setBusy(true)
    setError(undefined)
    setNotice(undefined)
    // One request per address, in order. A refused address is skipped and named;
    // the others still go out, and only the refused ones stay in the field.
    const refused: { address: string; reason: string }[] = []
    let sent = 0
    let resent = 0
    for (const address of addresses) {
      if (!isPlausibleEmail(address)) {
        refused.push({ address, reason: inviteFailure({ fields: { email: 'invalid' } }) })
        continue
      }
      try {
        const row = await apiRequest<{ resent: boolean }>(
          `/ventures/${team.venture.id}/team/invitations`,
          { method: 'POST', body: { email: address, role_label: roleLabel || null, permission } },
        )
        if (row.resent) resent += 1
        else sent += 1
      } catch (caught) {
        refused.push({ address, reason: inviteFailure(caught) })
      }
    }
    setEmail(refused.map((r) => r.address).join(', '))
    if (sent > 0 || resent > 0) setNotice(sent > 0 ? COPY.sent : COPY.resent)
    // One address refused alone: just the reason, as before. In a batch, name them.
    if (addresses.length === 1 && refused.length === 1) setError(refused[0]!.reason)
    else if (refused.length > 0) {
      setError(`${COPY.notSent} ${refused.map((r) => `${r.address} (${r.reason})`).join('; ')}`)
    }
    inFlight.current = false
    setBusy(false)
    router.refresh()
  }

  return (
    <div data-step-form="team">
      <h1 className={styles.title}>{COPY.title}</h1>
      <p className={styles.lede}>{COPY.lede}</p>

      <form className={styles.invite} onSubmit={onInvite} noValidate data-invite-form>
        <div className={styles.inviteRow} data-anchor="invite">
          <div className={styles.inviteEmail}>
            <label htmlFor="team-invite-email" className={styles.label}>
              {COPY.email}
            </label>
            <TextInput
              id="team-invite-email"
              autoComplete="off"
              inputMode="email"
              value={email}
              placeholder={COPY.emailPlaceholder}
              invalid={Boolean(error)}
              aria-describedby={error ? 'team-invite-error' : undefined}
              onChange={(e) => {
                setEmail(e.target.value)
                setError(undefined)
              }}
            />
          </div>
          <div className={styles.inviteRole}>
            <label htmlFor="team-invite-role" className={styles.label}>
              {COPY.role}
            </label>
            <select
              id="team-invite-role"
              className={styles.select}
              value={roleLabel}
              onChange={(e) => setRoleLabel(e.target.value)}
            >
              {TEAM_ROLES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.invitePermission}>
            <label htmlFor="team-invite-permission" className={styles.label}>
              {COPY.permission}
            </label>
            <select
              id="team-invite-permission"
              className={styles.select}
              value={permission}
              onChange={(e) => setPermission(e.target.value as 'EDIT' | 'VIEW')}
            >
              {PERMISSION_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={busy}>
            {COPY.submit}
          </Button>
        </div>
        {error ? (
          <p id="team-invite-error" className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
      </form>

      <InviteLinkControl ventureId={team.venture.id} />

      {notice ? (
        <div className={styles.notice} data-state="invite-sent">
          <Notice>{notice}</Notice>
        </div>
      ) : null}

      <p className={`${styles.eyebrow} ${styles.teamHead}`} data-anchor="team">
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

      <section className={styles.levels} data-anchor="levels" aria-labelledby="team-levels">
        <h2 id="team-levels" className={styles.levelsTitle}>
          {COPY.levels}
        </h2>
        <ul>
          {LEVELS.map((level) => (
            <li key={level.value}>
              <strong>{PERMISSION_LABELS[level.value]}</strong> — {level.body}
            </li>
          ))}
        </ul>
      </section>

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
