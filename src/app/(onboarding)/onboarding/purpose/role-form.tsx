'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { DeclaredRole } from '@/lib/onboarding/roles'

import { HeaderAction, Select, saveMessage, useLeave } from '../parts'
import { ROLE_COPY } from '../role-copy'
import stage from '../stage.module.css'
import styles from './role.module.css'

/**
 * ACC-08 — onboarding stage 3, "Bạn tham gia hệ sinh thái với vai trò nào?"
 * (BA workbook row 58; DEC-L1R-D5).
 *
 * Six self-declared roles, multi-select, none required. With "Thành viên HUB
 * Network" selected the member may name HUB units with the position and
 * period they held; each is stored as declared, shown "Chờ xác minh", and
 * grants nothing. The units become membership requests only when onboarding
 * is completed. "Tiếp tục" saves, records the stage as passed and opens
 * stage 4; "Lưu và hoàn tất sau" saves and leaves. The board's "AI đề xuất"
 * mark belongs to a suggested role, and there are none (D-A1).
 */

type Option = { id: string; label: string }
type Claim = { organization_id: string; position: string; period: string }

/** The server's bound (CLAIM_LIMITS.claims). */
const MAX_CLAIMS = 5
const EMPTY: Claim = { organization_id: '', position: '', period: '' }

/** Copy for states the board does not show. */
const MESSAGES = {
  unit: 'Vui lòng chọn đơn vị cho vị trí này.',
  unavailable: 'Đơn vị đã chọn không còn khả dụng. Vui lòng chọn lại.',
} as const

