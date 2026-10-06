'use client'

import Link from 'next/link'
import { useId, useRef, useState, type FormEvent } from 'react'

import { Button, Notice, Surface } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import {
  duplicateRows,
  HUB_LEVELS,
  HUB_POSITIONS,
  LEVEL_LABELS,
  monthNow,
  monthText,
  parseMonthText,
  PENDING_LABEL,
  periodError,
  POSITION_LABELS,
  POSITION_LIMITS,
  type HubLevel,
  type HubPosition,
  type PositionDeclaration,
} from '@/lib/onboarding/hub-position'
import type { DeclaredRole, HubCatalog, HubClaimDTO } from '@/lib/onboarding/roles'

import { HeaderAction, Select, saveMessage, useLeave } from '../parts'
import { ROLE_COPY } from '../role-copy'
import stage from '../stage.module.css'
import styles from './role.module.css'

/**
 * ACC-08 — onboarding stage 3, "Bạn tham gia hệ sinh thái với vai trò nào?"
 * (BA workbook row 58; DEC-L1R-D5; S1-UAT-03, DEC-S1O).
 *
 * Six self-declared roles, multi-select, at least one to continue (US-01.10).
 * With "Thành viên HUB Network" the member declares 1–10 positions at HUB
 * Network (US-01.11, FB-11..13; rules in lib/onboarding/hub-position): Cấp
 * đơn vị, Đơn vị from the canonical catalogue (a CLB after its Chapter; only
 * Chapters with CLBs), Chức vụ (+ Tên Ban / Ghi rõ), Từ – Đến MM/YYYY or "Tôi
 * đang trong nhiệm kỳ hoạt động". Each row is "Chờ xác minh" and grants
 * nothing. Unticking "Thành viên HUB Network" with rows asks first, then
 * drops them. The units become membership requests only when onboarding is
 * completed (one verification request per position is S1-UAT-03B's).
 * "Tiếp tục" saves, records the stage and opens stage 4; "Lưu và hoàn tất
 * sau" saves and leaves. The server re-checks every rule.
 */

type Row = {
  level: HubLevel | ''
  /** A CLB row's Chapter, chosen first. */
  chapter_id: string
  organization_id: string
  position: HubPosition | ''
  board_name: string
  position_other: string
  /** "MM/YYYY" as typed. */
  from: string
  to: string
  current: boolean
}

const EMPTY: Row = {
  level: '',
  chapter_id: '',
  organization_id: '',
  position: '',
  board_name: '',
  position_other: '',
  from: '',
  to: '',
  current: false,
}

/** Copy for states the board does not show. */
const MESSAGES = {
  noRole: 'Vui lòng chọn ít nhất một vai trò.',
  noPosition: 'Vui lòng khai ít nhất một vị trí tại HUB Network.',
  level: 'Chọn cấp đơn vị.',
  chapter: 'Chọn Chapter trước.',
  unit: 'Chọn đơn vị.',
  clb: 'Chọn CLB.',
  position: 'Chọn chức vụ.',
  board: 'Nhập tên Ban.',
  other: 'Ghi rõ chức vụ.',
  month: 'Nhập theo dạng MM/YYYY.',
  from_required: 'Nhập thời gian bắt đầu (MM/YYYY).',
  to_required: 'Nhập thời gian kết thúc hoặc chọn “Tôi đang trong nhiệm kỳ hoạt động”.',
  future_month: 'Không chọn tháng ở tương lai.',
  end_before_start: '“Đến” không được trước “Từ”.',
  duplicate: 'Vị trí này đã khai.',
  unavailable: 'Đơn vị đã chọn không còn khả dụng. Vui lòng chọn lại.',
} as const

const isEmpty = (row: Row) =>
  !row.level && !row.organization_id && !row.position && !row.from.trim() && !row.to.trim()

function fromClaim(claim: HubClaimDTO): Row {
  return {
    level: claim.level,
    chapter_id: claim.level === 'CLB' ? (claim.chapter?.id ?? '') : '',
    organization_id: claim.organization.id,
    position: claim.position ?? '',
    board_name: claim.board_name ?? '',
    position_other: claim.position_other ?? '',
    from: claim.from ? monthText(claim.from) : '',
    to: claim.to ? monthText(claim.to) : '',
    current: claim.current,
  }
}

