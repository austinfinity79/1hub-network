'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'

import buttons from '@/components/programme-demo/demo-buttons.module.css'
import { DemoPage } from '@/components/programme-demo/demo-page'
import cards from '@/components/programme-demo/journey.module.css'
import form from '@/components/programme-demo/programme-form.module.css'
import { Notice } from '@/components/ui'
import { APPLICANT_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatDemoDateRange } from '@/lib/programme-demo/format'
import {
  answersTooLong,
  applicationOf,
  DEMO_ANSWER_MAX,
  saveDraft,
} from '@/lib/project-demo/application-store'
import { S02_COPY, S03_COPY as COPY, VENTURE_TYPE_LABEL } from '@/lib/project-demo/copy'
import { projectDemoRoutes } from '@/lib/project-demo/routes'
import type {
  DemoApplication,
  DemoVentureDetailDTO,
  VentureContext,
} from '@/lib/project-demo/types'

import { useProjectDemo } from './demo-store'
import styles from './project-list.module.css'

/**
 * WF05-S03 — the demo application draft (DEC-WF05-G3..G5, INTENTIONAL-DEMO
 * composition: the WF04 demo frame, card chrome and question form, the WF02
 * field language). The venture and the programme are read live from
 * `GET /api/v1/demo/projects/{id}`; the draft is the actor's browser-session
 * application (T00 store): the venture id, the derived applicant type, the
 * answers and the state — never venture or programme data. Opening the page
 * stores nothing; "Lưu nháp" creates the DRAFT once and then updates it
 * (answers may be incomplete). Only the eligible owner edits; a SUBMITTED
 * application is shown read only. "Rà soát & nộp" saves the draft and opens
 * S04, which owns review and submit.
 */

type Programme = DemoVentureDetailDTO['programmes'][number]
type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'missing' }
  | { kind: 'ready'; data: DemoVentureDetailDTO; programme: Programme }

export function ProjectDemoApplication({
  ventureId,
  programmeId,
}: {
  ventureId: string
  programmeId: string
}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const fetchDetail = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      const response = await fetch(`/api/v1/demo/projects/${encodeURIComponent(ventureId)}`, {
        cache: 'no-store',
      })
      if (response.status === 404) return setLoad({ kind: 'missing' })
      if (!response.ok) throw new Error(String(response.status))
      const data = (await response.json()) as DemoVentureDetailDTO
      const programme = data.programmes.find((p) => p.id === programmeId)
      setLoad(programme ? { kind: 'ready', data, programme } : { kind: 'missing' })
    } catch {
      setLoad({ kind: 'failed' })
    }
  }, [ventureId, programmeId])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  const back = (
    <Link
      href={projectDemoRoutes.detail(ventureId)}
      className={`weight-medium ${buttons.secondary}`}
      data-nav="application-back"
    >
      {COPY.back}
    </Link>
  )

  if (load.kind !== 'ready') {
    return (
      <div data-screen="WF05-S03">
        <DemoPage title={load.kind === 'loading' ? COPY.loading : ''} actions={back}>
          {load.kind === 'loading' ? (
            <p className="type-body-sm" data-state="application-loading" aria-busy="true">
              {COPY.loading}
            </p>
          ) : load.kind === 'missing' ? (
            <div className={cards.missing} data-state="application-missing">
              <p className="type-body-sm">{COPY.missing}</p>
            </div>
          ) : (
            <div className={cards.missing} role="alert" data-state="application-failed">
              <p className="type-body-sm">{COPY.failed}</p>
              <button
                type="button"
                className={`weight-medium ${styles.textAction}`}
                onClick={() => void fetchDetail()}
                data-action="retry"
              >
                {COPY.retry}
              </button>
            </div>
          )}
        </DemoPage>
      </div>
    )
  }
  return <ApplicationScreen data={load.data} programme={load.programme} back={back} />
}

