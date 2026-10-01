'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Notice, TextInput } from '@/components/ui'
import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { authWithReturn } from '@/lib/auth/return-path'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'
import {
  dayToInstant,
  validateBasicInfo,
  type BasicInfoErrors,
  type BasicInfoField,
  type BasicInfoInput,
} from '@/lib/programme-demo/basic-info'
import { TYPE_LABEL } from '@/lib/programme-demo/copy'
import { demoRoutes } from '@/lib/programme-demo/routes'
import { PROGRAMME_TYPES } from '@/lib/programme-demo/types'
import type { ProgrammeDetailDTO } from '@/lib/programme/types'

import buttons from './demo-buttons.module.css'
import { DemoPage } from './demo-page'
import { useDemoFrame } from './demo-frame'
import styles from './programme-form.module.css'

/**
 * WF04-S02 — create a Programme / Challenge (DEC-WF04-H1..H5,
 * DEC-WF04-S02-D1..D4; WF04-PROD-04).
 *
 * Basic information only, the canonical Programme fields: Loại (chosen once),
 * Tên, Tóm tắt, Đơn vị chủ trì (the server-computed options: organizations
 * the actor manages, never an ARCHIVED one, DEC-W4P-D13), Thời gian. "Lưu"
 * validates, then creates ONE DRAFT through `POST /api/v1/programmes` (one
 * Idempotency-Key per form, so a retried click creates nothing more) and
 * continues to the journey step (WF04-S03) with a one-off confirmation.
 */

const COPY = {
  title: 'Chương trình / challenge mới',
  meta: 'Chưa lưu',
  save: 'Lưu',
  cancel: 'Huỷ',
  type: 'Loại',
  typeHint: 'Chọn một lần khi tạo, không đổi được sau đó.',
  name: 'Tên',
  summary: 'Tóm tắt',
  summaryHint: 'Không bắt buộc. Vài câu giới thiệu ngắn.',
  owner: 'Đơn vị chủ trì',
  ownerHint: 'Trong phạm vi tổ chức bạn vận hành.',
  ownerPlaceholder: 'Chọn đơn vị',
  noOwner: 'Bạn chưa vận hành tổ chức nào nên chưa tạo được chương trình.',
  dates: 'Thời gian',
  datesHint: 'Không bắt buộc. Theo ngày tại Việt Nam.',
  start: 'Ngày bắt đầu',
  end: 'Ngày kết thúc',
  created: (name: string) => `Đã tạo bản nháp “${name}”.`,
  failed: 'Chưa lưu được bản nháp. Vui lòng thử lại.',
  refused: 'Chưa tạo được chương trình cho đơn vị này.',
} as const

const MESSAGES: Record<BasicInfoField, Partial<Record<string, string>>> = {
  type: { required: 'Trường này là bắt buộc.', invalid: 'Loại không hợp lệ.' },
  name: { required: 'Trường này là bắt buộc.' },
  dates: {
    invalid: 'Ngày chưa hợp lệ.',
    order: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
  },
  organization_id: {
    required: 'Trường này là bắt buộc.',
    invalid: 'Đơn vị chủ trì không hợp lệ.',
  },
}

/** Server validation fields (422) as the form's own errors. */
function serverErrors(fields: Record<string, string> | undefined): BasicInfoErrors {
  const errors: BasicInfoErrors = {}
  for (const [field, reason] of Object.entries(fields ?? {})) {
    if (field === 'name') errors.name = 'required'
    else if (field === 'type') errors.type = 'invalid'
    else if (field === 'organization_id') errors.organization_id = 'invalid'
    else if (field === 'starts_at' || field === 'ends_at')
      errors.dates = reason === 'before_start' ? 'order' : 'invalid'
  }
  return errors
}

