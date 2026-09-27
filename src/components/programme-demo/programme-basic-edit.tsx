'use client'

import { useRef, useState, type FormEvent } from 'react'

import { Notice, TextInput } from '@/components/ui'
import {
  basicInfoOf,
  updateBasicInfo,
  type BasicInfoErrors,
  type BasicInfoInput,
} from '@/lib/programme-demo/basic-info'
import { TYPE_LABEL } from '@/lib/programme-demo/copy'
import { demoRoutes } from '@/lib/programme-demo/routes'
import type { ProgrammeDemoDetailDTO } from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import styles from './journey.module.css'
import form from './programme-form.module.css'
import { SetupScreen, type Apply } from './setup-screen'

/**
 * WF04-S08 — basic information of an existing programme (DEC-WF04-S02-D3,
 * DEC-WF04-S08-D2): name, summary and dates editable; the type (chosen once)
 * and the owning organization (from the scope) are shown read-only. Saved as
 * one atomic edit of the actor's session copy. Back → the detail; "Tiếp theo"
 * → the journey step.
 */

const COPY = {
  back: '← Chi tiết',
  title: 'Thông tin cơ bản',
  hint: 'Loại và đơn vị chủ trì không đổi được sau khi tạo.',
  type: 'Loại',
  name: 'Tên',
  summary: 'Tóm tắt',
  optional: 'Không bắt buộc.',
  owner: 'Đơn vị chủ trì',
  dates: 'Thời gian',
  datesHint: 'Không bắt buộc. Theo ngày tại Việt Nam.',
  start: 'Ngày bắt đầu',
  end: 'Ngày kết thúc',
  save: 'Lưu thông tin',
  saved: 'Đã lưu thông tin cơ bản.',
  required: 'Trường này là bắt buộc.',
  dayInvalid: 'Ngày chưa hợp lệ.',
  dayOrder: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
  invalid: 'Thông tin chưa hợp lệ.',
} as const

export function ProgrammeBasicEdit({
  id,
  server,
}: {
  id: string
  server: ProgrammeDemoDetailDTO | null
}) {
  return (
    <SetupScreen
      id={id}
      server={server}
      step="basic"
      screen="WF04-S08-BASIC"
      back={{ href: demoRoutes.detail(id), label: COPY.back, nav: 'basic-back' }}
      next={demoRoutes.setup(id, 'journey')}
    >
      {({ detail, apply }) => <BasicBody detail={detail} apply={apply} />}
    </SetupScreen>
  )
}

function BasicBody({ detail, apply }: { detail: ProgrammeDemoDetailDTO; apply: Apply }) {
  const [input, setInput] = useState<BasicInfoInput>(() => basicInfoOf(detail))
  const [errors, setErrors] = useState<BasicInfoErrors>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  const update = (field: 'name' | 'summary' | 'starts_on' | 'ends_on', value: string) => {
    setInput((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({
      ...current,
      [field === 'starts_on' || field === 'ends_on' ? 'dates' : field]: undefined,
    }))
    setSaved(false)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    const outcome = apply(updateBasicInfo(detail, input, new Date()))
    if (!outcome.ok && outcome.errors) setErrors(outcome.errors)
    setSaved(outcome.ok)
    inFlight.current = false
    setSaving(false)
  }

  const error = (message: string | undefined, key: string) =>
    message ? (
      <p className={`type-meta-xs ${form.error}`} role="alert" data-error={key}>
        {message}
      </p>
    ) : null

  return (
    <section className={styles.card} aria-labelledby="basic-info" data-basic-info>
      <header className={styles.cardHead}>
        <div>
          <h2 id="basic-info" className={`weight-semibold ${styles.cardTitle}`}>
            {COPY.title}
          </h2>
          <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.hint}</p>
        </div>
      </header>
      <form
        className={`${form.form} ${styles.editor}`}
        onSubmit={submit}
        noValidate
        data-basic-editor
      >
        {saved ? (
          <div className={form.notice} data-state="basic-saved">
            <Notice>{COPY.saved}</Notice>
          </div>
        ) : null}
        {errors.type || errors.organization_id ? (
          <div className={form.notice} data-state="basic-invalid">
            <Notice tone="error">{COPY.invalid}</Notice>
          </div>
        ) : null}
        <section className={form.field}>
          <p className={`type-body-sm weight-semibold ${form.label}`}>{COPY.type}</p>
          <p className={`type-body-md ${form.readonly}`} data-readonly="type">
            {TYPE_LABEL[detail.programme.type]}
          </p>
        </section>
        <section className={form.field}>
          <label htmlFor="be-name" className={`type-body-sm weight-semibold ${form.label}`}>
            {COPY.name}
          </label>
          <TextInput
            id="be-name"
            value={input.name}
            invalid={Boolean(errors.name)}
            onChange={(e) => update('name', e.target.value)}
          />
          {error(errors.name ? COPY.required : undefined, 'name')}
        </section>
        <section className={form.field}>
          <label htmlFor="be-summary" className={`type-body-sm weight-semibold ${form.label}`}>
            {COPY.summary}
          </label>
          <p className={`type-meta-xs ${form.hint}`}>{COPY.optional}</p>
          <textarea
            id="be-summary"
            className={`ui-input ${form.textarea}`}
            rows={3}
            value={input.summary}
            onChange={(e) => update('summary', e.target.value)}
          />
        </section>
        <section className={form.field}>
          <p className={`type-body-sm weight-semibold ${form.label}`}>{COPY.owner}</p>
          <p className={`type-body-md ${form.readonly}`} data-readonly="owner">
            {detail.organization.name}
          </p>
        </section>
        <fieldset className={form.field}>
          <legend className={`type-body-sm weight-semibold ${form.label}`}>{COPY.dates}</legend>
          <p className={`type-meta-xs ${form.hint}`}>{COPY.datesHint}</p>
          <div className={form.dates}>
            <div>
              <label htmlFor="be-start" className={`type-body-sm ${form.dateLabel}`}>
                {COPY.start}
              </label>
              <TextInput
                id="be-start"
                type="date"
                value={input.starts_on}
                invalid={errors.dates === 'invalid'}
                onChange={(e) => update('starts_on', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="be-end" className={`type-body-sm ${form.dateLabel}`}>
                {COPY.end}
              </label>
              <TextInput
                id="be-end"
                type="date"
                value={input.ends_on}
                invalid={Boolean(errors.dates)}
                onChange={(e) => update('ends_on', e.target.value)}
              />
            </div>
          </div>
          {error(
            errors.dates === 'order' ? COPY.dayOrder : errors.dates ? COPY.dayInvalid : undefined,
            'dates',
          )}
        </fieldset>
        <div className={styles.editorActions}>
          <button
            type="submit"
            className={`weight-medium ${buttons.primary}`}
            disabled={saving}
            aria-busy={saving || undefined}
            data-action="save-basic"
          >
            {COPY.save}
          </button>
        </div>
      </form>
    </section>
  )
}
