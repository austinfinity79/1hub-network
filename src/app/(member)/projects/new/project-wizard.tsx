'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react'

import { Inert } from '@/components/onboarding/inert'
import { HomeLink } from '@/components/shell/home-link'
import { Button, Notice, Surface, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import type { TeamDTO } from '@/lib/venture/team'

import { WizardDone } from './wizard-done'
import { WizardTeam } from './wizard-team'
import styles from './wizard.module.css'

/**
 * WF02-S05 create flow as the L13a–c wizard (PRJ1–3, DEC-L2R-D4..D11): core
 * information → team → done.
 *
 * Step 1 asks what BA row 89 asks: type (fixed once created, G4), name, field,
 * one-line description, stage, and the role the creator states. Name, field,
 * description and stage are required, for "Lưu nháp" as for "Tiếp tục". The
 * first save creates the venture with POST /ventures (it starts DRAFT) under
 * one Idempotency-Key per visit; every later save PATCHes the same id, so the
 * flow can never write a second record. The AI block is drawn and inert: no
 * provider exists (D-A1). Frame codes of the board are not shown.
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
  stage_id: string
  /** The role the creator states; display text, never a permission. */
  owner_role_label: string
  domain_ids: string[]
}

const COPY = {
  flow: 'TẠO DỰ ÁN / STARTUP',
  steps: { info: 'BƯỚC 1/3 · THÔNG TIN CỐT LÕI', team: 'BƯỚC 2/3 · ĐỘI NGŨ' },
  created: 'HỒ SƠ ĐÃ ĐƯỢC TẠO',
  exit: 'Lưu nháp và thoát',
  home: 'Về Dự án & startup',
  title: 'Tạo dự án hoặc startup',
  lede: 'Lưu hồ sơ đội một lần, dùng lại cho mọi bài toán và chương trình. Bạn trở thành chủ sở hữu hồ sơ này.',
  creating: 'BẠN ĐANG TẠO',
  typeHint: 'Chọn một lần khi tạo, không đổi được sau đó.',
  aiTitle: 'Điền nhanh từ pitch deck hoặc website',
  aiBody:
    'AI gợi ý tên, lĩnh vực, mô tả và giai đoạn. Nội dung chỉ được lưu sau khi bạn xác nhận — cùng quy tắc với onboarding.',
  aiAction: 'Tải pitch deck',
  name: 'Tên dự án hoặc tên startup',
  nameHint: 'Có thể đổi sau.',
  domain: 'Lĩnh vực',
  domainHint: 'Chọn từ danh mục chuẩn. Dùng để gợi ý bài toán phù hợp.',
  domainPlaceholder: 'Chọn lĩnh vực',
  summary: 'Một dòng mô tả',
  summaryHint: 'Dưới 20 từ.',
  stage: 'Giai đoạn',
  stageNote: '· thang trưởng thành, tách khỏi thang gọi vốn',
  role: 'Vai trò của bạn trong đội',
  roleNote: 'Người tạo luôn có quyền Chủ sở hữu, bất kể vai trò chọn ở đây.',
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

/** The three roles PRJ1 offers its creator; stored as display text (DEC-L2R-D6). */
const ROLES = ['Founder', 'Co-founder', 'Thành viên'] as const

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
  domains,
  stages,
}: {
  step: WizardStep
  /** Null until step 1 creates the venture. */
  venture: WizardVenture | null
  team: TeamDTO | null
  domains: Option[]
  stages: Option[]
}) {
  const router = useRouter()
  const ids = useId()
  const [ventureId, setVentureId] = useState(venture?.id ?? null)
  const [type, setType] = useState<VentureType | ''>(venture?.type ?? '')
  const [name, setName] = useState(venture?.name ?? '')
  const [summary, setSummary] = useState(venture?.summary ?? '')
  const [stageId, setStageId] = useState(venture?.stage_id ?? '')
  // A new venture starts with the first role, as PRJ1 draws it.
  const [role, setRole] = useState(venture ? venture.owner_role_label : ROLES[0])
  const [selected, setSelected] = useState<string[]>(venture?.domain_ids ?? [])
  // One key per visit: a repeated create returns the venture of the first one.
  const createKey = useRef<string | null>(null)
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
    if (selected.length === 0) local.domain_ids = COPY.required
    if (!summary.trim()) local.summary = COPY.required
    if (!stageId) local.stage_id = COPY.required
    if (Object.keys(local).length > 0) {
      setErrors(local)
      return null
    }
    inFlight.current = true
    setSaving(true)
    setFormError(undefined)
    const body = {
      name,
      summary,
      domain_ids: selected,
      stage_id: stageId,
      owner_role_label: role || null,
    }
    try {
      if (ventureId) {
        await apiRequest(`/ventures/${ventureId}`, { method: 'PATCH', body })
        return ventureId
      }
      createKey.current ??= crypto.randomUUID()
      const created = await apiRequest<{ id: string }>('/ventures', {
        method: 'POST',
        body: { type, ...body },
        idempotencyKey: createKey.current,
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
    if (await save()) router.push('/projects')
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
      <Link href="/projects" className={styles.headerLink} data-nav="wizard-home">
        {COPY.home}
      </Link>
    )
  } else if (step === 'team') {
    action = (
      <Link href="/projects" className={styles.headerLink} data-nav="wizard-exit">
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

        <div className={styles.ai} data-anchor="ai" data-ai-block>
          <span className={styles.aiBadge} aria-hidden="true">
            <svg className={styles.spark} viewBox="0 0 8 8" focusable="false">
              <path d="M4 0l.9 3.1L8 4l-3.1.9L4 8l-.9-3.1L0 4l3.1-.9z" />
            </svg>
            AI
          </span>
          <div className={styles.aiText}>
            <p className={styles.aiTitle}>{COPY.aiTitle}</p>
            <p className={styles.aiBody}>{COPY.aiBody}</p>
          </div>
          <Inert reason="NO_P0_SCREEN" label={COPY.aiAction} className={styles.aiAction}>
            {COPY.aiAction}
          </Inert>
        </div>

        <div className={styles.fields} data-anchor="core">
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
              {COPY.domain}{' '}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
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
                        onClick={() => {
                          setSelected((s) => (on ? s.filter((x) => x !== d.id) : [...s, d.id]))
                          clear('domain_ids')
                        }}
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
              {COPY.summary}{' '}
              <span className={styles.required} aria-hidden="true">
                *
              </span>
            </label>
            <TextInput
              id="ve-summary"
              value={summary}
              invalid={Boolean(errors.summary)}
              aria-describedby="ve-summary-hint"
              onChange={(e) => {
                setSummary(e.target.value)
                clear('summary')
              }}
            />
            <p id="ve-summary-hint" className={styles.hint}>
              {COPY.summaryHint}
            </p>
            {fieldError('summary')}
          </div>
        </div>

        <div className={styles.stage} data-anchor="stage">
          <p id={`${ids}-stage-label`} className={styles.label}>
            {COPY.stage}{' '}
            <span className={styles.required} aria-hidden="true">
              *
            </span>{' '}
            <span className={styles.labelNote}>{COPY.stageNote}</span>
          </p>
          <div
            className={styles.segments}
            role="radiogroup"
            aria-labelledby={`${ids}-stage-label`}
            aria-required="true"
          >
            {stages.map((item) => (
              <label key={item.id} className={styles.segment} data-checked={stageId === item.id}>
                <input
                  type="radio"
                  name="venture-stage"
                  value={item.id}
                  className={styles.choice}
                  checked={stageId === item.id}
                  onChange={() => {
                    setStageId(item.id)
                    clear('stage_id')
                  }}
                />
                {item.label}
              </label>
            ))}
          </div>
          {fieldError('stage_id')}
        </div>

        <div className={styles.role} data-anchor="role">
          <p id={`${ids}-role-label`} className={styles.label}>
            {COPY.role}
          </p>
          <div
            className={styles.roles}
            role="radiogroup"
            aria-labelledby={`${ids}-role-label`}
            aria-describedby={`${ids}-role-note`}
          >
            {ROLES.map((item) => (
              <label key={item} className={styles.roleChip} data-checked={role === item}>
                <input
                  type="radio"
                  name="venture-role"
                  value={item}
                  className={styles.choice}
                  checked={role === item}
                  onChange={() => setRole(item)}
                />
                {role === item ? (
                  <svg className={styles.tick} viewBox="0 0 12 12" aria-hidden="true">
                    <path d="M2 6.4l2.7 2.7L10 3" />
                  </svg>
                ) : null}
                {item}
              </label>
            ))}
          </div>
          <p id={`${ids}-role-note`} className={styles.note}>
            {COPY.roleNote}
          </p>
          {fieldError('owner_role_label')}
        </div>

        <div className={styles.footer}>
          {ventureId ? null : (
            <Link
              href="/projects"
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
