'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { HomeLink } from '@/components/shell/home-link'
import { Button, Notice, Surface, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { TeamDTO } from '@/lib/venture/team'

import { WizardDone } from './wizard-done'
import { WizardTeam } from './wizard-team'
import styles from './wizard.module.css'

/**
 * WF02-S05 create flow as the corrected L13a–c wizard (TASK 22.3,
 * DEC-L2-D1..D5): core info → team → done, over the existing APIs only.
 *
 * Step 1 keeps the canonical fields (G1): type (fixed once created, G4),
 * name, summary, domains and region. "Tiếp tục" and "Lưu nháp" create the
 * venture with POST /ventures (it starts DRAFT) and every later save PATCHes
 * the same id, so the flow can never write a second record. Not rendered
 * (Bucket B): stage, pitch-deck AI, the creator's own role, and the SUB0 box.
 */

export type WizardStep = 'info' | 'team' | 'done'
type VentureType = 'PROJECT' | 'STARTUP'
type Option = { id: string; label: string }

export type WizardVenture = {
  id: string
  type: VentureType
  name: string
  summary: string
  status: string
  region_id: string
  domain_ids: string[]
}

const COPY = {
  flow: 'TẠO DỰ ÁN / STARTUP',
  steps: { info: 'BƯỚC 1/3 · THÔNG TIN CỐT LÕI', team: 'BƯỚC 2/3 · ĐỘI NGŨ' },
  created: 'HỒ SƠ ĐÃ ĐƯỢC TẠO',
  exit: 'Lưu nháp và thoát',
  home: 'Về Tài khoản của tôi',
  title: 'Tạo dự án hoặc startup',
  lede: 'Lưu hồ sơ đội một lần, dùng lại cho mọi bài toán và chương trình. Bạn trở thành chủ sở hữu hồ sơ này.',
  creating: 'BẠN ĐANG TẠO',
  typeHint: 'Chọn một lần khi tạo, không đổi được sau đó.',
  name: 'Tên dự án hoặc tên startup',
  nameHint: 'Có thể đổi sau.',
  domain: 'Lĩnh vực',
  domainHint: 'Chọn từ danh mục chuẩn.',
  domainPlaceholder: 'Chọn lĩnh vực',
  summary: 'Một dòng mô tả',
  summaryHint: 'Dưới 20 từ. Viết như nói với người ngồi cạnh.',
  region: 'Tỉnh / Thành phố',
  regionPlaceholder: 'Chưa chọn',
  cancel: 'Huỷ',
  saveDraft: 'Lưu nháp',
  next: 'Tiếp tục · Mời đội ngũ',
  savedAt: 'Đã lưu bản nháp lúc',
  required: 'Trường này là bắt buộc.',
  inactive: 'Một mục đã chọn không còn khả dụng. Vui lòng chọn lại.',
  invalid: 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.',
  failed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
} as const

/** The reference's type cards; only claims P0 keeps (no later type change, no extra fields). */
const TYPES = [
  {
    value: 'PROJECT',
    title: 'Dự án / ý tưởng',
    body: 'Chưa có pháp nhân. Một nhóm đang phát triển ý tưởng hoặc giải pháp.',
  },
  { value: 'STARTUP', title: 'Startup', body: 'Đã có pháp nhân (công ty).' },
] as const

const time = () =>
  new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())

const stepUrl = (id: string, step: WizardStep) => `/projects/new?venture=${id}&step=${step}`

function WizardHeader({ step, action }: { step: WizardStep; action: ReactNode }) {
  const current = step === 'info' ? 0 : step === 'team' ? 1 : 3
  return (
    <header className={styles.header} data-shell="wizard-header">
      <p className={styles.wordmark}>
        <HomeLink>HUB NETWORK</HomeLink>
      </p>
      <div className={styles.progress}>
        <p className={styles.stepLabel}>
          {step === 'done' ? COPY.created : `${COPY.flow} · ${COPY.steps[step]}`}
        </p>
        <ol className={styles.bars} aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className={styles.bar}
              data-state={i < current ? 'done' : i === current ? 'current' : 'todo'}
            />
          ))}
        </ol>
      </div>
      <div className={styles.headerAction}>{action}</div>
    </header>
  )
}

