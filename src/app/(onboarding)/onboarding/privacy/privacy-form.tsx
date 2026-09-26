'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import styles from './privacy.module.css'

/**
 * WF01-S07 — privacy & visibility form (DEC-WF01-S07-D1..D8).
 *
 * Runtime controls: the "Thư viện" discovery switch (PROFILE_DISCOVERY:
 * ON = NETWORK_ONLY, OFF = PRIVATE; D2) and ONE required acknowledgement that
 * creates TWO consent records, one per current document (D1). The bitmap's
 * investor / challenge-owner / recruitment toggles are Future scope and are
 * not rendered (D3). Continue goes to S08 only when both current documents are
 * accepted; a stale version (409) reloads the documents and asks again (D8).
 */

type LegalType = 'TERMS_ACCEPTANCE' | 'PRIVACY_DATA_PROCESSING'
type LegalDoc = { type: LegalType; version: string; title: string; content_url: string }
type Consent = { type: LegalType; policy_version: string; status: 'ACCEPTED' | 'REVOKED' }
type LegalState = {
  documents: LegalDoc[]
  accepted: Record<LegalType, boolean>
  satisfied: boolean
}

type Card = {
  display_name: string | null
  headline: string | null
  region: string | null
  avatar_url: string | null
  domains: string[]
}

/** Copy for states the approved bitmap does not show; pending design copy review. */
const MESSAGES = {
  legalRequired: 'Vui lòng đồng ý với các văn bản bên dưới để tiếp tục.',
  stale: 'Văn bản vừa được cập nhật. Vui lòng xem lại và đồng ý với phiên bản mới.',
  failed: 'Chưa lưu được lựa chọn. Vui lòng thử lại.',
} as const

function legalFrom(documents: LegalDoc[], consents: Consent[]): LegalState {
  const accepted = {} as Record<LegalType, boolean>
  for (const doc of documents) {
    accepted[doc.type] = consents.some(
      (c) => c.type === doc.type && c.policy_version === doc.version && c.status === 'ACCEPTED',
    )
  }
  const satisfied = documents.length === 2 && documents.every((d) => accepted[d.type])
  return { documents, accepted, satisfied }
}

