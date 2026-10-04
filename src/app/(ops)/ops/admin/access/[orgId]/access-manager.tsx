'use client'

import { useCallback, useEffect, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import { CAPABILITY_MATRIX } from '@/lib/authz/matrix'

import styles from '../../admin.module.css'
import {
  AdminActionNotice,
  AdminEmpty,
  AdminLoadFailure,
  AdminLoading,
  classifyAdminError,
  fieldReason,
  adminDate,
} from '../../shared'

/**
 * ADMIN-PROD-06 — one unit's delegated access (05 §27, A10; PD-6): active
 * grants, revoked history, grant and revoke. The capability choices come from
 * the real authorization matrix (`CAPABILITY_MATRIX`, `delegable: true`) —
 * never a hand-picked list — but the server alone decides whether a grant is
 * actually valid for this unit and this grantor; a rejected attempt shows the
 * server's own field reason, never a guessed one.
 */

const COPY = {
  subtitle: 'Phân quyền đơn vị',
  active: 'Đang hiệu lực',
  closed: 'Đã thu hồi',
  columns: ['Người được cấp', 'Phạm vi', 'Cấp bởi', 'Từ ngày'],
  none: 'Chưa có quyền nào đang hiệu lực.',
  noHistory: 'Chưa có lịch sử.',
  revoke: 'Thu hồi',
  confirmRevoke: 'Xác nhận thu hồi quyền này?',
  grantTitle: 'Cấp quyền mới',
  granteeLabel: 'Profile ID người được cấp',
  granteeHint: 'Dán profile id (xem trong Thành viên của đơn vị).',
  scopeLabel: 'Phạm vi',
  wholeRole: 'Toàn bộ vai trò Trưởng đơn vị',
  grant: 'Cấp quyền',
  history: 'Lịch sử cấp / thu hồi',
  granted: 'đã cấp',
  revoked: 'đã thu hồi',
  hidden: 'Hồ sơ không công khai',
} as const

/** The real, frozen set of PD-6-delegable capabilities — never a hand-picked list. */
const DELEGABLE = CAPABILITY_MATRIX.filter((r) => r.delegable).map((r) => r.capability)

type Grant = {
  id: string
  role_code: string
  capability: string | null
  grantee: { profile_id: string; display_name: string | null }
  granted_by_profile_id: string | null
  created_at: string
  revoked_at: string | null
  state: 'ACTIVE' | 'CLOSED'
  can_revoke: boolean
}

type HistoryEntry = {
  event: 'GRANTED' | 'REVOKED'
  at: string
  grantee_profile_id: string | null
  capability: string | null
}

type State =
  | { kind: 'loading' }
  | { kind: 'failed'; failure: ReturnType<typeof classifyAdminError> }
  | { kind: 'ready'; active: Grant[]; history: HistoryEntry[] }

export function AccessManager({ organization }: { organization: { id: string; name: string } }) {
  const [state, setState] = useState<State>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [grantee, setGrantee] = useState('')
  const [capability, setCapability] = useState('')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const base = `/ops/organizations/${organization.id}`

  const load = useCallback(async () => {
    try {
      const [active, history] = await Promise.all([
        apiRequest<{ items: Grant[] }>(`${base}/access?state=ACTIVE`),
        apiRequest<{ items: HistoryEntry[] }>(`${base}/access/history`),
      ])
      setState({ kind: 'ready', active: active.items, history: history.items })
    } catch (error) {
      setState({ kind: 'failed', failure: classifyAdminError(error) })
    }
  }, [base])

  useEffect(() => {
    void load()
  }, [load])

  const grant = async () => {
    setBusy(true)
    setNotice(null)
    setFieldError(null)
    try {
      await apiRequest(`${base}/access`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        body: { grantee_profile_id: grantee.trim(), capability: capability || null },
      })
      setGrantee('')
      setCapability('')
      await load()
    } catch (error) {
      const reason = fieldReason(error)
      if (reason) setFieldError(reason)
      else setNotice('Không cấp được quyền. Tải lại để xem trạng thái mới nhất.')
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (id: string) => {
    setBusy(true)
    setNotice(null)
    try {
      await apiRequest(`${base}/access/${id}/revoke`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
      })
      setRevoking(null)
      await load()
    } catch {
      setNotice('Không thu hồi được quyền. Tải lại để xem trạng thái mới nhất.')
      await load().catch(() => undefined)
    } finally {
      setBusy(false)
    }
  }

  if (state.kind !== 'ready') {
    return (
      <div className={styles.page} data-screen="ADMIN-ACCESS-MANAGER">
        {state.kind === 'loading' ? (
          <AdminLoading />
        ) : (
          <AdminLoadFailure failure={state.failure} onRetry={() => void load()} />
        )}
      </div>
    )
  }

  return (
    <div className={styles.page} data-screen="ADMIN-ACCESS-MANAGER">
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{organization.name}</h1>
          <p className={styles.subtitle}>{COPY.subtitle}</p>
        </div>
      </header>

      {notice ? <AdminActionNotice tone="error" text={notice} /> : null}

      <section className={styles.card} data-card="active">
        <h2 className={styles.eyebrow}>{COPY.active}</h2>
        {state.active.length === 0 ? (
          <AdminEmpty label={COPY.none} />
        ) : (
          <div className={styles.table} role="table" aria-label={COPY.active}>
            <div className={`${styles.head} ${styles.colsGrants}`} role="row">
              {COPY.columns.map((c) => (
                <span key={c} role="columnheader" className={styles.cell}>
                  {c}
                </span>
              ))}
            </div>
            {state.active.map((g) => (
              <div
                key={g.id}
                role="row"
                className={`${styles.row} ${styles.colsGrants}`}
                data-grant-row={g.id}
              >
                <span role="cell" className={`${styles.cell} ${styles.cellName}`}>
                  {g.grantee.display_name ?? COPY.hidden}
                </span>
                <span role="cell" className={styles.cell}>
                  {g.capability ?? COPY.wholeRole}
                </span>
                <span role="cell" className={styles.cell}>
                  {g.granted_by_profile_id ?? '—'}
                </span>
                <span role="cell" className={`${styles.cell} ${styles.actions}`}>
                  {adminDate(g.created_at)}
                  {g.can_revoke && revoking !== g.id ? (
                    <button
                      type="button"
                      className={styles.textAction}
                      disabled={busy}
                      onClick={() => setRevoking(g.id)}
                      data-action="revoke"
                    >
                      {' '}
                      {COPY.revoke}
                    </button>
                  ) : null}
                </span>
                {revoking === g.id ? (
                  <div
                    className={`${styles.confirmForm} ${styles.rowSpan}`}
                    data-revoke-confirm={g.id}
                  >
                    <p className={styles.confirmText}>{COPY.confirmRevoke}</p>
                    <button
                      type="button"
                      className={styles.danger}
                      disabled={busy}
                      onClick={() => void revoke(g.id)}
                    >
                      {COPY.revoke}
                    </button>
                    {/* Focus the safe choice, so a stray Enter never revokes. */}
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setRevoking(null)}
                      autoFocus
                    >
                      Huỷ
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className={styles.card} data-card="grant">
        <h2 className={styles.eyebrow}>{COPY.grantTitle}</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void grant()
          }}
          data-grant-form
        >
          <label className="type-body-sm">
            {COPY.granteeLabel}
            <br />
            <input
              className={`${styles.input} ${styles.inputWide}`}
              value={grantee}
              onChange={(e) => setGrantee(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              required
            />
          </label>
          <p className={`${styles.line} ${styles.muted}`}>{COPY.granteeHint}</p>
          <label className="type-body-sm">
            {COPY.scopeLabel}
            <br />
            <select
              className={styles.select}
              value={capability}
              onChange={(e) => setCapability(e.target.value)}
            >
              <option value="">{COPY.wholeRole}</option>
              {DELEGABLE.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          {fieldError ? <p className={styles.fieldError}>{fieldError}</p> : null}
          <div className={styles.confirmForm}>
            <button type="submit" className={styles.primary} disabled={busy || !grantee.trim()}>
              {COPY.grant}
            </button>
          </div>
        </form>
      </section>

      <section className={`${styles.card} ${styles.muted}`} data-card="history">
        <h2 className={styles.eyebrow}>{COPY.history}</h2>
        {state.history.length === 0 ? (
          <AdminEmpty label={COPY.noHistory} />
        ) : (
          <ol className={styles.history}>
            {state.history.map((h, i) => (
              <li key={i} className={styles.historyEntry}>
                <span className={styles.historyWhen}>{adminDate(h.at)}</span>
                <span className={styles.historyWhat}>
                  {h.event === 'GRANTED' ? COPY.granted : COPY.revoked} ·{' '}
                  {h.capability ?? COPY.wholeRole}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
