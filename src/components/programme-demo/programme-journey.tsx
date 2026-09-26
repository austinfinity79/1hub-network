'use client'

import Link from 'next/link'
import { useState, type FormEvent } from 'react'

import { Notice, TextInput } from '@/components/ui'
import { INERT_REASONS } from '@/lib/member/nav'
import { STATUS_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatDemoDateRange } from '@/lib/programme-demo/format'
import {
  addProblem,
  addStage,
  instantToDay,
  moveStage,
  orderedStages,
  removeProblem,
  removeStage,
  updateProblem,
  updateStage,
  type EditResult,
  type ProblemErrors,
  type ProblemInput,
  type StageErrors,
  type StageInput,
} from '@/lib/programme-demo/journey'
import { demoRoutes } from '@/lib/programme-demo/routes'
import { effectiveDetail, inAllowance } from '@/lib/programme-demo/session-store'
import type {
  ProblemStatementDTO,
  ProgrammeDemoDetail,
  ProgrammeDemoDetailDTO,
  ProgrammeStageDTO,
} from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import { DemoPage } from './demo-page'
import { useProgrammeDemo } from './demo-store'
import form from './programme-form.module.css'
import styles from './journey.module.css'
import { SetupStepper } from './setup-stepper'

/**
 * WF04-S03 — Structure & journey (DEC-WF04-H3/H4, DEC-WF04-S03-D1..D3).
 *
 * The ordered stage list of one demo Programme / Challenge, and for a
 * CHALLENGE the inline "Bài toán" list. Add / edit / remove and move up /
 * down only; every change is one atomic edit of the actor's session copy,
 * nothing reaches the server. Back returns to the list (the basic-info step is
 * built with S08); "Tiếp theo" waits for WF04-S04.
 */

const COPY = {
  back: '← Danh sách',
  next: 'Tiếp theo',
  loading: 'Đang tải hành trình…',
  missingTitle: 'Không tìm thấy chương trình',
  missing: 'Không tìm thấy chương trình này trong bản demo của bạn.',
  toList: 'Về danh sách',
  stages: 'Giai đoạn',
  stagesHint: 'Các giai đoạn theo thứ tự diễn ra.',
  noStages: 'Chưa có giai đoạn nào.',
  addStage: 'Thêm giai đoạn',
  stageName: 'Tên giai đoạn',
  stageSummary: 'Mô tả ngắn',
  optional: 'Không bắt buộc.',
  start: 'Ngày bắt đầu',
  end: 'Ngày kết thúc',
  dates: 'Thời gian',
  datesHint: 'Không bắt buộc. Theo ngày tại Việt Nam.',
  saveStage: 'Lưu giai đoạn',
  problems: 'Bài toán',
  problemsHint: 'Challenge cần ít nhất một bài toán trước khi công khai.',
  noProblems: 'Chưa có bài toán nào.',
  addProblem: 'Thêm bài toán',
  problemTitle: 'Tên bài toán',
  saveProblem: 'Lưu bài toán',
  edit: 'Sửa',
  remove: 'Xoá',
  cancel: 'Huỷ',
  up: (name: string) => `Chuyển “${name}” lên`,
  down: (name: string) => `Chuyển “${name}” xuống`,
  removeStage: (name: string) => `Xoá giai đoạn “${name}”?`,
  removeProblem: (name: string) => `Xoá bài toán “${name}”?`,
  required: 'Trường này là bắt buộc.',
  dayInvalid: 'Ngày chưa hợp lệ.',
  dayOrder: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.',
  failed: 'Chưa lưu được thay đổi. Vui lòng thử lại.',
} as const

type Editing =
  | { kind: 'stage-add' }
  | { kind: 'stage-edit'; id: string }
  | { kind: 'stage-remove'; id: string }
  | { kind: 'problem-add' }
  | { kind: 'problem-edit'; id: string }
  | { kind: 'problem-remove'; id: string }
  | null

const newId = () => crypto.randomUUID()