function ApplicationScreen({
  data,
  programme,
  back,
}: {
  data: DemoVentureDetailDTO
  programme: Programme
  back: React.ReactNode
}) {
  const { state, ready, readFailed, reread, generation } = useProjectDemo()
  const { venture } = data
  const application = ready && !readFailed ? applicationOf(state, venture.id, programme.id) : null
  const mismatch =
    application !== null &&
    application.programme_specific_answers.length !== programme.questions.length
  const editable =
    ready &&
    !readFailed &&
    programme.eligibility.eligible &&
    application?.status !== 'SUBMITTED' &&
    !mismatch
  const stateLabel = !application
    ? COPY.stateNew
    : application.status === 'SUBMITTED'
      ? 'Đã nộp'
      : COPY.stateDraft

  return (
    <div
      data-screen="WF05-S03"
      data-application-state={application?.status ?? 'NONE'}
      data-editable={String(editable)}
    >
      <DemoPage
        title={COPY.title(programme.name)}
        meta={`${venture.name} · ${stateLabel}`}
        actions={
          <div className={buttons.group}>
            {back}
            {editable ? (
              // WF05-S04: saves the draft (nothing typed is lost), then opens the review.
              <button
                type="submit"
                form="application-form"
                className={`weight-medium ${buttons.primary}`}
                data-intent="review"
                data-action="review"
              >
                {COPY.review}
              </button>
            ) : null}
          </div>
        }
      >
        <section
          className={cards.card}
          aria-labelledby="application-applicant"
          data-section="applicant"
        >
          <header className={cards.cardHead}>
            <h2 id="application-applicant" className={`weight-semibold ${cards.cardTitle}`}>
              {COPY.applicant}
            </h2>
          </header>
          <div className={cards.cardBody}>
            <p className={`type-body-md weight-medium ${styles.name}`} data-applicant-name>
              {venture.name}
            </p>
            <p className={`type-meta-xs ${cards.meta}`} data-applicant-meta>
              {VENTURE_TYPE_LABEL[venture.type] ?? venture.type} · {COPY.applicantAs}:{' '}
              {APPLICANT_LABEL[venture.applicant_type]}
            </p>
            <div className={styles.applications}>
              <Notice>{COPY.reuse}</Notice>
            </div>
          </div>
        </section>

        <section
          className={cards.card}
          aria-labelledby="application-programme"
          data-section="programme"
        >
          <header className={cards.cardHead}>
            <h2 id="application-programme" className={`weight-semibold ${cards.cardTitle}`}>
              {COPY.programme}
            </h2>
          </header>
          <div className={cards.cardBody}>
            <p className={`type-meta-xs ${cards.meta}`} data-programme-kind>
              {TYPE_LABEL[programme.type]} · {programme.organization.name}
            </p>
            <p className={`type-body-md weight-medium ${styles.name}`} data-programme-name>
              {programme.name}
            </p>
            <p className={`type-meta-xs ${cards.meta}`}>
              {formatDemoDateRange(programme.starts_at, programme.ends_at)}
            </p>
          </div>
        </section>

        <section
          className={cards.card}
          aria-labelledby="application-questions"
          data-section="questions"
        >
          <header className={cards.cardHead}>
            <div>
              <h2 id="application-questions" className={`weight-semibold ${cards.cardTitle}`}>
                {COPY.questions}
              </h2>
              {editable ? (
                <p className={`type-meta-xs ${cards.cardHint}`}>{COPY.questionsHint}</p>
              ) : null}
            </div>
          </header>
          {!ready ? (
            <p className={`type-body-sm ${cards.empty}`}>{COPY.loading}</p>
          ) : readFailed ? (
            <div className={cards.missing} role="alert" data-state="application-unreadable">
              <p className="type-body-sm">{COPY.failed}</p>
              <button
                type="button"
                className={`weight-medium ${styles.textAction}`}
                onClick={reread}
                data-action="reread"
              >
                {COPY.retry}
              </button>
            </div>
          ) : editable ? (
            <DraftForm
              key={generation}
              venture={{
                id: venture.id,
                type: venture.type,
                status: venture.status,
                relation: venture.relation,
              }}
              programme={programme}
              application={application}
            />
          ) : (
            <Locked programme={programme} application={application} mismatch={mismatch} />
          )}
        </section>
      </DemoPage>
    </div>
  )
}

