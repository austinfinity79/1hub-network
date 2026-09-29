'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import { HeaderAction, useLeave } from '../parts'
import stage from '../stage.module.css'
import styles from './review.module.css'

/**
 * ACC-09 — onboarding stage 4, "Rà soát hồ sơ trước khi hoàn tất" (BA
 * workbook rows 56, 59, 60; DEC-L1R-D6).
 *
 * Shows what the three stages stored, the server's completion and the profile
 * card the board draws. The card's role chips are descriptive text taken from
 * the member's own declaration; they are not a permission and nothing reads
 * them as one. Two separate choices are made here:
 *
 * - Visibility: the switch is PROFILE_DISCOVERY (on = NETWORK_ONLY, off =
 *   PRIVATE). It is not consent and can be changed later.
 * - Consent: ONE required confirmation that records TWO acceptances, one per
 *   current document (PO decision D-L1, DEC-WF01-S07-D1). A stale version
 *   (409) reloads the documents and asks again.
 *
 * "Hoàn tất hồ sơ" saves both and completes onboarding on the server; success
 * is shown only after the server confirms (ACC-10). The board's AI
 * confirmation and "AI" marks belong to suggested content, and there is none
 * (D-A1); the confirmation in its place is the consent above.
 */

type LegalType = 'TERMS_ACCEPTANCE' | 'PRIVACY_DATA_PROCESSING'
type LegalDoc = { type: LegalType; version: string; title: string; content_url: string }
type Consent = { type: LegalType; policy_version: string; status: 'ACCEPTED' | 'REVOKED' }
type LegalState = {
  documents: LegalDoc[]
  accepted: Record<LegalType, boolean>
  satisfied: boolean
}

export type ReviewRow = { label: string; value: string | null; empty: string }
export type ReviewPart = { title: string; href: string; rows: ReviewRow[] }

type Preview = {
  display_name: string
  line: string
  avatar_url: string | null
  /** Self-declared roles, as text. `pending` marks the HUB role awaiting its unit. */
  roles: { label: string; pending: boolean }[]
  domains: string[]
}

/** Copy for states the board does not show. */
const MESSAGES = {
  legalRequired: 'Vui lòng đồng ý với hai văn bản để hoàn tất hồ sơ.',
  stale: 'Văn bản vừa được cập nhật. Vui lòng xem lại và đồng ý với phiên bản mới.',
  failed: 'Chưa hoàn tất được. Vui lòng thử lại.',
  saveFailed: 'Chưa lưu được lựa chọn. Vui lòng thử lại.',
  missing: 'Còn thiếu thông tin bắt buộc:',
} as const

/** What the server may report as missing, and the stage that collects it. */
const MISSING: { keys: string[]; label: string; href: string }[] = [
  {
    keys: ['full_name', 'display_name', 'country_id', 'region_id'],
    label: 'Thông tin cơ bản: họ và tên, tên hiển thị, quốc gia, tỉnh/thành phố',
    href: '/onboarding/profile',
  },
  {
    keys: ['capability_stage'],
    label: 'Năng lực và lĩnh vực hoạt động',
    href: '/onboarding/capability',
  },
  { keys: ['role_stage'], label: 'Vai trò trong hệ sinh thái', href: '/onboarding/purpose' },
]

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

