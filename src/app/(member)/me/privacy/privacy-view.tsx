'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { CombinedLegalLink } from '@/components/legal/combined-legal-link'
import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'

import {
  currentStatus,
  formatDate,
  historyRows,
  missingDocuments,
  type Consent,
  type LegalDoc,
} from './privacy-model'
import styles from './privacy.module.css'

/**
 * WF02-S03 — Privacy & visibility body (/me/privacy), inside the member shell.
 * Approved baseline: design-reference/final/WF02/WF02-S03__privacy-visibility__1440x900.png
 * Decisions DEC-WF02-H3/H4 and DEC-WF02-S03-D1..D6.
 *
 * P0 scope (H4): the PROFILE_DISCOVERY switch (ON = NETWORK_ONLY, OFF =
 * PRIVATE; never PUBLIC), the current Terms/Privacy status with re-acceptance
 * of a new version, and the consent history. Visibility and consent stay two
 * separate controls and two separate APIs (/me/visibility, /me/consents).
 * Viewer history, data export, "view as others", Future purposes and consent
 * revocation are not rendered.
 */

type Level = 'NETWORK_ONLY' | 'PRIVATE'
type VisibilityDTO = { groups: { group_code: string; level: string }[] }

type VisibilityState = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; level: Level }
type LegalState =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'ready'; documents: LegalDoc[]; consents: Consent[] }

/** Copy the approved bitmap does not carry verbatim; pending PO copy review (DEC-WF02-S03-D2). */
const COPY = {
  lede: 'Bạn quyết định ai thấy thẻ hồ sơ của mình. Thay đổi có hiệu lực ngay.',
  discoveryTitle: 'Hiện thẻ của tôi trong Thư viện',
  discoveryHint: 'Chỉ thành viên mạng lưới thấy. Tắt thì không ai tìm ra bạn.',
  saveFailed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
  loadFailed: 'Không tải được dữ liệu.',
  retry: 'Thử lại',
  read: 'Đọc',
  acceptedOn: 'đã đồng ý',
  notAccepted: 'chưa đồng ý phiên bản này',
  reacceptLead: 'Văn bản đã có phiên bản mới. Tôi đồng ý với',
  reacceptButton: 'Đồng ý phiên bản mới',
  reacceptRequired: 'Vui lòng đánh dấu đồng ý trước.',
  stale: 'Văn bản vừa được cập nhật. Vui lòng xem lại và đồng ý với phiên bản mới.',
  noHistory: 'Chưa có bản ghi đồng ý nào.',
} as const

function levelOf(dto: VisibilityDTO): Level {
  const level = dto.groups.find((g) => g.group_code === 'PROFILE_DISCOVERY')?.level
  return level === 'PRIVATE' ? 'PRIVATE' : 'NETWORK_ONLY'
}

function Retry({ onClick, state }: { onClick: () => void; state: string }) {
  return (
    <div className={styles.failed} role="alert" data-state={state}>
      <p className="type-body-sm">{COPY.loadFailed}</p>
      <button type="button" className={`type-body-sm ${styles.retry}`} onClick={onClick}>
        {COPY.retry}
      </button>
    </div>
  )
}

