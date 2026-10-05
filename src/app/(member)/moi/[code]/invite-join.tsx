'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { Notice } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import styles from '../../projects/projects.module.css'
import { expiryDay, invitationSentence } from '../../projects/team-copy'

/**
 * US-02.12 receiver card, in ME7's language (FB-14): the team's name, the role
 * "Thành viên" and level "Xem" the link always grants, and "Tham gia". Joining
 * is one POST with no body; the server decides role and level. A full team or
 * a link that stopped working is said plainly; nothing about the team leaks.
 */

const COPY = {
  eyebrow: 'LỜI MỜI VÀO ĐỘI',
  expires: 'Link hết hạn',
  join: 'Tham gia',
  invalidTitle: 'Lời mời không còn hiệu lực',
  invalidBody: 'Link này đã hết hạn hoặc đã được tạo lại. Hãy xin chủ đội một link mới.',
  full: 'Đội đã đủ 20 người nên chưa tham gia được.',
  failed: 'Chưa thực hiện được. Vui lòng thử lại.',
  back: 'Về Dự án & startup',
} as const

type Offer = { venture: { name: string; type: string }; expires_at: string }

export function InviteJoin({ code, offer }: { code: string; offer: Offer | null }) {
  const router = useRouter()
  const [invalid, setInvalid] = useState(offer === null)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  async function join() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(undefined)
    try {
      const result = await apiRequest<{ venture_id: string }>(
        `/invite-links/${encodeURIComponent(code)}/join`,
        { method: 'POST' },
      )
      // Stay busy while navigating, so the join cannot repeat.
      router.push(`/projects/${result.venture_id}/team`)
    } catch (caught) {
      inFlight.current = false
      setBusy(false)
      const failure = (caught as { code?: string } | null)?.code
      if (failure === 'INVITE_LINK_INVALID') setInvalid(true)
      else setError(failure === 'TEAM_FULL' ? COPY.full : COPY.failed)
    }
  }

  if (invalid || !offer) {
    return (
      <div className={styles.page} data-screen="invite-link" data-invite-state="invalid">
        <div className={styles.head} data-anchor="head">
          <div>
            <p className={styles.eyebrow}>{COPY.eyebrow}</p>
            <h1 className={styles.title}>{COPY.invalidTitle}</h1>
            <p className={styles.lede}>{COPY.invalidBody}</p>
          </div>
          <Link href="/projects" className={styles.create}>
            {COPY.back}
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page} data-screen="invite-link" data-invite-state="valid">
      <div className={styles.head} data-anchor="head">
        <div>
          <p className={styles.eyebrow}>{COPY.eyebrow}</p>
          <h1 className={styles.title}>{offer.venture.name}</h1>
          <p className={styles.lede}>
            {COPY.expires} {expiryDay(offer.expires_at)}
          </p>
        </div>
      </div>
      <ul className={styles.list} aria-label={COPY.eyebrow}>
        <li className={styles.banner} data-invite-offer>
          <div className={styles.bannerText}>
            <p className={styles.bannerEyebrow}>{COPY.eyebrow}</p>
            <p className={styles.bannerSentence}>
              {invitationSentence({
                venture: offer.venture,
                role_label: 'Thành viên',
                permission: 'VIEW',
              })}
            </p>
            {error ? (
              <div className={styles.bannerError}>
                <Notice tone="error">{error}</Notice>
              </div>
            ) : null}
          </div>
          <div className={styles.bannerActions}>
            <button
              type="button"
              className={styles.accept}
              disabled={busy}
              aria-busy={busy || undefined}
              onClick={() => void join()}
            >
              {COPY.join}
            </button>
          </div>
        </li>
      </ul>
    </div>
  )
}
