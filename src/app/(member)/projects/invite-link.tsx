'use client'

import { useEffect, useRef, useState } from 'react'

import { apiRequest } from '@/lib/api/client'

import { expiryDay } from './team-copy'
import styles from './invite-link.module.css'

/**
 * FB-18 / US-02.12 — "Sao chép link" and "Tạo lại link" (S1-UAT-07, DEC-S1I),
 * the one control for PRJ2 (wizard step 2) and the team page.
 *
 * Copy: the live link is fetched (created when none is live), then written to
 * the clipboard; "Đã sao chép" shows only after the clipboard accepted it, for
 * a few seconds, and is announced. When the clipboard refuses (permission,
 * insecure context) the link is shown in a read-only field, selected, to copy
 * by hand. Regenerate: owner only, revokes the previous link at once.
 * The URL carries no role or level: the server always grants "Thành viên · Xem".
 */

type Link = { path: string; expires_at: string }

const COPY = {
  or: 'HOẶC',
  copy: 'Sao chép link',
  copied: 'Đã sao chép',
  regenerate: 'Tạo lại link',
  grants: 'Ai mở link sẽ vào đội với vai trò Thành viên, quyền Xem',
  expires: 'hết hạn',
  regenerated: 'Đã tạo link mới. Link cũ không còn hiệu lực.',
  manual: 'Chưa sao chép được tự động. Hãy chép link bên dưới.',
  manualLabel: 'Link mời',
  failed: 'Chưa lấy được link mời. Vui lòng thử lại.',
} as const

/** How long "Đã sao chép" stays. */
const COPIED_MS = 2500

export function InviteLinkControl({ ventureId }: { ventureId: string }) {
  const [link, setLink] = useState<Link>()
  const [state, setState] = useState<'idle' | 'copied' | 'manual' | 'failed'>('idle')
  const [notice, setNotice] = useState<string>()
  const [busy, setBusy] = useState<'copy' | 'regenerate'>()
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const manualField = useRef<HTMLInputElement>(null)
  const base = `/ventures/${ventureId}/team/invite-link`

  useEffect(() => () => clearTimeout(timer.current), [])
  useEffect(() => {
    if (state === 'manual') manualField.current?.select()
  }, [state])

  const absolute = (path: string) => `${window.location.origin}${path}`

  async function write(path: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable')
      await navigator.clipboard.writeText(absolute(path))
      setState('copied')
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setState('idle'), COPIED_MS)
    } catch {
      setState('manual')
    }
  }

  async function onCopy() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy('copy')
    setNotice(undefined)
    try {
      const { link: current } = await apiRequest<{ link: Link }>(base, { method: 'POST' })
      setLink(current)
      await write(current.path)
    } catch {
      setState('failed')
    } finally {
      inFlight.current = false
      setBusy(undefined)
    }
  }

  async function onRegenerate() {
    if (inFlight.current) return
    inFlight.current = true
    setBusy('regenerate')
    setNotice(undefined)
    try {
      const { link: next } = await apiRequest<{ link: Link }>(`${base}/regenerate`, {
        method: 'POST',
      })
      setLink(next)
      setState('idle')
      setNotice(COPY.regenerated)
    } catch {
      setState('failed')
    } finally {
      inFlight.current = false
      setBusy(undefined)
    }
  }

  return (
    <div className={styles.block} data-invite-link>
      <div className={styles.row} data-anchor="link">
        <span className={styles.or} aria-hidden="true">
          {COPY.or}
        </span>
        {link ? (
          <span className={styles.meta} data-invite-link-meta>
            {COPY.grants} · {COPY.expires} {expiryDay(link.expires_at)}
          </span>
        ) : null}
        <span className={styles.actions}>
          {link ? (
            <button
              type="button"
              className={styles.regenerate}
              disabled={Boolean(busy)}
              aria-busy={busy === 'regenerate' || undefined}
              onClick={() => void onRegenerate()}
            >
              {COPY.regenerate}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.copy}
            data-state={state}
            disabled={Boolean(busy)}
            aria-busy={busy === 'copy' || undefined}
            aria-describedby={
              state === 'manual' || state === 'failed' ? 'invite-link-message' : undefined
            }
            onClick={() => void onCopy()}
          >
            {state === 'copied' ? COPY.copied : COPY.copy}
          </button>
        </span>
      </div>
      <p className={styles.live} aria-live="polite" data-invite-link-status>
        {state === 'copied' ? COPY.copied : (notice ?? '')}
      </p>
      {notice ? (
        <p className={styles.note} data-invite-link-notice>
          {notice}
        </p>
      ) : null}
      {state === 'manual' && link ? (
        <div className={styles.manual}>
          <p id="invite-link-message" className={styles.message} role="alert">
            {COPY.manual}
          </p>
          <label className={styles.manualLabel} htmlFor="invite-link-url">
            {COPY.manualLabel}
          </label>
          <input
            id="invite-link-url"
            ref={manualField}
            className={styles.manualField}
            readOnly
            value={absolute(link.path)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
      ) : null}
      {state === 'failed' ? (
        <p id="invite-link-message" className={styles.message} role="alert">
          {COPY.failed}
        </p>
      ) : null}
    </div>
  )
}