export function PrivacyView() {
  const [visibility, setVisibility] = useState<VisibilityState>({ kind: 'loading' })
  const [saving, setSaving] = useState(false)
  const [visibilityError, setVisibilityError] = useState(false)
  const [legal, setLegal] = useState<LegalState>({ kind: 'loading' })
  const [agreed, setAgreed] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [legalError, setLegalError] = useState<string>()
  // One Idempotency-Key per document version, reused on retry (as WF01-S07).
  const keys = useRef(new Map<string, string>())
  const inFlight = useRef(false)

  const loadVisibility = useCallback(async () => {
    setVisibility({ kind: 'loading' })
    try {
      setVisibility({
        kind: 'ready',
        level: levelOf(await apiRequest<VisibilityDTO>('/me/visibility')),
      })
    } catch {
      setVisibility({ kind: 'failed' })
    }
  }, [])

  const loadLegal = useCallback(async () => {
    try {
      const [current, consents] = await Promise.all([
        apiRequest<{ documents: LegalDoc[] }>('/legal/current'),
        apiRequest<{ items: Consent[] }>('/me/consents'),
      ])
      setLegal({ kind: 'ready', documents: current.documents, consents: consents.items })
    } catch {
      setLegal({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void loadVisibility()
    void loadLegal()
  }, [loadVisibility, loadLegal])

  async function toggleDiscovery() {
    if (visibility.kind !== 'ready' || saving) return
    const next: Level = visibility.level === 'NETWORK_ONLY' ? 'PRIVATE' : 'NETWORK_ONLY'
    setSaving(true)
    setVisibilityError(false)
    try {
      const dto = await apiRequest<VisibilityDTO>('/me/visibility', {
        method: 'PUT',
        body: { groups: [{ group_code: 'PROFILE_DISCOVERY', level: next }] },
      })
      // The server's answer is the state shown, never the optimistic guess.
      setVisibility({ kind: 'ready', level: levelOf(dto) })
    } catch {
      setVisibilityError(true)
    } finally {
      setSaving(false)
    }
  }

  async function reaccept(missing: LegalDoc[]) {
    if (inFlight.current) return
    if (!agreed) {
      setLegalError(COPY.reacceptRequired)
      return
    }
    inFlight.current = true
    setAccepting(true)
    setLegalError(undefined)
    try {
      // Only the missing current documents; an accepted one is never re-sent.
      for (const doc of missing) {
        const slot = `${doc.type}:${doc.version}`
        const key = keys.current.get(slot) ?? crypto.randomUUID()
        keys.current.set(slot, key)
        await apiRequest('/me/consents/accept', {
          method: 'POST',
          body: { consent_type: doc.type, policy_version: doc.version },
          idempotencyKey: key,
        })
      }
      setAgreed(false)
    } catch (caught) {
      const code = (caught as { code?: string } | null)?.code
      setLegalError(code === 'LEGAL_DOCUMENT_VERSION_STALE' ? COPY.stale : COPY.saveFailed)
      setAgreed(false)
    } finally {
      await loadLegal()
      inFlight.current = false
      setAccepting(false)
    }
  }

  const status = legal.kind === 'ready' ? currentStatus(legal.documents, legal.consents) : []
  const missing = missingDocuments(status)

  return (
    <div className={styles.page}>
      <h1 className={`type-heading-2 ${styles.title}`}>Quyền riêng tư &amp; hiển thị</h1>
      <p className={`type-body-md ${styles.lede}`}>{COPY.lede}</p>

      <div className={styles.card} data-card="visibility" aria-busy={visibility.kind === 'loading'}>
        <Surface as="section">
          <h2 className={`weight-semibold ${styles.eyebrow}`}>HIỂN THỊ HỒ SƠ</h2>
          {visibility.kind === 'failed' ? (
            <Retry onClick={loadVisibility} state="visibility-failed" />
          ) : (
            <div className={styles.row}>
              <div>
                <p id="discovery-title" className={`type-body-md ${styles.rowTitle}`}>
                  {COPY.discoveryTitle}
                </p>
                <p id="discovery-hint" className={`type-meta-xs ${styles.muted}`}>
                  {COPY.discoveryHint}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                className={styles.switch}
                aria-checked={visibility.kind === 'ready' && visibility.level === 'NETWORK_ONLY'}
                aria-labelledby="discovery-title"
                aria-describedby="discovery-hint"
                disabled={visibility.kind !== 'ready' || saving}
                aria-busy={saving || undefined}
                onClick={toggleDiscovery}
              />
            </div>
          )}
          {visibilityError ? (
            <div className={styles.notice}>
              <Notice tone="error">{COPY.saveFailed}</Notice>
            </div>
          ) : null}
        </Surface>
      </div>

      <div className={styles.card} data-card="legal" aria-busy={legal.kind === 'loading'}>
        <Surface as="section">
          <h2 className={`weight-semibold ${styles.eyebrow}`}>ĐIỀU KHOẢN ĐANG ÁP DỤNG</h2>
          {legal.kind === 'failed' ? (
            <Retry onClick={loadLegal} state="legal-failed" />
          ) : (
            <ul className={styles.list}>
              {status.map(({ doc, acceptedAt }) => (
                <li key={doc.type} className={styles.row} data-doc={doc.type}>
                  <div>
                    <p className={`type-body-md ${styles.rowTitle}`}>{doc.title}</p>
                    <p
                      className={`type-meta-xs ${acceptedAt ? styles.muted : styles.warning}`}
                      data-accepted={acceptedAt ? 'true' : 'false'}
                    >
                      Phiên bản {doc.version} ·{' '}
                      {acceptedAt
                        ? `${COPY.acceptedOn} ${formatDate(acceptedAt)}`
                        : COPY.notAccepted}
                    </p>
                  </div>
                  <a
                    href={doc.content_url}
                    target="_blank"
                    rel="noopener"
                    className={`type-body-sm weight-medium ${styles.link}`}
                  >
                    {COPY.read}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {legal.kind === 'ready' && missing.length > 0 ? (
            <div className={styles.reaccept} data-reaccept>
              <label className={`type-body-sm ${styles.ack}`}>
                <input
                  type="checkbox"
                  className={styles.checkbox}
                  checked={agreed}
                  disabled={accepting}
                  onChange={(e) => {
                    setAgreed(e.target.checked)
                    setLegalError(undefined)
                  }}
                />
                <span>
                  {COPY.reacceptLead}{' '}
                  {/* Both documents due: the one combined entry point
                      (DEC-LEGAL-V1-D5). Only one due: that document alone. */}
                  {missing.length > 1 ? (
                    <CombinedLegalLink />
                  ) : (
                    missing.map((doc) => (
                      <a key={doc.type} href={doc.content_url} target="_blank" rel="noopener">
                        {doc.title}
                      </a>
                    ))
                  )}
                  .
                </span>
              </label>
              <Button loading={accepting} onClick={() => reaccept(missing)}>
                {COPY.reacceptButton}
              </Button>
            </div>
          ) : null}
          {legalError ? (
            <div className={styles.notice}>
              <Notice tone="error">{legalError}</Notice>
            </div>
          ) : null}
        </Surface>
      </div>

      <div className={styles.card} data-card="history" aria-busy={legal.kind === 'loading'}>
        <Surface as="section">
          <h2 className={`weight-semibold ${styles.eyebrow}`}>LỊCH SỬ ĐỒNG Ý</h2>
          {legal.kind === 'failed' ? (
            <Retry onClick={loadLegal} state="history-failed" />
          ) : legal.kind === 'ready' ? (
            legal.consents.length === 0 ? (
              <p className={`type-body-sm ${styles.muted}`}>{COPY.noHistory}</p>
            ) : (
              <ul className={styles.list}>
                {historyRows(legal.documents, legal.consents).map((row) => (
                  <li key={row.id} className={styles.row} data-history={row.state}>
                    <div>
                      <p className={`type-body-md ${styles.rowTitle}`}>{row.title}</p>
                      <p className={`type-meta-xs ${styles.muted}`}>{row.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </Surface>
      </div>
    </div>
  )
}
