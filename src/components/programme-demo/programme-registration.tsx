'use client'

import { useRef, useState, type FormEvent } from 'react'

import { Notice, TextInput } from '@/components/ui'
import { APPLICANT_LABEL, APPLICATION_STATUS_LABEL } from '@/lib/programme-demo/copy'
import {
  registrationConfigured,
  updateRegistration,
  type RegistrationErrors,
  type RegistrationInput,
} from '@/lib/programme-demo/registration'
import { demoRoutes } from '@/lib/programme-demo/routes'
import {
  APPLICANT_TYPES,
  APPLICATION_STATUSES,
  type ProgrammeDemoDetailDTO,
} from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import styles from './journey.module.css'
import form from './programme-form.module.css'
import { SetupScreen, type Apply } from './setup-screen'

/**
 * WF04-S05 — registration configuration (DEC-WF04-S05-D1..D3). CONFIGURATION
 * DEMO: who may apply (INDIVIDUAL / TEAM / STARTUP) and the programme's own
 * questions, saved to the actor's session copy; the profile-reuse rule of
 * SOT §12 stated; application counts shown read-only. No registration or
 * application engine, no open / close switch, period or eligibility rule.
 * Back → events; "Tiếp theo" waits for WF04-S06.
 */

const COPY = {
  back: '← Sự kiện',
  title: 'Đăng ký tham gia',
  hint: 'Ai được đăng ký và chương trình hỏi thêm gì.',
  edit: 'Sửa cấu hình',
  configure: 'Cấu hình đăng ký',
  empty: 'Chưa cấu hình đăng ký.',
  who: 'Ai được đăng ký',
  whoHint: 'Một người đăng ký chính cho mỗi hồ sơ: cá nhân, đội hoặc startup.',
  nobody: 'Chưa chọn.',
  questions: 'Câu hỏi riêng của chương trình',
  questionsHint: 'Không bắt buộc. Chỉ hỏi điều hồ sơ chưa có.',
  noQuestions: 'Chưa có câu hỏi.',
  question: (n: number) => `Câu hỏi ${n}`,
  addQuestion: 'Thêm câu hỏi',
  removeQuestion: 'Xoá',
  reuse:
    'Hồ sơ cá nhân và hồ sơ dự án / startup được dùng lại từ hồ sơ sẵn có; người đăng ký chỉ trả lời thêm các câu hỏi riêng của chương trình.',
  save: 'Lưu cấu hình',
  cancel: 'Huỷ',
  saved: 'Đã lưu cấu hình đăng ký.',
  blank: 'Câu hỏi không được để trống.',
  invalidType: 'Loại người đăng ký không hợp lệ.',
  counts: 'Hồ sơ đăng ký',
  countsHint: 'Số liệu minh hoạ cho bản demo, không phải hồ sơ thật.',
  noCounts: 'Chưa có hồ sơ nào.',
} as const

export function ProgrammeRegistration({
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
      step="registration"
      screen="WF04-S05"
      back={{ href: demoRoutes.setup(id, 'events'), label: COPY.back, nav: 'registration-back' }}
      next={null}
    >
      {({ detail, apply }) => <RegistrationBody detail={detail} apply={apply} />}
    </SetupScreen>
  )
}