/** The row as the API takes it, or the messages that stop it. */
function check(row: Row): { value?: PositionDeclaration; errors: string[] } {
  const errors: string[] = []
  if (!row.level) errors.push(MESSAGES.level)
  else if (row.level === 'CLB' && !row.chapter_id) errors.push(MESSAGES.chapter)
  else if (!row.organization_id) errors.push(row.level === 'CLB' ? MESSAGES.clb : MESSAGES.unit)
  if (!row.position) errors.push(MESSAGES.position)
  if (row.position === 'HEAD_OF_BOARD' && !row.board_name.trim()) errors.push(MESSAGES.board)
  if (row.position === 'OTHER' && !row.position_other.trim()) errors.push(MESSAGES.other)
  const from = parseMonthText(row.from)
  const to = row.current ? '' : parseMonthText(row.to)
  if (from === null || to === null) errors.push(MESSAGES.month)
  else {
    const period = periodError({ from: from || null, to: to || null, current: row.current })
    if (period) errors.push(MESSAGES[period])
  }
  if (errors.length > 0) return { errors }
  return {
    errors,
    value: {
      level: row.level as HubLevel,
      organization_id: row.organization_id,
      position: row.position as HubPosition,
      board_name: row.position === 'HEAD_OF_BOARD' ? row.board_name.trim() : null,
      position_other: row.position === 'OTHER' ? row.position_other.trim() : null,
      from: from!,
      to: row.current ? null : to!,
      current: row.current,
    },
  }
}

