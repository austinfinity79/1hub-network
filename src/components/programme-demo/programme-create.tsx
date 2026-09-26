'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import { Notice, TextInput } from '@/components/ui'
import type { OrganizationRefDTO } from '@/lib/ops/organizations'
import {
  buildDraft,
  validateBasicInfo,
  type BasicInfoErrors,
  type BasicInfoField,
  type BasicInfoInput,
} from '@/lib/programme-demo/basic-info'
import { TYPE_LABEL } from '@/lib/programme-demo/copy'
import { demoRoutes } from '@/lib/programme-demo/routes'
import { PROGRAMME_TYPES } from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import { DemoPage } from './demo-page'
import { useProgrammeDemo } from './demo-store'
import styles from './programme-form.module.css'

/**
 * WF04-S02 — create a demo Programme / Challenge (DEC-WF04-H1..H5,
 * DEC-WF04-S02-D1..D4).
 *
 * Basic information only, the canonical Programme fields: Loại (chosen once),
 * Tên, Tóm tắt, Đơn vị chủ trì (from the server-computed scope), Thời gian.
 * "Lưu" validates, then stores ONE new DRAFT in this browser session's demo
 * store — never the database — and continues to the journey step (WF04-S03)
 * with a one-off confirmation (DEC-WF04-S03-D3).
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

export function ProgrammeCreate({ owners }: { owners: OrganizationRefDTO[] }) {
  const router = useRouter()
  const { save, setFlash } = useProgrammeDemo()
  const [input, setInput] = useState<BasicInfoInput>({
    type: '',
    name: '',
    summary: '',
    starts_on: '',
    ends_on: '',
    organization_id: owners.length === 1 ? owners[0]!.id : '',
  })
  const [errors, setErrors] = useState<BasicInfoErrors>({})
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const update = (field: keyof BasicInfoInput, value: string) => {
    setInput((current) => ({ ...current, [field]: value }))
    const key: BasicInfoField =
      field === 'starts_on' || field === 'ends_on' ? 'dates' : (field as BasicInfoField)
    setErrors((current) => ({ ...current, [key]: undefined }))
    setFailed(false)
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const found = validateBasicInfo(input, owners)
    setErrors(found)
    setFailed(false)
    if (Object.keys(found).length > 0) return
    inFlight.current = true
    setSaving(true)
    const owner = owners.find((o) => o.id === input.organization_id)!
    const draft = buildDraft(input, owner, { id: crypto.randomUUID(), now: new Date() })
    if (!save(draft, true)) {
      inFlight.current = false
      setSaving(false)
      setFailed(true)
      return
    }
    setFlash(COPY.created(draft.programme.name))
    router.push(demoRoutes.setup(draft.programme.id, 'journey'))
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
              <Notice tone="error">{COPY.failed}</Notice>
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