export function PrivacyForm({
  initialDiscovery,
  initialLegal,
  card,
}: {
  initialDiscovery: boolean
  initialLegal: LegalState
  card: Card
}) {
  const router = useRouter()
  const [discovery, setDiscovery] = useState(initialDiscovery)
  const [legal, setLegal] = useState(initialLegal)
  const [agreed, setAgreed] = useState(initialLegal.satisfied)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)
  // One Idempotency-Key per document version, reused on retry (replay-safe).
  const keys = useRef(new Map<string, string>())

  const [terms, privacy] = (['TERMS_ACCEPTANCE', 'PRIVACY_DATA_PROCESSING'] as const).map((t) =>
    legal.documents.find((d) => d.type === t),
  )

  async function reloadLegal(): Promise<void> {
    const [{ documents }, consents] = await Promise.all([
      apiRequest<{ documents: LegalDoc[] }>('/legal/current'),
      apiRequest<{ items: Consent[] }>('/me/consents'),
    ])
    const next = legalFrom(documents, consents.items)
    setLegal(next)
    setAgreed(next.satisfied)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    if (!legal.satisfied && !agreed) {
      setError(MESSAGES.legalRequired)
      return
    }
    inFlight.current = true
    setSaving(true)
    setError(undefined)
    const accepted = { ...legal.accepted }
    try {
      await apiRequest('/me/visibility', {
        method: 'PUT',
        body: {
          groups: [
            { group_code: 'PROFILE_DISCOVERY', level: discovery ? 'NETWORK_ONLY' : 'PRIVATE' },
          ],
        },
      })
      // Two canonical acceptances, one per current document; accepted ones are skipped.
      for (const doc of legal.documents) {
        if (accepted[doc.type]) continue
        const slot = `${doc.type}:${doc.version}`
        const key = keys.current.get(slot) ?? crypto.randomUUID()
        keys.current.set(slot, key)
        await apiRequest('/me/consents/accept', {
          method: 'POST',
          body: { consent_type: doc.type, policy_version: doc.version },
          idempotencyKey: key,
        })
        accepted[doc.type] = true
        setLegal((l) => ({ ...l, accepted: { ...accepted } }))
      }
      router.push('/onboarding/complete')
      // Stay busy while navigating, so nothing is sent twice.
    } catch (caught) {
      inFlight.current = false
      setSaving(false)
      const code = (caught as { code?: string } | null)?.code
      if (code === 'LEGAL_DOCUMENT_VERSION_STALE') {
        setError(MESSAGES.stale)
        await reloadLegal().catch(() => undefined)
      } else {
        setError(MESSAGES.failed)
      }
    }
  }

  return (
    <div className={styles.card}>
      <Surface as="section">
        <form onSubmit={onSubmit} noValidate aria-labelledby="privacy-title">
          <h1 id="privacy-title" className={`type-heading-2 ${styles.title}`}>
            Ai được thấy gì
          </h1>
          {/* D7: the bitmap's literal "**mục đích**" is emphasis, not text. */}
          <p className={`type-body-md ${styles.lede}`}>
            Đồng ý theo <strong className="weight-semibold">mục đích</strong>, không theo tổ chức.
            Nghĩa là bạn cho phép việc, không cho phép một cái tên — và rút lại lúc nào cũng được.
          </p>

          <div className={styles.option}>
            <div className={styles.optionText}>
              <p
                id="discovery-title"
                className={`type-body-md weight-medium ${styles.optionTitle}`}
              >
                Hiện thẻ của tôi trong Thư viện
              </p>
              {/* D2: the bitmap's "Thẻ này Google tìm thấy được." is omitted; the card is network-only. */}
              <p id="discovery-hint" className={`type-meta-xs ${styles.muted}`}>
                Tên, ảnh, chức danh, tỉnh, chuyên môn.
              </p>
              <p className={`type-meta-xs ${styles.warning}`}>
                Tắt thì không ai tìm ra bạn — kể cả đơn vị đang tìm người làm bài toán của họ.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              className={styles.switch}
              aria-checked={discovery}
              aria-labelledby="discovery-title"
              aria-describedby="discovery-hint"
              onClick={() => setDiscovery((on) => !on)}
            />
          </div>

          <div className={`${styles.option} ${styles.legal}`} data-legal>
            <input
              id="legal-ack"
              type="checkbox"
              className={styles.checkbox}
              checked={agreed || legal.satisfied}
              disabled={legal.satisfied || saving}
              aria-describedby={error ? 'privacy-error' : undefined}
              onChange={(e) => {
                setAgreed(e.target.checked)
                setError(undefined)
              }}
            />
            <label htmlFor="legal-ack" className={`type-body-sm ${styles.legalText}`}>
              Tôi đồng ý với{' '}
              {terms ? (
                <a href={terms.content_url} target="_blank" rel="noopener">
                  {terms.title}
                </a>
              ) : null}{' '}
              và{' '}
              {privacy ? (
                <a href={privacy.content_url} target="_blank" rel="noopener">
                  {privacy.title}
                </a>
              ) : null}
              .
            </label>
          </div>

          {error ? (
            <div className={styles.formError} id="privacy-error">
              <Notice tone="error">{error}</Notice>
            </div>
          ) : null}

          <div className={styles.preview} data-preview>
            {/* D2: the bitmap's "người chưa đăng nhập thấy…" clause is omitted; guests see nothing in P0. */}
            <p className={`type-meta-xs weight-medium ${styles.previewCaption}`}>
              Thẻ của bạn trong Thư viện
            </p>
            <div className={styles.previewCard}>
              <div className={styles.previewAvatar}>
                {card.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={card.avatar_url} alt="" />
                ) : null}
              </div>
              <div>
                <p className={`type-body-md weight-medium ${styles.previewName}`}>
                  {card.display_name}
                </p>
                <p className={`type-meta-xs ${styles.muted}`}>
                  {[card.headline, card.region].filter(Boolean).join(' · ')}
                </p>
                {card.domains.length > 0 ? (
                  <ul className={styles.previewChips}>
                    {card.domains.map((label) => (
                      <li key={label} className="type-meta-xs weight-medium">
                        {label}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </div>

          <hr className={styles.divider} />

          <div className={styles.footer}>
            <Link href="/onboarding/profile" className="ui-button" data-variant="secondary">
              <span>Quay lại</span>
            </Link>
            <p className={`type-meta-xs ${styles.muted} ${styles.progress}`}>
              Bước 3 trong 3 · đổi lại bất cứ lúc nào ở Quyền riêng tư
            </p>
            <Button type="submit" loading={saving}>
              Xong, vào HUB
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  )
}