export function RoleForm({
  initial,
  catalog,
}: {
  initial: { roles: DeclaredRole[]; claims: HubClaimDTO[] }
  catalog: HubCatalog
}) {
  const leave = useLeave()
  const ids = useId()
  const [roles, setRoles] = useState<DeclaredRole[]>(initial.roles)
  const [rows, setRows] = useState<Row[]>(
    initial.claims.length > 0 ? initial.claims.map(fromClaim) : [EMPTY],
  )
  const [rowErrors, setRowErrors] = useState<Record<number, string[]>>({})
  const [roleError, setRoleError] = useState<string>()
  const [claimError, setClaimError] = useState<string>()
  const [formError, setFormError] = useState<string>()
  const [confirmUntick, setConfirmUntick] = useState(false)
  const [saving, setSaving] = useState<'next' | 'later'>()
  // A ref, not state: a second submit can land before React re-renders.
  const inFlight = useRef(false)

  const id = (name: string) => `${ids}-${name}`
  const hubMember = roles.includes('HUB_MEMBER')
  const chaptersWithClubs = catalog.chapters.filter((c) => (catalog.clubs[c.id] ?? []).length > 0)
  const levels = HUB_LEVELS.filter((level) => level !== 'HUB' || catalog.hub)

  const setRow = (index: number, patch: Partial<Row>) => {
    setRows((list) => list.map((r, i) => (i === index ? { ...r, ...patch } : r)))
    setRowErrors((errors) => ({ ...errors, [index]: [] }))
    setClaimError(undefined)
  }

  function setRole(code: DeclaredRole, checked: boolean) {
    setRoleError(undefined)
    if (!checked && code === 'HUB_MEMBER' && rows.some((r) => !isEmpty(r))) {
      // "Bỏ tick Thành viên HUB Network khi đã khai vị trí → hỏi xác nhận".
      setConfirmUntick(true)
      return
    }
    setRoles((current) => (checked ? [...current, code] : current.filter((r) => r !== code)))
  }

  function untickHubMember() {
    setRoles((current) => current.filter((r) => r !== 'HUB_MEMBER'))
    setRows([EMPTY])
    setRowErrors({})
    setConfirmUntick(false)
  }

  async function save(mode: 'next' | 'later') {
    if (inFlight.current) return
    setFormError(undefined)
    setClaimError(undefined)
    setRoleError(undefined)

    if (mode === 'next' && roles.length === 0) {
      setRoleError(MESSAGES.noRole)
      return
    }
    // A row left entirely empty is not a declaration; any other row must be complete.
    const filled = hubMember
      ? rows.map((row, index) => ({ row, index })).filter((r) => !isEmpty(r.row))
      : []
    const errors: Record<number, string[]> = {}
    const values: PositionDeclaration[] = []
    for (const { row, index } of filled) {
      const result = check(row)
      if (result.errors.length > 0) errors[index] = result.errors
      else values.push(result.value!)
    }
    if (Object.keys(errors).length === 0) {
      const now = monthNow()
      for (const dup of duplicateRows(values, now))
        errors[filled[dup]!.index] = [MESSAGES.duplicate]
    }
    setRowErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (mode === 'next' && hubMember && values.length === 0) {
      setClaimError(MESSAGES.noPosition)
      return
    }

    inFlight.current = true
    setSaving(mode)
    try {
      await apiRequest('/me/onboarding/roles', {
        method: 'PUT',
        body: { roles, hub_claims: values },
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
      if (fields?.hub_claims === 'organization_not_available') setClaimError(MESSAGES.unavailable)
      else if (fields?.hub_claims === 'duplicate_position') setClaimError(MESSAGES.duplicate)
      else if (fields?.roles === 'missing') setRoleError(MESSAGES.noRole)
      else if (fields?.hub_claims === 'missing') setClaimError(MESSAGES.noPosition)
      else setFormError(saveMessage(caught))
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

          <fieldset
            className={styles.roles}
            aria-labelledby={id('title')}
            aria-describedby={roleError ? id('role-error') : undefined}
            data-anchor="roles"
          >
            {ROLE_COPY.map((role) => (
              <label key={role.code} className={styles.role} data-role={role.code}>
                <input
                  type="checkbox"
                  className={stage.srOnly}
                  name="roles"
                  value={role.code}
                  checked={roles.includes(role.code)}
                  onChange={(e) => setRole(role.code, e.target.checked)}
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
          {roleError ? (
            <p id={id('role-error')} role="alert" className={stage.error}>
              {roleError}
            </p>
          ) : null}

          {confirmUntick ? (
            <div
              className={styles.confirm}
              role="alertdialog"
              aria-labelledby={id('confirm')}
              data-confirm-untick
            >
              <p id={id('confirm')} className={styles.confirmText}>
                Bỏ chọn “Thành viên HUB Network” sẽ xóa các vị trí đang Chờ xác minh bạn đã khai.
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className="ui-button"
                  data-variant="secondary"
                  onClick={() => setConfirmUntick(false)}
                >
                  <span>Giữ lại</span>
                </button>
                <button type="button" className="ui-button" onClick={untickHubMember}>
                  <span>Bỏ chọn và xóa vị trí</span>
                </button>
              </div>
            </div>
          ) : null}

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
                  {PENDING_LABEL}
                </span>
              </div>

              <ol className={styles.claims}>
                {rows.map((row, i) => {
                  const errors = rowErrors[i] ?? []
                  const field = (name: string) => id(`${name}-${i}`)
                  const describedBy = errors.length > 0 ? field('error') : undefined
                  const clubs = catalog.clubs[row.chapter_id] ?? []
                  return (
                    <li
                      key={i}
                      className={styles.claim}
                      data-claim={i}
                      aria-labelledby={field('head')}
                    >
                      <div className={styles.claimHead}>
                        <span id={field('head')} className={styles.claimTitle}>
                          Vị trí {i + 1}
                        </span>
                        <span className={styles.claimStatus} data-claim-status="PENDING">
                          {PENDING_LABEL}
                        </span>
                        {rows.length > 1 ? (
                          <button
                            type="button"
                            className={styles.remove}
                            aria-label={`Bỏ vị trí ${i + 1}`}
                            onClick={() => {
                              setRows((list) => list.filter((_, n) => n !== i))
                              setRowErrors({})
                            }}
                          >
                            Bỏ vị trí này
                          </button>
                        ) : null}
                      </div>
                      <div className={styles.claimGrid}>
                        <div>
                          <label className={stage.label} htmlFor={field('level')}>
                            Cấp đơn vị
                          </label>
                          <div className={styles.claimControl}>
                            <Select
                              id={field('level')}
                              name={`level-${i}`}
                              value={row.level}
                              options={levels.map((level) => ({
                                id: level,
                                label: LEVEL_LABELS[level],
                              }))}
                              placeholder="Chọn cấp"
                              invalid={errors.includes(MESSAGES.level)}
                              describedBy={describedBy}
                              onChange={(value) =>
                                setRow(i, {
                                  level: value as HubLevel,
                                  chapter_id: '',
                                  organization_id: value === 'HUB' ? (catalog.hub?.id ?? '') : '',
                                })
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <label className={stage.label} htmlFor={field('unit')}>
                            {row.level === 'CLB' ? 'Chapter' : 'Đơn vị'}
                          </label>
                          <div className={styles.claimControl}>
                            {row.level === 'HUB' ? (
                              <input
                                id={field('unit')}
                                className="ui-input"
                                value={LEVEL_LABELS.HUB}
                                readOnly
                                aria-readonly="true"
                              />
                            ) : row.level === 'CLB' ? (
                              <Select
                                id={field('unit')}
                                name={`chapter-${i}`}
                                value={row.chapter_id}
                                // US-01.11: only the Chapters that have CLBs.
                                options={chaptersWithClubs.map((c) => ({
                                  id: c.id,
                                  label: c.name,
                                }))}
                                placeholder="Chọn Chapter"
                                invalid={errors.includes(MESSAGES.chapter)}
                                describedBy={describedBy}
                                // A new Chapter clears the CLB chosen under the old one.
                                onChange={(value) =>
                                  setRow(i, { chapter_id: value, organization_id: '' })
                                }
                              />
                            ) : (
                              <Select
                                id={field('unit')}
                                name={`unit-${i}`}
                                value={row.organization_id}
                                options={catalog.chapters.map((c) => ({ id: c.id, label: c.name }))}
                                placeholder="Chọn đơn vị"
                                disabled={!row.level}
                                invalid={errors.includes(MESSAGES.unit)}
                                describedBy={describedBy}
                                onChange={(value) => setRow(i, { organization_id: value })}
                              />
                            )}
                          </div>
                        </div>
                        {row.level === 'CLB' ? (
                          <div>
                            <label className={stage.label} htmlFor={field('club')}>
                              CLB
                            </label>
                            <div className={styles.claimControl}>
                              <Select
                                id={field('club')}
                                name={`club-${i}`}
                                value={row.organization_id}
                                options={clubs.map((c) => ({ id: c.id, label: c.name }))}
                                placeholder="Chọn CLB"
                                disabled={!row.chapter_id}
                                invalid={errors.includes(MESSAGES.clb)}
                                describedBy={describedBy}
                                onChange={(value) => setRow(i, { organization_id: value })}
                              />
                            </div>
                          </div>
                        ) : null}
                        <div>
                          <label className={stage.label} htmlFor={field('position')}>
                            Chức vụ
                          </label>
                          <div className={styles.claimControl}>
                            <Select
                              id={field('position')}
                              name={`position-${i}`}
                              value={row.position}
                              options={HUB_POSITIONS.map((p) => ({
                                id: p,
                                label: POSITION_LABELS[p],
                              }))}
                              placeholder="Chọn chức vụ"
                              invalid={errors.includes(MESSAGES.position)}
                              describedBy={describedBy}
                              onChange={(value) => setRow(i, { position: value as HubPosition })}
                            />
                          </div>
                        </div>
                        {row.position === 'HEAD_OF_BOARD' || row.position === 'OTHER' ? (
                          <div>
                            <label className={stage.label} htmlFor={field('position-text')}>
                              {row.position === 'HEAD_OF_BOARD' ? 'Tên Ban' : 'Ghi rõ chức vụ'}
                            </label>
                            <div className={styles.claimControl}>
                              <input
                                id={field('position-text')}
                                className="ui-input"
                                maxLength={POSITION_LIMITS.text}
                                required
                                aria-invalid={
                                  errors.includes(MESSAGES.board) ||
                                  errors.includes(MESSAGES.other) ||
                                  undefined
                                }
                                aria-describedby={describedBy}
                                value={
                                  row.position === 'HEAD_OF_BOARD'
                                    ? row.board_name
                                    : row.position_other
                                }
                                onChange={(e) =>
                                  setRow(
                                    i,
                                    row.position === 'HEAD_OF_BOARD'
                                      ? { board_name: e.target.value }
                                      : { position_other: e.target.value },
                                  )
                                }
                              />
                            </div>
                          </div>
                        ) : null}
                        <div>
                          <label className={stage.label} htmlFor={field('from')}>
                            Từ
                          </label>
                          <div className={styles.claimControl}>
                            <input
                              id={field('from')}
                              className="ui-input"
                              placeholder="MM/YYYY"
                              inputMode="numeric"
                              maxLength={7}
                              aria-describedby={describedBy}
                              value={row.from}
                              onChange={(e) => setRow(i, { from: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <label className={stage.label} htmlFor={field('to')}>
                            Đến
                          </label>
                          <div className={styles.claimControl}>
                            <input
                              id={field('to')}
                              className="ui-input"
                              placeholder="MM/YYYY"
                              inputMode="numeric"
                              maxLength={7}
                              disabled={row.current}
                              aria-describedby={describedBy}
                              value={row.current ? 'Hiện tại' : row.to}
                              onChange={(e) => setRow(i, { to: e.target.value })}
                            />
                          </div>
                        </div>
                        <label className={styles.term}>
                          <input
                            type="checkbox"
                            checked={row.current}
                            onChange={(e) => setRow(i, { current: e.target.checked, to: '' })}
                          />
                          <span>Tôi đang trong nhiệm kỳ hoạt động</span>
                        </label>
                      </div>
                      {errors.length > 0 ? (
                        <ul id={field('error')} role="alert" className={styles.claimErrors}>
                          {errors.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
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
              {rows.length < POSITION_LIMITS.rows ? (
                <button
                  type="button"
                  className={styles.addClaim}
                  data-anchor="hub-add"
                  onClick={() => setRows((list) => [...list, EMPTY])}
                >
                  + Thêm vị trí khác (ví dụ: nhiệm kỳ trước)
                </button>
              ) : (
                <p className={styles.panelNote} data-limit>
                  Đã đủ {POSITION_LIMITS.rows} vị trí.
                </p>
              )}
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
