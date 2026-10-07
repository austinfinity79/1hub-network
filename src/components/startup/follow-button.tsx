'use client'

import { useState } from 'react'

import { apiRequest } from '@/lib/api/client'

import { PublicAction } from '@/components/public-shell/public-action'

import styles from './startup.module.css'

/**
 * THAO-06 Follow v1 (DEC-THAO-SP-D4). A guest is sent to sign in, as before.
 * A signed-in member toggles their own follow; the button shows only their own
 * state ("Theo dõi" / "Đang theo dõi"), never a count or who else follows.
 * The same control serves the startup page and the `/products` cards, each
 * with its own look (`look`).
 */
export function FollowButton({
  slug,
  guest,
  initial,
  look = { follow: styles.follow!, following: styles.following! },
}: {
  slug: string
  guest: boolean
  initial: boolean
  look?: { follow: string; following: string }
}) {
  const [following, setFollowing] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  if (guest)
    return (
      <PublicAction href="/auth" className={look.follow} cta="follow">
        Theo dõi
      </PublicAction>
    )
  async function toggle() {
    setBusy(true)
    setFailed(false)
    try {
      const next = await apiRequest<{ following: boolean }>(
        `/startups/${encodeURIComponent(slug)}/follow`,
        { method: following ? 'DELETE' : 'PUT' },
      )
      setFollowing(next.following)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        type="button"
        className={`${look.follow} ${following ? look.following : ''}`}
        aria-pressed={following}
        disabled={busy}
        onClick={toggle}
        data-cta="follow"
      >
        {following ? 'Đang theo dõi' : 'Theo dõi'}
      </button>
      {failed ? (
        <span className={styles.inlineError} role="alert">
          Chưa lưu được, vui lòng thử lại.
        </span>
      ) : null}
    </>
  )
}
