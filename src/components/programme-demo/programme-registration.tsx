'use client'

import { useRef, useState, type FormEvent } from 'react'

import { Notice, TextInput } from '@/components/ui'
import { APPLICANT_LABEL } from '@/lib/programme-demo/copy'
import { registrationConfigured } from '@/lib/programme-demo/registration'
import { demoRoutes } from '@/lib/programme-demo/routes'
import {
  REGISTRATION_APPLICANT_TYPES,
  type ProgrammeDetailDTO,
  type RegistrationQuestionDTO,
} from '@/lib/programme/types'
import type { ProgrammeScreen } from '@/lib/programme/view'

import buttons from './demo-buttons.module.css'
import styles from './journey.module.css'
import form from './programme-form.module.css'
import { SetupScreen, type Send } from './setup-screen'

/**
 * WF04-S05 — registration configuration (DEC-WF04-S05-D1..D3; WF04-PROD-04).
 * The canonical form WF05 reads (`PUT /programmes/{id}/registration`): who may
 * apply (TEAM / STARTUP — the canonical applicant types; INDIVIDUAL is not one,
 * PO decision 4) and the programme's own questions. Each question keeps the
 * `required` and `step` the server stores; a new question would need them and
 * no default is approved (contract Q3), so adding one is unavailable. Once an
 * application exists the form is read only (PO decision 3). The
 * profile-reuse rule of SOT §12 is stated. No application count (Q5).
 * Back → events; "Tiếp theo" opens WF04-S06 (DEC-WF04-S06-D3).
 */

const COPY = {
  back: '← Sự kiện',
  title: 'Đăng ký tham gia',
  hint: 'Ai được đăng ký và chương trình hỏi thêm gì.',
  edit: 'Sửa cấu hình',
  configure: 'Cấu hình đăng ký',
  empty: 'Chưa cấu hình đăng ký.',
  who: 'Ai được đăng ký',
  whoHint: 'Một người đăng ký chính cho mỗi hồ sơ: đội hoặc startup.',
  nobody: 'Chưa chọn.',
  questions: 'Câu hỏi riêng của chương trình',
  questionsHint: 'Không bắt buộc. Chỉ hỏi điều hồ sơ chưa có.',
  noQuestions: 'Chưa có câu hỏi.',
  question: (n: number) => `Câu hỏi ${n}`,
  addQuestion: 'Thêm câu hỏi',
  addUnavailable: 'Chưa thêm được câu hỏi mới trong bản này.',
  removeQuestion: 'Xoá',
  reuse:
    'Hồ sơ cá nhân và hồ sơ dự án / startup được dùng lại từ hồ sơ sẵn có; người đăng ký chỉ trả lời thêm các câu hỏi riêng của chương trình.',
  save: 'Lưu cấu hình',
  cancel: 'Huỷ',
  saved: 'Đã lưu cấu hình đăng ký.',
  blank: 'Câu hỏi không được để trống.',
  typesRequired: 'Chọn ít nhất một loại người đăng ký.',
  locked: 'Đã có hồ sơ đăng ký nên cấu hình này không thay đổi được.',
} as const

export function ProgrammeRegistration({
  id,
  initial,
}: {
  id: string
  initial: ProgrammeDetailDTO
}) {
  return (
    <SetupScreen
      initial={initial}
      step="registration"
      screen="WF04-S05"
      back={{ href: demoRoutes.setup(id, 'events'), label: COPY.back, nav: 'registration-back' }}
      next={demoRoutes.setup(id, 'team')}
    >
      {({ detail, send }) => <RegistrationBody detail={detail} send={send} />}
    </SetupScreen>
  )
}

type Draft = { applicant_types: string[]; questions: RegistrationQuestionDTO[] }
type DraftErrors = { applicant_types?: 'required'; questions?: number[] }

function RegistrationBody({ detail, send }: { detail: ProgrammeScreen; send: Send }) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)
  const { registration } = detail
  const configured = registrationConfigured(detail)
  // The server decides: an editable programme with no application yet.
  const changeable = detail.actions.registration
  const locked = detail.actions.edit && !changeable

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
          {!editing && configured && changeable ? (
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
        {locked ? (
          <div className={styles.footer} data-state="registration-locked">
            <Notice>{COPY.locked}</Notice>
          </div>
        ) : null}
        {editing ? (
          <RegistrationEditor
            initial={{
              applicant_types: detail.form?.applicant_types ?? [],
              questions: detail.form?.questions ?? [],
            }}
            onCancel={() => setEditing(false)}
            onSave={async (draft) => {
              const outcome = await send({
                path: `/programmes/${encodeURIComponent(detail.programme.id)}/registration`,
                method: 'PUT',
                body: draft,
              })
              if (outcome.ok) {
                setEditing(false)
                setSaved(true)
              }
              return outcome.ok
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
        {!editing && !configured && changeable ? (
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
    </>
  )
}

function RegistrationEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: Draft
  onSave: (draft: Draft) => Promise<boolean>
  onCancel: () => void
}) {
  const [types, setTypes] = useState<string[]>(initial.applicant_types)
  const [questions, setQuestions] = useState<RegistrationQuestionDTO[]>(initial.questions)
  const [errors, setErrors] = useState<DraftErrors>({})
  const [saving, setSaving] = useState(false)
  const inFlight = useRef(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    const found: DraftErrors = {}
    if (types.length === 0) found.applicant_types = 'required'
    const blank = questions.flatMap((q, i) => (q.prompt.trim() ? [] : [i]))
    if (blank.length > 0) found.questions = blank
    setErrors(found)
    if (Object.keys(found).length > 0) return
    inFlight.current = true
    setSaving(true)
    const ok = await onSave({
      // Canonical order, each once.
      applicant_types: REGISTRATION_APPLICANT_TYPES.filter((t) => types.includes(t)),
      questions: questions.map((q) => ({ ...q, prompt: q.prompt.trim() })),
    })
    if (!ok) {
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
          {REGISTRATION_APPLICANT_TYPES.map((t) => (
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
            {COPY.typesRequired}
          </p>
        ) : null}
      </fieldset>
      <fieldset className={form.field}>
        <legend className={`type-body-sm weight-semibold ${form.label}`}>{COPY.questions}</legend>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.questionsHint}</p>
        {questions.map((q, i) => {
          const blank = errors.questions?.includes(i)
          return (
            <div key={q.id} className={styles.questionRow} data-question-row={i}>
              <div>
                <label htmlFor={`rq-${i}`} className={`type-body-sm ${form.dateLabel}`}>
                  {COPY.question(i + 1)}
                </label>
                <TextInput
                  id={`rq-${i}`}
                  value={q.prompt}
                  invalid={Boolean(blank)}
                  onChange={(e) => {
                    const value = e.target.value
                    setQuestions((current) =>
                      current.map((x, j) => (j === i ? { ...x, prompt: value } : x)),
                    )
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
            disabled
            aria-disabled="true"
            title={COPY.addUnavailable}
            aria-label={`${COPY.addQuestion} — ${COPY.addUnavailable}`}
            data-nav-kind="INERT"
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
