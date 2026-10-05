'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { InvitationView } from '@/lib/venture/team'

import styles from './projects.module.css'
import { expiryDay, invitationSentence } from './team-copy'

/**
 * WF02-S06 — the recipient's own pending invitation (DEC-WF02-S06-G2), in the
 * workspace frame (FB-14, S1-UAT-07): the page renders it inside
 * WorkspaceShell ("Dự án & startup" active), with ME7's header, card and
 * buttons, instead of the editor header it had.
 *
 * Shown on /projects/:id/team to a signed-in account whose email matches a
 * pending, unexpired invitation and who has no `venture:read` yet. Nothing is
 * activated until they press "Chấp nhận"; "Từ chối" closes it as REJECTED.
 * Only this invitation and the venture name are shown, never the team.
 */

const COPY = {
  eyebrow: 'LỜI MỜI VÀO ĐỘI',
  invitedOn: 'gửi ngày',
  expires: 'hết hạn',
  accept: 'Chấp nhận',
  decline: 'Từ chối',
  declined: 'Bạn đã từ chối lời mời này.',
  closed: 'Lời mời này không còn hiệu lực.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
  back: 'Về Dự án & startup',
} as const

export function TeamInvitation({ invitation }: { invitation: InvitationView }) {
  const router = useRouter()
  const [done, setDone] = useState<'declined' | 'closed'>()
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState<'accept' | 'decline'>()
  const inFlight = useRef(false)
  const base = `/ventures/${invitation.venture.id}/team/invitations/${invitation.membership_id}`

  async function act(kind: 'accept' | 'decline') {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(kind)
    setError(undefined)
    try {
      await apiRequest(`${base}/${kind}`, { method: 'POST' })
      if (kind === 'accept') router.refresh()
      else setDone('declined')
    } catch (caught) {
      const code = (caught as { code?: string } | null)?.code
      if (code === 'MEMBERSHIP_INVALID_TRANSITION') setDone('closed')
      else setError(COPY.failed)
    } finally {
      inFlight.current = false
      setBusy(undefined)
    }
  }

  return (
    <div className={styles.page} data-screen="team-invitation" data-team-invitation>
      <div className={styles.head} data-anchor="head">
        <div>
          <p className={styles.eyebrow}>{COPY.eyebrow}</p>
          <h1 className={styles.title}>{invitation.venture.name}</h1>
          <p className={styles.lede}>
            {COPY.invitedOn} {expiryDay(invitation.invited_at)} · {COPY.expires}{' '}
            {expiryDay(invitation.expires_at)}
          </p>
        </div>
      </div>

      <ul className={styles.list} aria-label={COPY.eyebrow}>
        <li className={styles.banner} data-invitation={invitation.membership_id}>
          <div className={styles.bannerText}>
            <p className={styles.bannerEyebrow}>{COPY.eyebrow}</p>
            <p className={styles.bannerSentence}>{invitationSentence(invitation)}</p>
            {error ? (
              <div className={styles.bannerError}>
                <Notice tone="error">{error}</Notice>
              </div>
            ) : null}
          </div>
          {done ? null : (
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
          )}
        </li>
      </ul>

      {done ? (
        <div className={styles.pageNotice} data-state={done}>
          <Notice tone={done === 'closed' ? 'error' : undefined}>
            {done === 'closed' ? COPY.closed : COPY.declined}
          </Notice>
          <p className={styles.lede}>
            <Link href="/projects">{COPY.back}</Link>
          </p>
        </div>
      ) : null}
    </div>
  )
}