/** Not editable: submitted, not eligible, or a draft that no longer matches the questions. */
function Locked({
  programme,
  application,
  mismatch,
}: {
  programme: Programme
  application: DemoApplication | null
  mismatch: boolean
}) {
  const reason =
    application?.status === 'SUBMITTED'
      ? COPY.submitted
      : mismatch
        ? COPY.mismatch
        : !programme.eligibility.eligible
          ? `${COPY.cannotApply}: ${S02_COPY.ineligible[programme.eligibility.reason]}`
          : ''
  const answers = application?.programme_specific_answers ?? []
  return (
    <div className={cards.cardBody}>
      <p className={`type-body-sm ${cards.meta}`} data-state="application-locked">
        {reason}
      </p>
      {application?.status === 'SUBMITTED' ? (
        <p className="type-body-sm">
          <Link
            href={projectDemoRoutes.review(application.primary_applicant_id, programme.id)}
            className={`weight-medium ${styles.textAction}`}
            data-nav="application-view-submitted"
          >
            {COPY.viewSubmitted}
          </Link>
        </p>
      ) : null}
      {application ? (
        <ol className={`type-body-sm ${styles.summary}`} data-answers>
          {programme.questions.map((q, i) => (
            <li key={i} data-answer={i}>
              <span className="weight-semibold">{q}</span> — {answers[i]?.trim() || '—'}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}

function DraftForm({
  venture,
  programme,
  application,
}: {
  venture: VentureContext
  programme: Programme
  application: DemoApplication | null
}) {
  const { mutate } = useProjectDemo()
  const router = useRouter()
  const [answers, setAnswers] = useState<string[]>(
    () => application?.programme_specific_answers ?? programme.questions.map(() => ''),
  )
  const [tooLong, setTooLong] = useState<number[]>([])
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
  const inFlight = useRef(false)

  const update = (index: number, value: string) => {
    setAnswers((current) => current.map((a, i) => (i === index ? value : a)))
    setTooLong((current) => current.filter((i) => i !== index))
    setStatus('idle')
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null
    const review = submitter?.dataset.intent === 'review'
    if (inFlight.current) return
    const invalid = answersTooLong(answers)
    if (invalid.length > 0) {
      setTooLong(invalid)
      setStatus('idle')
      return
    }
    inFlight.current = true
    setStatus('saving')
    const result = mutate((s) => saveDraft(s, venture, programme, answers, new Date()))
    inFlight.current = false
    setStatus(result.ok ? 'saved' : 'failed')
    if (result.ok && review) router.push(projectDemoRoutes.review(venture.id, programme.id))
  }

  return (
    <form
      id="application-form"
      className={`${form.form} ${cards.editor}`}
      onSubmit={save}
      noValidate
      data-application-form
    >
      {status === 'saved' ? (
        <div className={form.notice} data-state="draft-saved" role="status">
          <Notice>{COPY.saved}</Notice>
        </div>
      ) : status === 'failed' ? (
        <div className={form.notice} role="alert" data-state="draft-failed">
          <Notice tone="error">{COPY.saveFailed}</Notice>
        </div>
      ) : null}
      {programme.questions.length === 0 ? (
        <p className="type-body-sm" data-state="no-questions">
          {COPY.noQuestions}
        </p>
      ) : (
        programme.questions.map((question, i) => (
          <div key={i} className={form.field} data-question={i}>
            <label htmlFor={`answer-${i}`} className={`type-body-sm weight-semibold ${form.label}`}>
              {COPY.question(i + 1)}
            </label>
            <p className={`type-body-sm ${form.hint} ${styles.name}`} id={`answer-${i}-question`}>
              {question}
            </p>
            <textarea
              id={`answer-${i}`}
              className={`ui-input ${form.textarea}`}
              rows={4}
              value={answers[i] ?? ''}
              aria-describedby={`answer-${i}-question`}
              aria-invalid={tooLong.includes(i) || undefined}
              onChange={(e) => update(i, e.target.value)}
            />
            {tooLong.includes(i) ? (
              <p className={`type-meta-xs ${form.error}`} role="alert" data-error={`answer-${i}`}>
                {COPY.tooLong(DEMO_ANSWER_MAX)}
              </p>
            ) : null}
          </div>
        ))
      )}
      <div className={styles.formActions}>
        <button
          type="submit"
          className={`weight-medium ${buttons.primary}`}
          disabled={status === 'saving'}
          aria-busy={status === 'saving' || undefined}
          data-action="save-draft"
        >
          {status === 'saving' ? COPY.saving : COPY.save}
        </button>
      </div>
    </form>
  )
}
