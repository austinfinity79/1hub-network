'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { InvitationView } from '@/lib/venture/team'
import type { VentureSummaryDTO } from '@/lib/venture/venture'

import styles from './projects.module.css'
import { invitationSentence, PERMISSION_LABELS } from './team-copy'

/**
 * ME7 body (DEC-L2R-D1, D7, D8, D10, D11).
 *
 * One card per venture, drawn as the board draws a draft (dashed) or an active
 * one. A venture is visible to its team only until its owner makes it public
 * ("Công khai" in the editor, DEC-PDF-D1). The facts are the server's: type,
 * status and visibility, the viewer's level, stage, members.
 * Not shown: submissions (L5), "Hồ sơ n/48 trường" (D-V2), "Tạo từ SUB0" and
 * its thin-profile note (L5), public profile links (no public page), and the
 * frame codes of the board. Actions follow the viewer's level: the owner and
 * Biên tập complete the profile, only the owner invites, Xem reads.
 *
 * Each pending invitation to the account's own address is a banner; nothing
 * joins until "Chấp nhận" (BR-ENT-05).
 */

const TYPE_LABELS: Record<string, string> = { PROJECT: 'Dự án', STARTUP: 'Startup' }
const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Nháp · chỉ đội thấy',
  ACTIVE: 'Đang hoạt động · chỉ đội thấy',
  ARCHIVED: 'Đã lưu trữ',
}
const PUBLIC_LABEL = 'Công khai'

const COPY = {
  eyebrow: 'TÀI KHOẢN CỦA TÔI',
  title: 'Dự án & startup của tôi',
  lede: 'Nơi quản lý mọi đội bạn đang tham gia.',
  create: '+ Tạo dự án / startup',
  stage: 'Giai đoạn:',
  members: 'thành viên',
  complete: 'Hoàn thiện hồ sơ',
  view: 'Xem hồ sơ',
  invite: 'Mời thành viên',
  team: 'Thành viên',
  invitation: 'LỜI MỜI ĐANG CHỜ',
  accept: 'Chấp nhận',
  decline: 'Từ chối',
  empty:
    'Bạn chưa thuộc đội nào. Tạo một dự án/startup để lưu hồ sơ đội một lần và dùng lại cho mọi bài toán — hoặc chờ lời mời từ đội khác.',
  closed: 'Lời mời này không còn hiệu lực.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
} as const

/** "Kho lạnh chia sẻ" → "KL", "Tracely" → "Tr". */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length > 1) return (words[0]![0]! + words[1]![0]!).toUpperCase()
  const word = words[0] ?? ''
  return word.slice(0, 1).toUpperCase() + word.slice(1, 2)
}

/** The ME7 sentence: "AgriLink mời bạn vào đội với vai trò … · quyền Xem". */
function VentureCard({ venture }: { venture: VentureSummaryDTO }) {
  const editHref = `/projects/${venture.id}/edit`
  const teamHref = `/projects/${venture.id}/team`
  return (
    <li
      className={styles.card}
      data-venture={venture.id}
      data-status={venture.status}
      data-anchor="venture"
    >
      <span className={styles.tile} data-type={venture.type} aria-hidden="true">
        {initials(venture.name)}
      </span>
      <div className={styles.cardText}>
        <div className={styles.nameRow}>
          <h2 className={styles.name}>{venture.name}</h2>
          <span className={styles.chip} data-kind="type" data-type={venture.type}>
            {TYPE_LABELS[venture.type] ?? venture.type}
          </span>
          {venture.visibility === 'PUBLIC' ? (
            <span className={styles.chip} data-kind="status">
              {PUBLIC_LABEL}
            </span>
          ) : STATUS_LABELS[venture.status] ? (
            <span className={styles.chip} data-kind="status">
              {STATUS_LABELS[venture.status]}
            </span>
          ) : null}
          <span className={styles.chip} data-kind="permission">
            {PERMISSION_LABELS[venture.permission]}
          </span>
        </div>
        {venture.summary ? <p className={styles.summary}>{venture.summary}</p> : null}
        <p className={styles.facts}>
          {venture.stage ? (
            <span>
              {COPY.stage} {venture.stage.label}
            </span>
          ) : null}
          <span>
            {venture.members} {COPY.members}
          </span>
          {venture.role_label ? <span>{venture.role_label}</span> : null}
        </p>
      </div>
      <div className={styles.actions}>
        {venture.can_edit ? (
          <Link href={editHref} className={styles.primary} data-nav="venture-edit">
            {COPY.complete}
          </Link>
        ) : (
          <Link href={editHref} className={styles.secondary} data-nav="venture-view">
            {COPY.view}
          </Link>
        )}
        {venture.permission === 'OWNER' && venture.status !== 'ARCHIVED' ? (
          <Link href={teamHref} className={styles.secondary} data-nav="venture-invite">
            {COPY.invite}
          </Link>
        ) : (
          <Link href={teamHref} className={styles.secondary} data-nav="venture-team">
            {COPY.team}
          </Link>
        )}
      </div>
    </li>
  )
}