export function ProgrammeJourney({
  id,
  server,
}: {
  id: string
  server: ProgrammeDemoDetailDTO | null
}) {
  const { state, allowance, ready, save } = useProgrammeDemo()
  const [editing, setEditing] = useState<Editing>(null)
  const [failed, setFailed] = useState(false)

  if (!ready) {
    return (
      <DemoPage title={COPY.stages}>
        <p className="type-body-sm" data-state="journey-loading">
          {COPY.loading}
        </p>
      </DemoPage>
    )
  }

  const detail = effectiveDetail(state, id, server ?? undefined)
  if (!detail || !inAllowance(detail, allowance)) {
    return (
      <div data-screen="WF04-S03">
        <DemoPage title={COPY.missingTitle}>
          <div className={styles.missing} data-state="journey-missing">
            <p className="type-body-sm">{COPY.missing}</p>
            <Link href={demoRoutes.list()} className={`weight-medium ${buttons.secondary}`}>
              {COPY.toList}
            </Link>
          </div>
        </DemoPage>
      </div>
    )
  }

  const { programme, organization } = detail
  const challenge = programme.type === 'CHALLENGE'

  /** Applies one atomic edit to the session copy; false when refused or not stored. */
  function apply<E>(result: EditResult<E>): { errors?: E; ok: boolean } {
    if (!result.ok)
      return result.reason === 'invalid' ? { ok: false, errors: result.errors } : { ok: false }
    const next: ProgrammeDemoDetailDTO = {
      ...(result.detail as ProgrammeDemoDetail),
      organization,
      demo: true,
    }
    if (!save(next)) {
      setFailed(true)
      return { ok: false }
    }
    setFailed(false)
    setEditing(null)
    return { ok: true }
  }

  const stages = orderedStages(detail)
  const problems = detail.problem_statements ?? []
  const now = () => new Date()

  return (
    <div data-screen="WF04-S03" data-programme-type={programme.type}>
      <DemoPage
        title={programme.name}
        meta={`${TYPE_LABEL[programme.type]} · ${STATUS_LABEL[programme.status]} · ${organization.name}`}
        actions={
          <div className={buttons.group}>
            <Link
              href={demoRoutes.list()}
              className={`weight-medium ${buttons.secondary}`}
              data-nav="journey-back"
            >
              {COPY.back}
            </Link>
            <button
              type="button"
              className={`weight-medium ${buttons.primary}`}
              disabled
              aria-disabled="true"
              title={INERT_REASONS.NO_P0_SCREEN}
              aria-label={`${COPY.next} — ${INERT_REASONS.NO_P0_SCREEN}`}
              data-nav-kind="INERT"
              data-journey-next
            >
              {COPY.next}
            </button>
          </div>
        }
      >
        <div className={styles.stepper}>
          <SetupStepper current="journey" />
        </div>
        {failed ? (
          <div className={styles.notice} data-state="save-failed">
            <Notice tone="error">{COPY.failed}</Notice>
          </div>
        ) : null}

        <section className={styles.card} aria-labelledby="journey-stages" data-journey-stages>
          <header className={styles.cardHead}>
            <div>
              <h2 id="journey-stages" className={`weight-semibold ${styles.cardTitle}`}>
                {COPY.stages}
              </h2>
              <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.stagesHint}</p>
            </div>
          </header>
          {stages.length === 0 ? (
            <p className={`type-body-sm ${styles.empty}`} data-state="stages-empty">
              {COPY.noStages}
            </p>
          ) : (
            <ol className={styles.list} aria-label={COPY.stages}>
              {stages.map((stage, i) => (
                <li
                  key={stage.id}
                  className={styles.item}
                  data-stage-id={stage.id}
                  data-position={stage.position}
                >
                  {editing?.kind === 'stage-edit' && editing.id === stage.id ? (
                    <StageEditor
                      initial={stage}
                      onCancel={() => setEditing(null)}
                      onSave={(input) => apply(updateStage(detail, stage.id, input, now()))}
                    />
                  ) : (
                    <>
                      <span className={`type-body-sm weight-semibold ${styles.index}`}>
                        {String(stage.position).padStart(2, '0')}
                      </span>
                      <div className={styles.main}>
                        <p className={`type-body-sm weight-semibold ${styles.name}`}>
                          {stage.name}
                        </p>
                        <p className={`type-meta-xs ${styles.meta}`}>
                          {[formatDemoDateRange(stage.starts_at, stage.ends_at), stage.summary]
                            .filter((x) => x && x !== '—')
                            .join(' · ') || '—'}
                        </p>
                      </div>
                      {editing?.kind === 'stage-remove' && editing.id === stage.id ? (
                        <Confirm
                          text={COPY.removeStage(stage.name)}
                          onYes={() => apply(removeStage(detail, stage.id, now()))}
                          onNo={() => setEditing(null)}
                        />
                      ) : (
                        <div className={styles.controls}>
                          <button
                            type="button"
                            className={styles.move}
                            aria-label={COPY.up(stage.name)}
                            disabled={i === 0}
                            onClick={() => apply(moveStage(detail, stage.id, 'up', now()))}
                            data-move="up"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={styles.move}
                            aria-label={COPY.down(stage.name)}
                            disabled={i === stages.length - 1}
                            onClick={() => apply(moveStage(detail, stage.id, 'down', now()))}
                            data-move="down"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={`weight-medium ${styles.textAction}`}
                            onClick={() => setEditing({ kind: 'stage-edit', id: stage.id })}
                            data-action="edit"
                          >
                            {COPY.edit}
                          </button>
                          <button
                            type="button"
                            className={`weight-medium ${styles.textAction}`}
                            onClick={() => setEditing({ kind: 'stage-remove', id: stage.id })}
                            data-action="remove"
                          >
                            {COPY.remove}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ol>
          )}
          {editing?.kind === 'stage-add' ? (
            <div className={styles.footer}>
              <StageEditor
                onCancel={() => setEditing(null)}
                onSave={(input) => apply(addStage(detail, input, { id: newId(), now: now() }))}
              />
            </div>
          ) : (
            <div className={styles.footer}>
              <button
                type="button"
                className={`weight-medium ${buttons.secondary}`}
                onClick={() => setEditing({ kind: 'stage-add' })}
                data-action="add-stage"
              >
                {COPY.addStage}
              </button>
            </div>
          )}
        </section>

        {challenge ? (
          <section className={styles.card} aria-labelledby="journey-problems" data-journey-problems>
            <header className={styles.cardHead}>
              <div>
                <h2 id="journey-problems" className={`weight-semibold ${styles.cardTitle}`}>
                  {COPY.problems}
                </h2>
                <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.problemsHint}</p>
              </div>
            </header>
            {problems.length === 0 ? (
              <p className={`type-body-sm ${styles.empty}`} data-state="problems-empty">
                {COPY.noProblems}
              </p>
            ) : (
              <ul className={styles.list} aria-label={COPY.problems}>
                {problems.map((problem) => (
                  <li key={problem.id} className={styles.item} data-problem-id={problem.id}>
                    {editing?.kind === 'problem-edit' && editing.id === problem.id ? (
                      <ProblemEditor
                        initial={problem}
                        onCancel={() => setEditing(null)}
                        onSave={(input) => apply(updateProblem(detail, problem.id, input, now()))}
                      />
                    ) : (
                      <>
                        <div className={styles.main}>
                          <p className={`type-body-sm weight-semibold ${styles.name}`}>
                            {problem.title}
                          </p>
                          {problem.summary ? (
                            <p className={`type-meta-xs ${styles.meta}`}>{problem.summary}</p>
                          ) : null}
                        </div>
                        {editing?.kind === 'problem-remove' && editing.id === problem.id ? (
                          <Confirm
                            text={COPY.removeProblem(problem.title)}
                            onYes={() => apply(removeProblem(detail, problem.id, now()))}
                            onNo={() => setEditing(null)}
                          />
                        ) : (
                          <div className={styles.controls}>
                            <button
                              type="button"
                              className={`weight-medium ${styles.textAction}`}
                              onClick={() => setEditing({ kind: 'problem-edit', id: problem.id })}
                              data-action="edit"
                            >
                              {COPY.edit}
                            </button>
                            <button
                              type="button"
                              className={`weight-medium ${styles.textAction}`}
                              onClick={() => setEditing({ kind: 'problem-remove', id: problem.id })}
                              data-action="remove"
                            >
                              {COPY.remove}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className={styles.footer}>
              {editing?.kind === 'problem-add' ? (
                <ProblemEditor
                  onCancel={() => setEditing(null)}
                  onSave={(input) => apply(addProblem(detail, input, { id: newId(), now: now() }))}
                />
              ) : (
                <button
                  type="button"
                  className={`weight-medium ${buttons.secondary}`}
                  onClick={() => setEditing({ kind: 'problem-add' })}
                  data-action="add-problem"
                >
                  {COPY.addProblem}
                </button>
              )}
            </div>
          </section>
        ) : null}
      </DemoPage>
    </div>
  )
}

function Confirm({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <div className={styles.confirm} role="group" aria-label={text} data-confirm>
      <p className={`type-body-sm weight-medium ${styles.confirmText}`}>{text}</p>
      <button
        type="button"
        className={`weight-medium ${buttons.primary}`}
        onClick={onYes}
        data-confirm="yes"
      >
        {COPY.remove}
      </button>
      <button
        type="button"
        className={`weight-medium ${buttons.secondary}`}
        onClick={onNo}
        data-confirm="no"
      >
        {COPY.cancel}
      </button>
    </div>
  )
}

function StageEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ProgrammeStageDTO
  onSave: (input: StageInput) => { ok: boolean; errors?: StageErrors }
  onCancel: () => void
}) {
  const [input, setInput] = useState<StageInput>({
    name: initial?.name ?? '',
    summary: initial?.summary ?? '',
    starts_on: instantToDay(initial?.starts_at ?? null),
    ends_on: instantToDay(initial?.ends_at ?? null),
  })
  const [errors, setErrors] = useState<StageErrors>({})
  const key = initial?.id ?? 'new'
  const update = (field: keyof StageInput, value: string) => {
    setInput((i) => ({ ...i, [field]: value }))
    setErrors((e) => ({
      ...e,
      [field === 'starts_on' || field === 'ends_on' ? 'dates' : field]: undefined,
    }))
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = onSave(input)
    if (!result.ok && result.errors) setErrors(result.errors)
  }
  return (
    <form
      className={`${form.form} ${styles.editor}`}
      onSubmit={submit}
      noValidate
      data-stage-editor
    >
      <section className={form.field}>
        <label htmlFor={`st-name-${key}`} className={`type-body-sm weight-semibold ${form.label}`}>
          {COPY.stageName}
        </label>
        <TextInput
          id={`st-name-${key}`}
          value={input.name}
          invalid={Boolean(errors.name)}
          onChange={(e) => update('name', e.target.value)}
        />
        {errors.name ? (
          <p className={`type-meta-xs ${form.error}`} role="alert" data-error="name">
            {COPY.required}
          </p>
        ) : null}
      </section>
      <section className={form.field}>
        <label
          htmlFor={`st-summary-${key}`}
          className={`type-body-sm weight-semibold ${form.label}`}
        >
          {COPY.stageSummary}
        </label>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.optional}</p>
        <TextInput
          id={`st-summary-${key}`}
          value={input.summary}
          onChange={(e) => update('summary', e.target.value)}
        />
      </section>
      <fieldset className={form.field}>
        <legend className={`type-body-sm weight-semibold ${form.label}`}>{COPY.dates}</legend>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.datesHint}</p>
        <div className={form.dates}>
          <div>
            <label htmlFor={`st-start-${key}`} className={`type-body-sm ${form.dateLabel}`}>
              {COPY.start}
            </label>
            <TextInput
              id={`st-start-${key}`}
              type="date"
              value={input.starts_on}
              invalid={errors.dates === 'invalid'}
              onChange={(e) => update('starts_on', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`st-end-${key}`} className={`type-body-sm ${form.dateLabel}`}>
              {COPY.end}
            </label>
            <TextInput
              id={`st-end-${key}`}
              type="date"
              value={input.ends_on}
              invalid={Boolean(errors.dates)}
              onChange={(e) => update('ends_on', e.target.value)}
            />
          </div>
        </div>
        {errors.dates ? (
          <p className={`type-meta-xs ${form.error}`} role="alert" data-error="dates">
            {errors.dates === 'order' ? COPY.dayOrder : COPY.dayInvalid}
          </p>
        ) : null}
      </fieldset>
      <div className={styles.editorActions}>
        <button
          type="submit"
          className={`weight-medium ${buttons.primary}`}
          data-action="save-stage"
        >
          {COPY.saveStage}
        </button>
        <button type="button" className={`weight-medium ${buttons.secondary}`} onClick={onCancel}>
          {COPY.cancel}
        </button>
      </div>
    </form>
  )
}

function ProblemEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ProblemStatementDTO
  onSave: (input: ProblemInput) => { ok: boolean; errors?: ProblemErrors }
  onCancel: () => void
}) {
  const [input, setInput] = useState<ProblemInput>({
    title: initial?.title ?? '',
    summary: initial?.summary ?? '',
  })
  const [errors, setErrors] = useState<ProblemErrors>({})
  const key = initial?.id ?? 'new'
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = onSave(input)
    if (!result.ok && result.errors) setErrors(result.errors)
  }
  return (
    <form
      className={`${form.form} ${styles.editor}`}
      onSubmit={submit}
      noValidate
      data-problem-editor
    >
      <section className={form.field}>
        <label htmlFor={`pr-title-${key}`} className={`type-body-sm weight-semibold ${form.label}`}>
          {COPY.problemTitle}
        </label>
        <TextInput
          id={`pr-title-${key}`}
          value={input.title}
          invalid={Boolean(errors.title)}
          onChange={(e) => {
            setInput((i) => ({ ...i, title: e.target.value }))
            setErrors({})
          }}
        />
        {errors.title ? (
          <p className={`type-meta-xs ${form.error}`} role="alert" data-error="title">
            {COPY.required}
          </p>
        ) : null}
      </section>
      <section className={form.field}>
        <label
          htmlFor={`pr-summary-${key}`}
          className={`type-body-sm weight-semibold ${form.label}`}
        >
          {COPY.stageSummary}
        </label>
        <p className={`type-meta-xs ${form.hint}`}>{COPY.optional}</p>
        <TextInput
          id={`pr-summary-${key}`}
          value={input.summary}
          onChange={(e) => setInput((i) => ({ ...i, summary: e.target.value }))}
        />
      </section>
      <div className={styles.editorActions}>
        <button
          type="submit"
          className={`weight-medium ${buttons.primary}`}
          data-action="save-problem"
        >
          {COPY.saveProblem}
        </button>
        <button type="button" className={`weight-medium ${buttons.secondary}`} onClick={onCancel}>
          {COPY.cancel}
        </button>
      </div>
    </form>
  )
}