function RegistrationBody({ detail, apply }: { detail: ProgrammeDemoDetailDTO; apply: Apply }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const { registration, application_counts } = detail
  const configured = registrationConfigured(detail)
  const counts = APPLICATION_STATUSES.filter((s) => (application_counts[s] ?? 0) > 0)

  return (
    <>
      {saved ? (
        <div className={styles.saved} data-state="registration-saved">
          <Notice>{COPY.saved}</Notice>
        </div>
      ) : null}
      <section
        className={styles.card}
        aria-labelledby="registration-config"
        data-registration-config
      >
        <header className={styles.cardHead}>
          <div>
            <h2 id="registration-config" className={`weight-semibold ${styles.cardTitle}`}>
              {COPY.title}
            </h2>
            <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.hint}</p>
          </div>
          {!editing && configured ? (
            <button
              type="button"
              className={`weight-medium ${styles.textAction}`}
              onClick={() => {
                setSaved(false)
                setEditing(true)
              }}
              data-action="edit-registration"
            >
              {COPY.edit}
            </button>
          ) : null}
        </header>
        {editing ? (
          <RegistrationEditor
            initial={{
              applicant_types: registration.applicant_types,
              questions: registration.questions,
            }}
            onCancel={() => setEditing(false)}
            onSave={(input) => {
              const outcome = apply(updateRegistration(detail, input, new Date()))
              if (outcome.ok) {
                setEditing(false)
                setSaved(true)
              }
              return outcome
            }}
          />
        ) : configured ? (
          <>
            <div className={styles.summary} data-summary="applicant-types">
              <p className={`type-body-sm weight-semibold ${styles.summaryLabel}`}>{COPY.who}</p>
              {registration.applicant_types.length > 0 ? (
                <ul className={styles.chips} aria-label={COPY.who}>
                  {registration.applicant_types.map((t) => (
                    <li key={t} className={`type-body-sm ${styles.chip}`} data-applicant-type={t}>
                      {APPLICANT_LABEL[t]}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="type-body-sm">{COPY.nobody}</p>
              )}
            </div>
            <div className={styles.summary} data-summary="questions">
              <p className={`type-body-sm weight-semibold ${styles.summaryLabel}`}>
                {COPY.questions}
              </p>
              {registration.questions.length > 0 ? (
                <ol className={`type-body-sm ${styles.questions}`} aria-label={COPY.questions}>
                  {registration.questions.map((q, i) => (
                    <li key={`${i}-${q}`} data-question>
                      {q}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="type-body-sm">{COPY.noQuestions}</p>
              )}
            </div>
          </>
        ) : (
          <div className={styles.empty} data-state="registration-empty">
            <p className="type-body-sm">{COPY.empty}</p>
          </div>
        )}
        {!editing && !configured ? (
          <div className={styles.footer}>
            <button
              type="button"
              className={`weight-medium ${buttons.secondary}`}
              onClick={() => {
                setSaved(false)
                setEditing(true)
              }}
              data-action="configure-registration"
            >
              {COPY.configure}
            </button>
          </div>
        ) : null}
        <div className={styles.footer}>
          <Notice>{COPY.reuse}</Notice>
        </div>
      </section>

      <section
        className={styles.card}
        aria-labelledby="registration-counts"
        data-application-counts
      >
        <header className={styles.cardHead}>
          <div>
            <h2 id="registration-counts" className={`weight-semibold ${styles.cardTitle}`}>
              {COPY.counts}
            </h2>
            <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.countsHint}</p>
          </div>
        </header>
        {counts.length > 0 ? (
          <ul className={styles.counts} aria-label={COPY.counts}>
            {counts.map((s) => (
              <li key={s} className={styles.count} data-count-status={s}>
                <p className={`weight-semibold ${styles.countValue}`}>{application_counts[s]}</p>
                <p className={`type-meta-xs ${styles.countLabel}`}>{APPLICATION_STATUS_LABEL[s]}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`type-body-sm ${styles.empty}`} data-state="counts-empty">
            {COPY.noCounts}
          </p>
        )}
      </section>
    </>
  )
}

function RegistrationEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: RegistrationInput
  onSave: (input: RegistrationInput) => { ok: boolean; errors?: RegistrationErrors }
  onCancel: () => void
}) {
  const [types, setTypes] = useState<string[]>(initial.applicant_types)
  const [questions, setQuestions] = useState<string[]>(initial.questions)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setSaving(true)
    const result = onSave({ applicant_types: types, questions })
    if (!result.ok) {
      if (result.errors) setErrors(result.errors)
      inFlight.current = false
      setSaving(false)
    }
  }

  return (
    <form
      className={`${form.form} ${styles.editor}`}
      onSubmit={submit}
      noValidate
      data-registration-editor
    >
      <fieldset className={form.field}>
        <legend className={`type-body-sm weight-semibold ${form.label}`}>{COPY.who}</legend>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.whoHint}</p>
        <div className={styles.checks}>
          {APPLICANT_TYPES.map((t) => (
            <label key={t} className={`type-body-md ${styles.check}`}>
              <input
                type="checkbox"
                name="applicant-type"
                value={t}
                checked={types.includes(t)}
                onChange={(e) => {
                  const value = e.target.value
                  setTypes((current) =>
                    e.target.checked ? [...current, value] : current.filter((x) => x !== value),
                  )
                  setErrors((x) => ({ ...x, applicant_types: undefined }))
                }}
              />
              {APPLICANT_LABEL[t]}
            </label>
          ))}
        </div>
        {errors.applicant_types ? (
          <p className={`type-meta-xs ${form.error}`} role="alert" data-error="applicant_types">
            {COPY.invalidType}
          </p>
        ) : null}
      </fieldset>
      <fieldset className={form.field}>
        <legend className={`type-body-sm weight-semibold ${form.label}`}>{COPY.questions}</legend>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.questionsHint}</p>
        {questions.map((q, i) => {
          const blank = errors.questions?.includes(i)
          return (
            <div key={i} className={styles.questionRow} data-question-row={i}>
              <div>
                <label htmlFor={`rq-${i}`} className={`type-body-sm ${form.dateLabel}`}>
                  {COPY.question(i + 1)}
                </label>
                <TextInput
                  id={`rq-${i}`}
                  value={q}
                  invalid={Boolean(blank)}
                  onChange={(e) => {
                    const value = e.target.value
                    setQuestions((current) => current.map((x, j) => (j === i ? value : x)))
                    setErrors((x) => ({ ...x, questions: x.questions?.filter((j) => j !== i) }))
                  }}
                />
                {blank ? (
                  <p
                    className={`type-meta-xs ${form.error}`}
                    role="alert"
                    data-error={`question-${i}`}
                  >
                    {COPY.blank}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className={`weight-medium ${styles.textAction}`}
                aria-label={`${COPY.removeQuestion} ${COPY.question(i + 1).toLowerCase()}`}
                onClick={() => {
                  setQuestions((current) => current.filter((_, j) => j !== i))
                  setErrors({})
                }}
                data-action="remove-question"
              >
                {COPY.removeQuestion}
              </button>
            </div>
          )
        })}
        <div className={styles.editorActions}>
          <button
            type="button"
            className={`weight-medium ${buttons.secondary}`}
            onClick={() => setQuestions((current) => [...current, ''])}
            data-action="add-question"
          >
            {COPY.addQuestion}
          </button>
        </div>
      </fieldset>
      <div className={styles.editorActions}>
        <button
          type="submit"
          className={`weight-medium ${buttons.primary}`}
          disabled={saving}
          aria-busy={saving || undefined}
          data-action="save-registration"
        >
          {COPY.save}
        </button>
        <button type="button" className={`weight-medium ${buttons.secondary}`} onClick={onCancel}>
          {COPY.cancel}
        </button>
      </div>
    </form>
  )
}
