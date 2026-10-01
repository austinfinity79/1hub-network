'use client'

import { useRef, useState, type FormEvent } from 'react'

import { TextInput } from '@/components/ui'
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
  type ProblemErrors,
  type ProblemInput,
  type StageErrors,
  type StageInput,
} from '@/lib/programme-demo/journey'
import { demoRoutes } from '@/lib/programme-demo/routes'
import type { ProblemStatementDTO, ProgrammeStageDTO } from '@/lib/programme-demo/types'
import type { ProgrammeDetailDTO } from '@/lib/programme/types'
import type { ProgrammeScreen } from '@/lib/programme/view'

import buttons from './demo-buttons.module.css'
import form from './programme-form.module.css'
import styles from './journey.module.css'
import { Confirm, SetupScreen, type Apply } from './setup-screen'

/**
 * WF04-S03 — Structure & journey (DEC-WF04-H3/H4, DEC-WF04-S03-D1..D3).
 *
 * The ordered stage list of one demo Programme / Challenge, and for a
 * CHALLENGE the inline "Bài toán" list. Add / edit / remove and move up /
 * down only; every change is one atomic edit of the actor's session copy,
 * nothing reaches the server. Back returns to the list (the basic-info step is
 * built with S08); "Tiếp theo" opens WF04-S04 (DEC-WF04-S04-D3).
 */

const COPY = {
  back: '← Danh sách',
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
  problemsHint: 'Các bài toán của challenge này.',
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

export function ProgrammeJourney({ id, initial }: { id: string; initial: ProgrammeDetailDTO }) {
  return (
    <SetupScreen
      initial={initial}
      step="journey"
      screen="WF04-S03"
      back={{ href: demoRoutes.list(), label: COPY.back, nav: 'journey-back' }}
      next={demoRoutes.setup(id, 'events')}
    >
      {({ detail, apply }) => <JourneyBody detail={detail} apply={apply} />}
    </SetupScreen>
  )
}

function JourneyBody({ detail, apply: store }: { detail: ProgrammeScreen; apply: Apply }) {
  const [editing, setEditing] = useState<Editing>(null)
  const challenge = detail.programme.type === 'CHALLENGE'
  // Read only when the server says so (closed / archived programme or owner).
  const editable = detail.actions.edit
  /** One atomic edit, persisted by the server; the open editor closes when it is saved. */
  const apply: Apply = async (result) => {
    const outcome = await store(result)
    if (outcome.ok) setEditing(null)
    return outcome
  }
  const stages = orderedStages(detail)
  const problems = detail.problem_statements ?? []
  const now = () => new Date()

  return (
    <>
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
                      <p className={`type-body-sm weight-semibold ${styles.name}`}>{stage.name}</p>
                      <p className={`type-meta-xs ${styles.meta}`}>
                        {[formatDemoDateRange(stage.starts_at, stage.ends_at), stage.summary]
                          .filter((x) => x && x !== '—')
                          .join(' · ') || '—'}
                      </p>
                    </div>
                    {!editable ? null : editing?.kind === 'stage-remove' &&
                      editing.id === stage.id ? (
                      <Confirm
                        text={COPY.removeStage(stage.name)}
                        onYes={() => apply(removeStage(detail, stage.id, now()))}
                        yes={COPY.remove}
                        no={COPY.cancel}
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
        {!editable ? null : editing?.kind === 'stage-add' ? (
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
                      {!editable ? null : editing?.kind === 'problem-remove' &&
                        editing.id === problem.id ? (
                        <Confirm
                          text={COPY.removeProblem(problem.title)}
                          onYes={() => apply(removeProblem(detail, problem.id, now()))}
                          yes={COPY.remove}
                          no={COPY.cancel}
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
          {!editable ? null : (
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
          )}
        </section>
      ) : null}
    </>
  )
}

function StageEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ProgrammeStageDTO
  onSave: (input: StageInput) => Promise<{ ok: boolean; errors?: StageErrors }>
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
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    const result = await onSave(input)
    inFlight.current = false
    setBusy(false)
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
          disabled={busy}
          aria-busy={busy || undefined}
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
  onSave: (input: ProblemInput) => Promise<{ ok: boolean; errors?: ProblemErrors }>
  onCancel: () => void
}) {
  const [input, setInput] = useState<ProblemInput>({
    title: initial?.title ?? '',
    summary: initial?.summary ?? '',
  })
  const [errors, setErrors] = useState<ProblemErrors>({})
  const key = initial?.id ?? 'new'
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    const result = await onSave(input)
    inFlight.current = false
    setBusy(false)
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
          disabled={busy}
          aria-busy={busy || undefined}
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