export function RoleForm({
  initial,
  units,
}: {
  initial: { roles: DeclaredRole[]; claims: Claim[] }
  units: Option[]
}) {
  const leave = useLeave()
  const ids = useId()
  const [roles, setRoles] = useState<DeclaredRole[]>(initial.roles)
  const [claims, setClaims] = useState<Claim[]>(
    initial.claims.length > 0 ? initial.claims : [EMPTY],
  )
  const [claimError, setClaimError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [saving, setSaving] = useState<'next' | 'later'>()
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)

  const id = (name: string) => `${ids}-${name}`
  const hubMember = roles.includes('HUB_MEMBER')

  const setClaim = (index: number, patch: Partial<Claim>) => {
    setClaims((list) => list.map((c, i) => (i === index ? { ...c, ...patch } : c)))
    setClaimError(undefined)
  }

  async function save(mode: 'next' | 'later') {
    if (inFlight.current) return
    setFormError(undefined)
    setClaimError(undefined)

    // A row left entirely empty is not a claim; a row with text needs its unit.
    const filled = hubMember
      ? claims.filter((c) => c.organization_id || c.position.trim() || c.period.trim())
      : []
    if (filled.some((c) => !c.organization_id)) {
      setClaimError(MESSAGES.unit)
      return
    }

    inFlight.current = true
    setSaving(mode)
    try {
      await apiRequest('/me/onboarding/roles', {
        method: 'PUT',
        body: {
          roles,
          hub_claims: filled.map((c) => ({
            organization_id: c.organization_id,
            position: c.position.trim() || null,
            period: c.period.trim() || null,
          })),
        },
      })
      if (mode === 'next') {
        await apiRequest('/me/onboarding/stage', { method: 'PUT', body: { completed: 'ROLE' } })
      }
      leave(mode === 'next' ? '/onboarding/privacy' : '/')
      // Stay busy while navigating, so the mutation cannot repeat.
    } catch (caught) {
      inFlight.current = false
      setSaving(undefined)
      const fields = (caught as { fields?: Record<string, string> } | null)?.fields
      if (fields?.hub_claims === 'organization_not_available') {
        setClaimError(MESSAGES.unavailable)
      } else {
        setFormError(saveMessage(caught))
      }
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save('next')
  }

  const busy = saving !== undefined

  return (
    <div className={styles.card} data-screen="ACC-08">
      <HeaderAction>
        <button type="button" disabled={busy} onClick={() => void save('later')}>
          Lưu và hoàn tất sau
        </button>
      </HeaderAction>
      <Surface as="section">
        <form onSubmit={onSubmit} noValidate aria-labelledby={id('title')}>
          <h1 id={id('title')} className={stage.title}>
            Bạn tham gia hệ sinh thái với vai trò nào?
          </h1>
          <div className={styles.head}>
            <p className={stage.eyebrow}>Chọn nhiều</p>
            <span className={styles.count} aria-live="polite">
              ĐÃ CHỌN {roles.length}
            </span>
          </div>

          <fieldset className={styles.roles} aria-labelledby={id('title')} data-anchor="roles">
            {ROLE_COPY.map((role) => (
              <label key={role.code} className={styles.role} data-role={role.code}>
                <input
                  type="checkbox"
                  className={stage.srOnly}
                  name="roles"
                  value={role.code}
                  checked={roles.includes(role.code)}
                  onChange={(e) =>
                    setRoles((current) =>
                      e.target.checked
                        ? [...current, role.code]
                        : current.filter((r) => r !== role.code),
                    )
                  }
                />
                <span className={styles.box} aria-hidden="true">
                  <svg viewBox="0 0 12 12" focusable="false">
                    <path d="M2 6.4l2.7 2.7L10 3" />
                  </svg>
                </span>
                <span>
                  <span className={styles.roleName}>{role.name}</span>
                  <span className={styles.roleBody}>{role.body}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {hubMember ? (
            <section className={styles.panel} data-anchor="hub" aria-labelledby={id('hub')}>
              <div className={styles.panelHead}>
                <div>
                  <p className={styles.panelEyebrow}>VÌ BẠN CHỌN “THÀNH VIÊN HUB NETWORK”</p>
                  <h2 id={id('hub')} className={styles.panelTitle}>
                    Vị trí tại HUB Network
                  </h2>
                </div>
                <span className={styles.pending} data-badge="pending">
                  Chờ xác minh
                </span>
              </div>

              <ol className={styles.claims}>
                {claims.map((claim, i) => {
                  const taken = claims
                    .filter((_, n) => n !== i)
                    .map((c) => c.organization_id)
                    .filter(Boolean)
                  return (
                    <li key={i} className={styles.claim} data-claim={i}>
                      <div>
                        <label className={stage.label} htmlFor={id(`unit-${i}`)}>
                          Đơn vị
                        </label>
                        <div className={styles.claimControl}>
                          <Select
                            id={id(`unit-${i}`)}
                            name={`unit-${i}`}
                            value={claim.organization_id}
                            // One claim per unit: a unit picked in another row is not offered.
                            options={units.filter((u) => !taken.includes(u.id))}
                            placeholder="Chọn đơn vị"
                            invalid={Boolean(claimError) && !claim.organization_id}
                            describedBy={claimError ? id('claim-error') : undefined}
                            onChange={(value) => setClaim(i, { organization_id: value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={stage.label} htmlFor={id(`position-${i}`)}>
                          Chức vụ
                        </label>
                        <div className={styles.claimControl}>
                          <input
                            id={id(`position-${i}`)}
                            className="ui-input"
                            name={`position-${i}`}
                            autoComplete="organization-title"
                            maxLength={200}
                            value={claim.position}
                            onChange={(e) => setClaim(i, { position: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <label className={stage.label} htmlFor={id(`period-${i}`)}>
                          Thời gian
                        </label>
                        <div className={styles.claimControl}>
                          <input
                            id={id(`period-${i}`)}
                            className="ui-input"
                            name={`period-${i}`}
                            maxLength={100}
                            value={claim.period}
                            onChange={(e) => setClaim(i, { period: e.target.value })}
                          />
                        </div>
                      </div>
                      {i > 0 ? (
                        <button
                          type="button"
                          className={styles.remove}
                          onClick={() => setClaims((list) => list.filter((_, n) => n !== i))}
                        >
                          Bỏ vị trí này
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ol>
              {claimError ? (
                <p id={id('claim-error')} role="alert" className={stage.error}>
                  {claimError}
                </p>
              ) : null}
              {claims.length < Math.min(MAX_CLAIMS, units.length) ? (
                <button
                  type="button"
                  className={styles.addClaim}
                  onClick={() => setClaims((list) => [...list, EMPTY])}
                >
                  + Thêm vị trí khác (ví dụ: nhiệm kỳ trước)
                </button>
              ) : null}
              <p className={styles.panelNote}>
                Chức vụ tại HUB Network chỉ hiển thị là Đã xác minh sau khi quản trị viên hoặc đơn
                vị liên quan xác nhận. Trong lúc chờ, hồ sơ ghi “Chờ xác minh” và lựa chọn này không
                cấp quyền quản trị HUB Chapter hay CLB.
              </p>
            </section>
          ) : null}

          <div className={styles.info} data-anchor="info">
            <span className={styles.infoIcon} aria-hidden="true">
              i
            </span>
            <p className={styles.infoText}>
              Các lựa chọn trên được sử dụng để cá nhân hóa trải nghiệm. Vai trò đại diện, quyền
              quản trị và các chức vụ chính thức chỉ được xác lập sau khi có quan hệ hoặc phân công
              hợp lệ.
            </p>
          </div>

          {formError ? (
            <div className={stage.formError}>
              <Notice tone="error">{formError}</Notice>
            </div>
          ) : null}

          <hr className={`${stage.rule} ${styles.end}`} data-anchor="rule" />

          <div className={styles.footer} data-anchor="footer">
            <Link
              href="/onboarding/capability"
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
              onClick={() => void save('later')}
            >
              Lưu và hoàn tất sau
            </button>
            <Button type="submit" loading={saving === 'next'} disabled={busy}>
              Tiếp tục
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  )
}
