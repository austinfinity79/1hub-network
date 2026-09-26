'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { EditorHeader } from '@/components/shell/editor-header'
import { Button, Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { InvitationView } from '@/lib/venture/team'

import styles from './team.module.css'

/**
 * WF02-S06 — the recipient's own pending invitation (DEC-WF02-S06-G2).
 *
 * Shown on /projects/:id/team to a signed-in account whose email matches a
 * pending invitation and who has no `venture:read` yet. Nothing is activated
 * until they press "Nhận lời mời"; "Từ chối" closes it as REJECTED. Only this
 * invitation and the venture name are shown, never the team.
 */

/** No approved design for this state; copy pending PO review (DEC-WF02-S06-D). */
const COPY = {
  title: 'Thành viên đội',
  status: 'Lời mời tham gia đội',
  heading: 'Bạn được mời tham gia đội',
  role: 'Vai trò',
  invitedOn: 'Mời ngày',
  accept: 'Nhận lời mời',
  decline: 'Từ chối',
  declined: 'Bạn đã từ chối lời mời này.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
} as const

const day = (iso: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))

export function TeamInvitation({ invitation }: { invitation: InvitationView }) {
  const router = useRouter()
  const [declined, setDeclined] = useState(false)
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
      else setDeclined(true)
    } catch {
      setError(COPY.failed)
    } finally {
      inFlight.current = false
      setBusy(undefined)
    }
  }

  return (
    <div className={styles.page} data-team-invitation>
      <EditorHeader
        className={styles.header}
        title={`${invitation.venture.name} · ${COPY.title}`}
        status={COPY.status}
        actions={null}
      />
      <div className={styles.body}>
        <section className={styles.noteCard} data-invitation>
          <p className="type-body-md weight-medium">
            {COPY.heading} {invitation.venture.name}
          </p>
          <p className={`type-body-sm ${styles.noteBody}`}>
            {COPY.role}: {invitation.role_label ?? '—'} · {COPY.invitedOn}{' '}
            {day(invitation.invited_at)}
          </p>
          {error ? (
            <div className={styles.notice}>
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}
          {declined ? (
            <div className={styles.notice} data-state="declined">
              <Notice>{COPY.declined}</Notice>
            </div>
          ) : (
            <div className={styles.inviteActions}>
              <Button
                loading={busy === 'accept'}
                disabled={Boolean(busy)}
                onClick={() => act('accept')}
              >
                {COPY.accept}
              </Button>
              <Button
                variant="secondary"
                loading={busy === 'decline'}
                disabled={Boolean(busy)}
                onClick={() => act('decline')}
              >
                {COPY.decline}
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
