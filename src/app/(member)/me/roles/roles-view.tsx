'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { NetworkDTO } from '@/lib/network/network'

import { roleRows, selectableOrganizations } from './roles-model'
import styles from './roles.module.css'

/**
 * WF02-S04 — Roles & network links body (/me/roles), inside the member shell.
 * Approved baseline: design-reference/final/WF02/WF02-S04__roles-network-links__1440x900.png
 * Decisions DEC-WF02-H5/H11, DEC-WF02-S04-G1..G5, DEC-WF02-S04-D1..D4.
 *
 * "Vai trò theo tổ chức" lists canonical records from GET /me/network,
 * read-only. The activity journal is Future and not rendered. The only write
 * is the membership request (G5 addendum): one selector and one action,
 * posting to /me/membership-requests; the result is always PENDING_APPROVAL.
 */

type Option = { id: string; name: string; type: string }
type NetworkState =
  { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; network: NetworkDTO }

/** Copy the approved bitmap does not carry; pending PO copy review (DEC-WF02-S04-D3). */
const COPY = {
  lede: 'Tổng hợp những gì hệ thống ghi về bạn. Bạn không sửa được ở đây — mỗi dòng đến từ một việc đã xảy ra.',
  empty: 'Chưa có vai trò nào được ghi nhận.',
  loadFailed: 'Không tải được vai trò của bạn.',
  retry: 'Thử lại',
  requestLabel: 'Tổ chức',
  requestPlaceholder: 'Chọn tổ chức',
  requestButton: 'Gửi yêu cầu',
  requestHint: 'Yêu cầu sẽ ở trạng thái chờ duyệt cho đến khi tổ chức xác nhận.',
  noneLeft: 'Không còn tổ chức nào để gửi yêu cầu.',
  choose: 'Vui lòng chọn một tổ chức.',
  sent: 'Đã gửi yêu cầu. Trạng thái: đang chờ duyệt.',
  conflict: 'Bạn đã có tư cách thành viên hoặc một yêu cầu đang chờ ở tổ chức này.',
  notFound: 'Tổ chức này hiện không nhận yêu cầu.',
  failed: 'Chưa gửi được yêu cầu. Vui lòng thử lại.',
} as const

export function RolesView({ options }: { options: Option[] }) {
  const [network, setNetwork] = useState<NetworkState>({ kind: 'loading' })
  const [target, setTarget] = useState('')
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string }>()
  const inFlight = useRef(false)
  // One Idempotency-Key per organisation, reused on retry (replay-safe).
  const keys = useRef(new Map<string, string>())

  const loadNetwork = useCallback(async () => {
    setNetwork({ kind: 'loading' })
    try {
      setNetwork({ kind: 'ready', network: await apiRequest<NetworkDTO>('/me/network') })
    } catch {
      setNetwork({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void loadNetwork()
  }, [loadNetwork])

  async function submit() {
    if (inFlight.current) return
    if (!target) {
      setMessage({ tone: 'error', text: COPY.choose })
      return
    }
    inFlight.current = true
    setSending(true)
    setMessage(undefined)
    const key = keys.current.get(target) ?? crypto.randomUUID()
    keys.current.set(target, key)
    try {
      await apiRequest('/me/membership-requests', {
        method: 'POST',
        body: { organization_id: target },
        idempotencyKey: key,
      })
      setTarget('')
      setMessage({ tone: 'info', text: COPY.sent })
    } catch (caught) {
      const code = (caught as { code?: string } | null)?.code
      setMessage({
        tone: 'error',
        text:
          code === 'MEMBERSHIP_INVALID_TRANSITION'
            ? COPY.conflict
            : code === 'UNCONTRACTED_NOT_FOUND'
              ? COPY.notFound
              : COPY.failed,
      })
    } finally {
      // The canonical read model is the only source of the resulting state.
      await loadNetwork()
      inFlight.current = false
      setSending(false)
    }
  }

  const rows = network.kind === 'ready' ? roleRows(network.network) : []
  const choices = network.kind === 'ready' ? selectableOrganizations(options, network.network) : []

  return (
    <div className={styles.page}>
      <h1 className={`type-heading-2 ${styles.title}`}>Vai trò &amp; liên kết</h1>
      <p className={`type-body-md ${styles.lede}`}>{COPY.lede}</p>

      <div className={styles.card} data-card="roles" aria-busy={network.kind === 'loading'}>
        <Surface as="section">
          <h2 className={`weight-semibold ${styles.eyebrow}`}>VAI TRÒ THEO TỔ CHỨC</h2>
          {network.kind === 'failed' ? (
            <div className={styles.failed} role="alert" data-state="network-failed">
              <p className="type-body-sm">{COPY.loadFailed}</p>
              <button
                type="button"
                className={`type-body-sm ${styles.retry}`}
                onClick={loadNetwork}
              >
                {COPY.retry}
              </button>
            </div>
          ) : network.kind === 'ready' && rows.length === 0 ? (
            <p className={`type-body-sm ${styles.empty}`} data-state="network-empty">
              {COPY.empty}
            </p>
          ) : (
            <ul className={styles.rows}>
              {rows.map((row) => (
                <li
                  key={row.key}
                  className={styles.row}
                  data-kind={row.kind}
                  data-pending={row.pending || undefined}
                >
                  <span className={`type-body-md weight-semibold ${styles.name}`}>{row.name}</span>
                  <span className={`weight-medium ${styles.chip}`}>{row.chip}</span>
                  <span className={`type-body-md ${row.pending ? styles.pending : styles.role}`}>
                    {row.role}
                  </span>
                  <span className={`type-meta-xs ${styles.trust}`}>{row.trust}</span>
                </li>
              ))}
            </ul>
          )}
        </Surface>
      </div>

      <div className={styles.card} data-card="request">
        <Surface as="section">
          <h2 className={`weight-semibold ${styles.eyebrow}`}>YÊU CẦU THAM GIA TỔ CHỨC</h2>
          {network.kind === 'ready' && choices.length === 0 ? (
            <p className={`type-body-sm ${styles.empty}`} data-state="request-none">
              {COPY.noneLeft}
            </p>
          ) : (
            <div className={styles.request}>
              <label className={styles.field}>
                <span className="type-meta-xs weight-medium">{COPY.requestLabel}</span>
                <select
                  className={`type-body-md ${styles.select}`}
                  value={target}
                  disabled={sending || network.kind !== 'ready'}
                  onChange={(e) => {
                    setTarget(e.target.value)
                    setMessage(undefined)
                  }}
                >
                  <option value="">{COPY.requestPlaceholder}</option>
                  {choices.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button loading={sending} disabled={network.kind !== 'ready'} onClick={submit}>
                {COPY.requestButton}
              </Button>
            </div>
          )}
          <p className={`type-meta-xs ${styles.hint}`}>{COPY.requestHint}</p>
          {message ? (
            <div
              className={styles.notice}
              data-state={message.tone === 'info' ? 'request-sent' : 'request-error'}
            >
              <Notice tone={message.tone}>{message.text}</Notice>
            </div>
          ) : null}
        </Surface>
      </div>
    </div>
  )
}