function InvitationBanner({
  invitation,
  onClosed,
}: {
  invitation: InvitationView
  /** The invitation ended meanwhile: the page says so, since this banner leaves with the refresh. */
  onClosed: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<'accept' | 'decline'>()
  const [error, setError] = useState<string>()
  const inFlight = useRef(false)
  const base = `/ventures/${invitation.venture.id}/team/invitations/${invitation.membership_id}`

  async function act(kind: 'accept' | 'decline') {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(kind)
    setError(undefined)
    try {
      await apiRequest(`${base}/${kind}`, { method: 'POST' })
      router.refresh()
    } catch (caught) {
      const code = (caught as { code?: string } | null)?.code
      inFlight.current = false
      setBusy(undefined)
      if (code === 'MEMBERSHIP_INVALID_TRANSITION') {
        onClosed()
        router.refresh()
      } else setError(COPY.failed)
    }
  }

  return (
    <li
      className={styles.banner}
      data-invitation={invitation.membership_id}
      data-anchor="invitation"
    >
      <div className={styles.bannerText}>
        <p className={styles.bannerEyebrow}>{COPY.invitation}</p>
        <p className={styles.bannerSentence}>{invitationSentence(invitation)}</p>
        {error ? (
          <div className={styles.bannerError}>
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
      </div>
      <div className={styles.bannerActions}>
        <button
          type="button"
          className={styles.decline}
          disabled={Boolean(busy)}
          onClick={() => void act('decline')}
        >
          {COPY.decline}
        </button>
        <button
          type="button"
          className={styles.accept}
          disabled={Boolean(busy)}
          aria-busy={busy === 'accept' || undefined}
          onClick={() => void act('accept')}
        >
          {COPY.accept}
        </button>
      </div>
    </li>
  )
}

export function ProjectsView({
  ventures,
  invitations,
}: {
  ventures: VentureSummaryDTO[]
  invitations: InvitationView[]
}) {
  const [closed, setClosed] = useState(false)
  return (
    <div className={styles.page} data-screen="ME7">
      <div className={styles.head} data-anchor="head">
        <div>
          <p className={styles.eyebrow}>{COPY.eyebrow}</p>
          <h1 className={styles.title}>{COPY.title}</h1>
          <p className={styles.lede}>{COPY.lede}</p>
        </div>
        <Link href="/projects/new" className={styles.create} data-nav="create-project">
          {COPY.create}
        </Link>
      </div>

      {closed ? (
        <div className={styles.pageNotice} data-state="invitation-closed">
          <Notice tone="error">{COPY.closed}</Notice>
        </div>
      ) : null}

      {ventures.length > 0 ? (
        <ul className={styles.list} aria-label={COPY.title}>
          {ventures.map((venture) => (
            <VentureCard key={venture.id} venture={venture} />
          ))}
        </ul>
      ) : null}

      {invitations.length > 0 ? (
        <ul className={styles.list} aria-label={COPY.invitation} data-invitations>
          {invitations.map((invitation) => (
            <InvitationBanner
              key={invitation.membership_id}
              invitation={invitation}
              onClosed={() => setClosed(true)}
            />
          ))}
        </ul>
      ) : null}

      {/* Not a member of any team yet: true even while an invitation waits. */}
      {ventures.length === 0 ? (
        <div className={styles.empty} data-anchor="empty" data-state="empty">
          <p className={styles.emptyText}>{COPY.empty}</p>
          <Link href="/projects/new" className={styles.create} data-nav="create-project-empty">
            {COPY.create}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