export function ProjectWizard({
  step,
  venture,
  team,
  regions,
  domains,
}: {
  step: WizardStep
  /** Null until step 1 creates the venture. */
  venture: WizardVenture | null
  team: TeamDTO | null
  regions: Option[]
  domains: Option[]
}) {
  const router = useRouter()
  const ids = useId()
  const [ventureId, setVentureId] = useState(venture?.id ?? null)
  const [type, setType] = useState<VentureType | ''>(venture?.type ?? '')
  const [name, setName] = useState(venture?.name ?? '')
  const [summary, setSummary] = useState(venture?.summary ?? '')
  const [regionId, setRegionId] = useState(venture?.region_id ?? '')
  const [selected, setSelected] = useState<string[]>(venture?.domain_ids ?? [])
  const [open, setOpen] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string>()
  const [savedAt, setSavedAt] = useState<string>()
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const labels = selected
    .map((id) => domains.find((d) => d.id === id)?.label)
    .filter(Boolean)
    .join(' · ')

  /** POST once, then PATCH the same id; resolves to the venture id, or null on failure. */
  async function save(): Promise<string | null> {
    if (inFlight.current) return null
    const local: Record<string, string> = {}
    if (!ventureId && !type) local.type = COPY.required
    if (!name.trim()) local.name = COPY.required
    if (Object.keys(local).length > 0) {
      setErrors(local)
      return null
    }
    inFlight.current = true
    setSaving(true)
    setFormError(undefined)
    const body = { name, summary, region_id: regionId || null, domain_ids: selected }
    try {
      if (ventureId) {
        await apiRequest(`/ventures/${ventureId}`, { method: 'PATCH', body })
        return ventureId
      }
      const created = await apiRequest<{ id: string }>('/ventures', {
        method: 'POST',
        body: { type, ...body },
      })
      setVentureId(created.id)
      return created.id
    } catch (caught) {
      const error = caught as { code?: string; fields?: Record<string, string> } | null
      const mapped: Record<string, string> = {}
      for (const [key, reason] of Object.entries(error?.fields ?? {})) {
        mapped[key] = reason === 'required' ? COPY.required : COPY.invalid
      }
      setErrors(mapped)
      setFormError(error?.code === 'VOCABULARY_ITEM_INACTIVE' ? COPY.inactive : COPY.failed)
      return null
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  async function onContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const id = await save()
    if (id) router.replace(stepUrl(id, 'team'))
  }

  async function onSaveDraft() {
    const id = await save()
    if (!id) return
    setSavedAt(time())
    if (!venture) router.replace(stepUrl(id, 'info'))
  }

  async function onExit() {
    if (await save()) router.push('/me')
  }

  const fieldError = (key: string) =>
    errors[key] ? (
      <p className={styles.error} role="alert">
        {errors[key]}
      </p>
    ) : null
  const clear = (key: string) => setErrors((e) => ({ ...e, [key]: undefined }))

  let action: ReactNode
  if (step === 'done') {
    action = (
      <Link href="/me" className={styles.headerLink} data-nav="wizard-home">
        {COPY.home}
      </Link>
    )
  } else if (step === 'team') {
    action = (
      <Link href="/me" className={styles.headerLink} data-nav="wizard-exit">
        {COPY.exit}
      </Link>
    )
  } else {
    action = (
      <button
        type="button"
        className={styles.headerLink}
        disabled={saving}
        onClick={onExit}
        data-nav="wizard-exit"
      >
        {COPY.exit}
      </button>
    )
  }

  let body: ReactNode
  if (step === 'team' && venture && team) {
    body = (
      <WizardTeam
        team={team}
        onBack={() => router.replace(stepUrl(venture.id, 'info'))}
        onDone={() => router.replace(stepUrl(venture.id, 'done'))}
      />
    )
  } else if (step === 'done' && venture && team) {
    body = <WizardDone venture={venture} pending={team.counts.pending ?? 0} />
  } else {
    body = (
      <form onSubmit={onContinue} noValidate data-venture-editor data-step-form="info">
        <h1 className={styles.title}>{COPY.title}</h1>
        <p className={styles.lede}>{COPY.lede}</p>

        {formError ? (
          <div className={styles.notice}>
            <Notice tone="error">{formError}</Notice>
          </div>
        ) : null}

        <div className={styles.typeGroup}>
          <p id={`${ids}-type-label`} className={styles.eyebrow}>
            {COPY.creating}
          </p>
          <div
            className={styles.types}
            role="radiogroup"
            aria-labelledby={`${ids}-type-label`}
            aria-describedby={`${ids}-type-hint`}
          >
            {TYPES.map((t) => (
              <label key={t.value} className={styles.typeCard} data-checked={type === t.value}>
                <input
                  type="radio"
                  name="venture-type"
                  value={t.value}
                  className={styles.radio}
                  checked={type === t.value}
                  disabled={Boolean(ventureId)}
                  aria-labelledby={`${ids}-${t.value}`}
                  aria-describedby={`${ids}-${t.value}-body`}
                  onChange={() => {
                    setType(t.value)
                    clear('type')
                  }}
                />
                <span>
                  <span id={`${ids}-${t.value}`} className={styles.typeTitle}>
                    {t.title}
                  </span>
                  <span id={`${ids}-${t.value}-body`} className={styles.typeBody}>
                    {t.body}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <p id={`${ids}-type-hint`} className={styles.note}>
            {COPY.typeHint}
          </p>
          {fieldError('type')}
        </div>

        <div className={styles.fields}>
          <div className={styles.field}>
            <label htmlFor="ve-name" className={styles.label}>
              {COPY.name}{' '}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            </label>
            <TextInput
              id="ve-name"
              value={name}
              invalid={Boolean(errors.name)}
              aria-describedby="ve-name-hint"
              onChange={(e) => {
                setName(e.target.value)
                clear('name')
              }}
            />
            <p id="ve-name-hint" className={styles.hint}>
              {COPY.nameHint}
            </p>
            {fieldError('name')}
          </div>

          <div className={styles.field}>
            <p id="ve-domain-label" className={styles.label}>
              {COPY.domain}
            </p>
            <button
              type="button"
              className={styles.picker}
              aria-expanded={open}
              aria-controls="ve-domain-list"
              aria-labelledby="ve-domain-label"
              aria-describedby="ve-domain-hint"
              onClick={() => setOpen((o) => !o)}
            >
              <span className={labels ? undefined : styles.placeholder}>
                {labels || COPY.domainPlaceholder}
              </span>
            </button>
            {open ? (
              <ul id="ve-domain-list" className={styles.chips} aria-label={COPY.domain}>
                {domains.map((d) => {
                  const on = selected.includes(d.id)
                  return (
                    <li key={d.id}>
                      <button
                        type="button"
                        className={styles.chip}
                        aria-pressed={on}
                        onClick={() =>
                          setSelected((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))
                        }
                      >
                        {d.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : null}
            <p id="ve-domain-hint" className={styles.hint}>
              {COPY.domainHint}
            </p>
            {fieldError('domain_ids')}
          </div>

          <div className={styles.field}>
            <label htmlFor="ve-summary" className={styles.label}>
              {COPY.summary}
            </label>
            <TextInput
              id="ve-summary"
              value={summary}
              invalid={Boolean(errors.summary)}
              aria-describedby="ve-summary-hint"
              onChange={(e) => setSummary(e.target.value)}
            />
            <p id="ve-summary-hint" className={styles.hint}>
              {COPY.summaryHint}
            </p>
            {fieldError('summary')}
          </div>

          <div className={styles.field}>
            <label htmlFor="ve-region" className={styles.label}>
              {COPY.region}
            </label>
            <select
              id="ve-region"
              className={styles.select}
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
            >
              <option value="">{COPY.regionPlaceholder}</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
            {fieldError('region_id')}
          </div>
        </div>

        <div className={styles.footer}>
          {ventureId ? null : (
            <Link
              href="/me"
              className={`ui-button ${styles.cancel}`}
              data-variant="secondary"
              data-nav="wizard-cancel"
            >
              {COPY.cancel}
            </Link>
          )}
          <div className={styles.footerEnd}>
            {savedAt ? (
              <p className={styles.saved} role="status">
                {COPY.savedAt} {savedAt}
              </p>
            ) : null}
            <button
              type="button"
              className={styles.textAction}
              disabled={saving}
              onClick={onSaveDraft}
            >
              {COPY.saveDraft}
            </button>
            <Button type="submit" loading={saving}>
              {COPY.next}
            </Button>
          </div>
        </div>
      </form>
    )
  }

  return (
    <div className={styles.page} data-project-wizard data-step={step}>
      <WizardHeader step={step} action={action} />
      <main className={styles.main}>
        <div className={styles.card}>
          <Surface as="section">{body}</Surface>
        </div>
      </main>
    </div>
  )
}