export function ReviewForm({
  parts,
  preview,
  completion,
  initialDiscovery,
  initialLegal,
}: {
  parts: ReviewPart[]
  preview: Preview
  completion: { percent: number; missing: string[] }
  initialDiscovery: boolean
  initialLegal: LegalState
}) {
  const leave = useLeave()
  const ids = useId()
  const [discovery, setDiscovery] = useState(initialDiscovery)
  const [legal, setLegal] = useState(initialLegal)
  const [agreed, setAgreed] = useState(initialLegal.satisfied)
  const [error, setError] = useState<string>()
  const [missing, setMissing] = useState<string[]>([])
  const [saving, setSaving] = useState<'finish' | 'later'>()
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)
  // One Idempotency-Key per document version, reused on retry (replay-safe).
  const keys = useRef(new Map<string, string>())

  const id = (name: string) => `${ids}-${name}`
  const [terms, privacy] = (['TERMS_ACCEPTANCE', 'PRIVACY_DATA_PROCESSING'] as const).map((t) =>
    legal.documents.find((d) => d.type === t),
  )

  const saveVisibility = () =>
    apiRequest('/me/visibility', {
      method: 'PUT',
      body: {
        groups: [
          { group_code: 'PROFILE_DISCOVERY', level: discovery ? 'NETWORK_ONLY' : 'PRIVATE' },
        ],
      },
    })

  async function reloadLegal(): Promise<void> {
    const [{ documents }, consents] = await Promise.all([
      apiRequest<{ documents: LegalDoc[] }>('/legal/current'),
      apiRequest<{ items: Consent[] }>('/me/consents'),
    ])
    const next = legalFrom(documents, consents.items)
    setLegal(next)
    setAgreed(next.satisfied)
  }

  async function later() {
    if (inFlight.current) return
    inFlight.current = true
    setSaving('later')
    setError(undefined)
    setMissing([])
    try {
      await saveVisibility()
      leave('/')
    } catch {
      inFlight.current = false
      setSaving(undefined)
      setError(MESSAGES.saveFailed)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    setMissing([])
    if (!legal.satisfied && !agreed) {
      setError(MESSAGES.legalRequired)
      return
    }
    inFlight.current = true
    setSaving('finish')
    setError(undefined)
    const accepted = { ...legal.accepted }
    try {
      await saveVisibility()
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
      await apiRequest('/me/onboarding/complete', { method: 'POST' })
      // A document load, not a client navigation: completion changes what every
      // guard answers, so no page drawn before it may be shown again.
      window.location.assign('/onboarding/complete')
      // Stay busy while navigating, so nothing is sent twice.
    } catch (caught) {
      inFlight.current = false
      setSaving(undefined)
      const failure = caught as { code?: string; fields?: Record<string, string> } | null
      if (failure?.code === 'LEGAL_DOCUMENT_VERSION_STALE') {
        setError(MESSAGES.stale)
        await reloadLegal().catch(() => undefined)
      } else if (failure?.code === 'ONBOARDING_REQUIREMENTS_MISSING') {
        const fields = Object.keys(failure.fields ?? {})
        // An acceptance given for a version that is no longer the current one.
        if (fields.some((field) => legal.documents.some((d) => d.type === field))) {
          setError(MESSAGES.stale)
          await reloadLegal().catch(() => undefined)
        } else {
          setError(MESSAGES.missing)
          setMissing(fields)
        }
      } else {
        setError(MESSAGES.failed)
      }
    }
  }

  const busy = saving !== undefined
  const missingParts = MISSING.filter((m) => m.keys.some((k) => missing.includes(k)))

  return (
    <div className={styles.card} data-screen="ACC-09">
      <HeaderAction>
        <button type="button" disabled={busy} onClick={() => void later()}>
          Lưu và hoàn tất sau
        </button>
      </HeaderAction>
      <Surface as="section">
        <form onSubmit={onSubmit} noValidate aria-labelledby={id('title')}>
          <h1 id={id('title')} className={stage.title}>
            Rà soát hồ sơ trước khi hoàn tất
          </h1>
          <p className={styles.lede}>
            Kiểm tra lại thông tin. Bạn có thể sửa bất kỳ phần nào ngay bây giờ hoặc cập nhật sau
            trong Tài khoản của tôi.
          </p>

          <div className={styles.columns}>
            <div className={styles.main}>
              {parts.map((part, i) => (
                <section
                  key={part.title}
                  className={styles.part}
                  data-anchor={`part-${i + 1}`}
                  aria-labelledby={id(`part-${i}`)}
                >
                  <div className={styles.partHead}>
                    <span className={styles.partIndex} aria-hidden="true">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <h2 id={id(`part-${i}`)} className={styles.partTitle}>
                      {part.title}
                    </h2>
                    <Link
                      href={part.href}
                      className={styles.edit}
                      aria-label={`Sửa ${part.title}`}
                      data-nav={`edit-${i + 1}`}
                    >
                      Sửa
                    </Link>
                  </div>
                  <dl className={styles.rows}>
                    {part.rows.map((row) => (
                      <div key={row.label} style={{ display: 'contents' }}>
                        <dt>{row.label}</dt>
                        <dd data-empty={row.value ? undefined : 'true'}>
                          {row.value ?? row.empty}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}

              <label className={styles.confirm} data-anchor="confirm" data-legal>
                <input
                  id={id('legal')}
                  type="checkbox"
                  checked={agreed || legal.satisfied}
                  disabled={legal.satisfied || busy}
                  aria-describedby={error ? id('error') : id('legal-help')}
                  onChange={(e) => {
                    setAgreed(e.target.checked)
                    setError(undefined)
                  }}
                />
                <span className={styles.confirmBox} aria-hidden="true">
                  <svg viewBox="0 0 12 12" focusable="false">
                    <path d="M2 6.4l2.7 2.7L10 3" />
                  </svg>
                </span>
                <span>
                  <span className={styles.confirmTitle}>
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
                  </span>
                  <span id={id('legal-help')} className={styles.confirmBody}>
                    Bấm vào tên văn bản để đọc toàn văn. Hồ sơ được kích hoạt sau khi bạn đồng ý với
                    cả hai văn bản.
                  </span>
                </span>
              </label>

              {error ? (
                <div className={styles.confirmError} id={id('error')}>
                  <Notice tone="error">
                    {error}
                    {missingParts.length > 0 ? (
                      <>
                        {' '}
                        {missingParts.map((part, i) => (
                          <span key={part.href}>
                            {i > 0 ? '; ' : ''}
                            <Link href={part.href}>{part.label}</Link>
                          </span>
                        ))}
                        .
                      </>
                    ) : null}
                  </Notice>
                </div>
              ) : null}
            </div>

            <aside className={styles.side} aria-label="Hồ sơ của bạn">
              <div>
                <p className={styles.sideCaption}>HỒ SƠ KHI NGƯỜI KHÁC XEM</p>
                <div className={styles.preview} data-anchor="preview" data-preview>
                  <div className={styles.banner} />
                  <div className={styles.avatar}>
                    {preview.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview.avatar_url} alt="" />
                    ) : null}
                  </div>
                  <p className={styles.previewName}>{preview.display_name}</p>
                  {preview.line ? <p className={styles.previewLine}>{preview.line}</p> : null}
                  {/* Descriptive text only: a chip is no link, no badge of authority. */}
                  {preview.roles.length > 0 ? (
                    <ul className={styles.previewRoles} data-preview-roles>
                      {preview.roles.map((role) => (
                        <li key={role.label} data-pending={role.pending ? 'true' : undefined}>
                          {role.label}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {preview.domains.length > 0 ? (
                    <ul className={styles.previewChips}>
                      {preview.domains.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <section
                className={styles.completion}
                data-anchor="completion"
                data-completion
                aria-labelledby={id('completion')}
              >
                <div className={styles.completionHead}>
                  <h2 id={id('completion')} className={styles.completionTitle}>
                    Độ hoàn thiện hồ sơ
                  </h2>
                  <span className={styles.percent}>{completion.percent}%</span>
                </div>
                <div className={styles.bar} aria-hidden="true">
                  <div className={styles.barFill} style={{ width: `${completion.percent}%` }} />
                </div>
                {completion.missing.length > 0 ? (
                  <>
                    <p className={styles.missingCaption}>CÓ THỂ BỔ SUNG SAU</p>
                    <ul className={styles.missing}>
                      {completion.missing.map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                <p className={styles.completionNote}>
                  Hồ sơ chưa đủ 100% vẫn khám phá được nền tảng. Hệ thống chỉ hỏi thêm khi bạn đăng
                  ký một hoạt động cần trường đó.
                </p>
              </section>

              <div className={styles.visibility} data-anchor="visibility">
                <div className={styles.visibilityText}>
                  <p id={id('visibility')} className={styles.visibilityTitle}>
                    Hiển thị hồ sơ trong Mạng lưới
                  </p>
                  <p id={id('visibility-hint')} className={styles.visibilityHint}>
                    Chỉnh chi tiết trong Cài đặt hồ sơ.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  className={styles.switch}
                  aria-checked={discovery}
                  aria-labelledby={id('visibility')}
                  aria-describedby={id('visibility-hint')}
                  disabled={busy}
                  onClick={() => setDiscovery((on) => !on)}
                />
              </div>
            </aside>
          </div>

          <hr className={`${stage.rule} ${styles.end}`} data-anchor="rule" />

          <div className={styles.footer} data-anchor="footer">
            <Link
              href="/onboarding/purpose"
              className="ui-button"
              data-variant="secondary"
              data-nav="back"
            >
              <span>Quay lại</span>
            </Link>
            <span className={stage.spacer} />
            <button
              type="button"
              className={stage.later}
              disabled={busy}
              onClick={() => void later()}
            >
              Lưu và hoàn tất sau
            </button>
            <Button type="submit" loading={saving === 'finish'} disabled={busy}>
              Hoàn tất hồ sơ
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  )
}