export function ProgrammeCreate({ owners }: { owners: OrganizationRefDTO[] }) {
  const router = useRouter()
  const { setFlash } = useDemoFrame()
  const [input, setInput] = useState<BasicInfoInput>({
    type: '',
    name: '',
    summary: '',
    starts_on: '',
    ends_on: '',
    organization_id: owners.length === 1 ? owners[0]!.id : '',
  })
  const [errors, setErrors] = useState<BasicInfoErrors>({})
  const [failed, setFailed] = useState<false | 'retry' | 'refused'>(false)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)
  // One key per form: a retry of the same draft replays instead of creating another.
  const createKey = useRef(`create-${crypto.randomUUID()}`)

  const update = (field: keyof BasicInfoInput, value: string) => {
    setInput((current) => ({ ...current, [field]: value }))
    const key: BasicInfoField =
      field === 'starts_on' || field === 'ends_on' ? 'dates' : (field as BasicInfoField)
    setErrors((current) => ({ ...current, [key]: undefined }))
    setFailed(false)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const found = validateBasicInfo(input, owners)
    setErrors(found)
    setFailed(false)
    if (Object.keys(found).length > 0) return
    inFlight.current = true
    setSaving(true)
    try {
      const created = await apiRequest<ProgrammeDetailDTO>('/programmes', {
        method: 'POST',
        idempotencyKey: createKey.current,
        body: {
          type: input.type,
          organization_id: input.organization_id,
          name: input.name.trim(),
          summary: input.summary.trim() || null,
          starts_at: dayToInstant(input.starts_on, 'start'),
          ends_at: dayToInstant(input.ends_on, 'end'),
        },
      })
      setFlash(COPY.created(created.programme.name))
      router.push(demoRoutes.setup(created.programme.id, 'journey'))
    } catch (error) {
      inFlight.current = false
      setSaving(false)
      if (isApiError(error) && error.status === 401) {
        window.location.assign(authWithReturn(window.location.pathname))
        return
      }
      if (isApiError(error) && error.status === 422) {
        setErrors(serverErrors(error.fields))
        return
      }
      // 403 / 409: the server refused this owner (out of scope, archived).
      setFailed(isApiError(error) && error.status < 500 ? 'refused' : 'retry')
    }
  }

  const error = (field: BasicInfoField) => {
    const issue = errors[field]
    return issue ? (
      <p className={`type-meta-xs ${styles.error}`} role="alert" data-error={field}>
        {MESSAGES[field][issue] ?? MESSAGES[field].invalid ?? MESSAGES[field].required}
      </p>
    ) : null
  }

  return (
    <div data-screen="WF04-S02">
      <DemoPage
        title={COPY.title}
        meta={COPY.meta}
        actions={
          <div className={buttons.group}>
            <Link
              href={demoRoutes.list()}
              className={`weight-medium ${buttons.secondary}`}
              data-nav="programme-cancel"
            >
              {COPY.cancel}
            </Link>
            <button
              type="submit"
              form="programme-create"
              className={`weight-medium ${buttons.primary}`}
              disabled={saving || owners.length === 0}
              aria-busy={saving || undefined}
              data-demo-save
            >
              {COPY.save}
            </button>
          </div>
        }
      >
        <form
          id="programme-create"
          className={styles.form}
          onSubmit={onSubmit}
          noValidate
          data-programme-form
        >
          {failed ? (
            <div className={styles.notice} data-state="save-failed">
              <Notice tone="error">{failed === 'refused' ? COPY.refused : COPY.failed}</Notice>
            </div>
          ) : null}
          {owners.length === 0 ? (
            <div className={styles.notice} data-state="no-owner">
              <Notice>{COPY.noOwner}</Notice>
            </div>
          ) : null}

          <fieldset className={styles.field}>
            <legend className={`type-body-sm weight-semibold ${styles.label}`}>{COPY.type}</legend>
            <p id="pc-type-hint" className={`type-meta-xs ${styles.hint}`}>
              {COPY.typeHint}
            </p>
            <div className={styles.types} role="radiogroup" aria-describedby="pc-type-hint">
              {PROGRAMME_TYPES.map((value) => (
                <label key={value} className={`type-body-md ${styles.typeOption}`}>
                  <input
                    type="radio"
                    name="programme-type"
                    value={value}
                    checked={input.type === value}
                    onChange={(e) => update('type', e.target.value)}
                  />
                  {TYPE_LABEL[value]}
                </label>
              ))}
            </div>
            {error('type')}
          </fieldset>

          <section className={styles.field}>
            <label htmlFor="pc-name" className={`type-body-sm weight-semibold ${styles.label}`}>
              {COPY.name}
            </label>
            <TextInput
              id="pc-name"
              value={input.name}
              invalid={Boolean(errors.name)}
              onChange={(e) => update('name', e.target.value)}
            />
            {error('name')}
          </section>

          <section className={styles.field}>
            <label htmlFor="pc-summary" className={`type-body-sm weight-semibold ${styles.label}`}>
              {COPY.summary}
            </label>
            <p id="pc-summary-hint" className={`type-meta-xs ${styles.hint}`}>
              {COPY.summaryHint}
            </p>
            <textarea
              id="pc-summary"
              className={`ui-input ${styles.textarea}`}
              rows={3}
              value={input.summary}
              aria-describedby="pc-summary-hint"
              onChange={(e) => update('summary', e.target.value)}
            />
          </section>

          <section className={styles.field}>
            <label htmlFor="pc-owner" className={`type-body-sm weight-semibold ${styles.label}`}>
              {COPY.owner}
            </label>
            <p id="pc-owner-hint" className={`type-meta-xs ${styles.hint}`}>
              {COPY.ownerHint}
            </p>
            {owners.length === 1 ? (
              <p
                id="pc-owner"
                className={`type-body-md ${styles.readonly}`}
                aria-describedby="pc-owner-hint"
                data-owner={owners[0]!.id}
              >
                {owners[0]!.name}
              </p>
            ) : (
              <select
                id="pc-owner"
                className={`type-body-md ${styles.select}`}
                value={input.organization_id}
                aria-describedby="pc-owner-hint"
                aria-invalid={Boolean(errors.organization_id) || undefined}
                disabled={owners.length === 0}
                onChange={(e) => update('organization_id', e.target.value)}
              >
                <option value="">{COPY.ownerPlaceholder}</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
            {error('organization_id')}
          </section>

          <fieldset className={styles.field}>
            <legend className={`type-body-sm weight-semibold ${styles.label}`}>{COPY.dates}</legend>
            <p id="pc-dates-hint" className={`type-meta-xs ${styles.hint}`}>
              {COPY.datesHint}
            </p>
            <div className={styles.dates}>
              <div>
                <label htmlFor="pc-start" className={`type-body-sm ${styles.dateLabel}`}>
                  {COPY.start}
                </label>
                <TextInput
                  id="pc-start"
                  type="date"
                  value={input.starts_on}
                  invalid={errors.dates === 'invalid'}
                  aria-describedby="pc-dates-hint"
                  onChange={(e) => update('starts_on', e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="pc-end" className={`type-body-sm ${styles.dateLabel}`}>
                  {COPY.end}
                </label>
                <TextInput
                  id="pc-end"
                  type="date"
                  value={input.ends_on}
                  invalid={Boolean(errors.dates)}
                  aria-describedby="pc-dates-hint"
                  onChange={(e) => update('ends_on', e.target.value)}
                />
              </div>
            </div>
            {error('dates')}
          </fieldset>
        </form>
      </DemoPage>
    </div>
  )
}
