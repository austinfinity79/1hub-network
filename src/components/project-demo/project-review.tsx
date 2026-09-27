'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import buttons from '@/components/programme-demo/demo-buttons.module.css'
import { DemoPage } from '@/components/programme-demo/demo-page'
import cards from '@/components/programme-demo/journey.module.css'
import pill from '@/components/programme-demo/status-pill.module.css'
import { Notice } from '@/components/ui'
import { APPLICANT_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatDemoDate, formatDemoDateRange } from '@/lib/programme-demo/format'
import {
  answersTooLong,
  applicationOf,
  submitApplication,
} from '@/lib/project-demo/application-store'
import { S04_COPY as COPY, VENTURE_TYPE_LABEL } from '@/lib/project-demo/copy'
import { projectDemoRoutes } from '@/lib/project-demo/routes'
import type { DemoApplication, DemoVentureDetailDTO } from '@/lib/project-demo/types'

import { useProjectDemo } from './demo-store'
import styles from './project-list.module.css'

/**
 * WF05-S04 — review + submit (DEC-WF05-G5; INTENTIONAL-DEMO composition: the
 * WF04 frame, card chrome and S07 checklist). Venture and programme are read
 * live from `GET /api/v1/demo/projects/{id}`; the answers come from the
 * actor's browser-session application. The checklist is exactly the G5 rules
 * (owner, not archived, type taken, every question answered within the
 * technical bound); "Nộp đơn" re-reads the venture and programme (a page
 * loaded earlier never submits stale state), then performs the only
 * transition, DRAFT → SUBMITTED, atomically in the session store. SUBMITTED is
 * final and read only (HC-WF05-08: the page stays, read only). No application
 * → nothing is created here.
 */

type Programme = DemoVentureDetailDTO['programmes'][number]
type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'missing' }
  | { kind: 'ready'; data: DemoVentureDetailDTO; programme: Programme }

export function ProjectDemoReview({
  ventureId,
  programmeId,
}: {
  ventureId: string
  programmeId: string
}) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  /** `quiet` (the submit-time re-read) keeps the page on a transient failure. */
  const fetchDetail = useCallback(
    async (quiet = false): Promise<Load> => {
      if (!quiet) setLoad({ kind: 'loading' })
      let next: Load
      try {
        const response = await fetch(`/api/v1/demo/projects/${encodeURIComponent(ventureId)}`, {
          cache: 'no-store',
        })
        if (response.status === 404) next = { kind: 'missing' }
        else if (!response.ok) throw new Error(String(response.status))
        else {
          const data = (await response.json()) as DemoVentureDetailDTO
          const programme = data.programmes.find((p) => p.id === programmeId)
          next = programme ? { kind: 'ready', data, programme } : { kind: 'missing' }
        }
      } catch {
        next = { kind: 'failed' }
      }
      if (!quiet || next.kind !== 'failed') setLoad(next)
      return next
    },
    [ventureId, programmeId],
  )

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  if (load.kind !== 'ready') {
    return (
      <div data-screen="WF05-S04">
        <DemoPage
          title={load.kind === 'loading' ? COPY.loading : ''}
          actions={
            <Link
              href={projectDemoRoutes.detail(ventureId)}
              className={`weight-medium ${buttons.secondary}`}
              data-nav="review-back"
            >
              {COPY.back}
            </Link>
          }
        >
          {load.kind === 'loading' ? (
            <p className="type-body-sm" data-state="review-loading" aria-busy="true">
              {COPY.loading}
            </p>
          ) : load.kind === 'missing' ? (
            <div className={cards.missing} data-state="review-missing">
              <p className="type-body-sm">{COPY.missing}</p>
            </div>
          ) : (
            <div className={cards.missing} role="alert" data-state="review-failed">
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
  return <Review data={load.data} programme={load.programme} refresh={() => fetchDetail(true)} />
}

function Review({
  data,
  programme,
  refresh,
}: {
  data: DemoVentureDetailDTO
  programme: Programme
  refresh: () => Promise<Load>
}) {
  const { state, ready, readFailed, reread, mutate } = useProjectDemo()
  const [failure, setFailure] = useState<'refused' | 'failed' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const { venture } = data
  const application = ready && !readFailed ? applicationOf(state, venture.id, programme.id) : null
  const submitted = application?.status === 'SUBMITTED'
  const toVenture = projectDemoRoutes.detail(venture.id)
  const toDraft = projectDemoRoutes.application(venture.id, programme.id)

  // Back to S03 only while the draft is still the owner's to edit.
  const actions =
    application && !submitted && programme.eligibility.eligible ? (
      <Link href={toDraft} className={`weight-medium ${buttons.secondary}`} data-nav="review-edit">
        {COPY.edit}
      </Link>
    ) : (
      <Link
        href={toVenture}
        className={`weight-medium ${buttons.secondary}`}
        data-nav="review-back"
      >
        {COPY.back}
      </Link>
    )

  async function submit() {
    if (inFlight.current || !application || submitted) return
    inFlight.current = true
    setSubmitting(true)
    setFailure(null)
    // The rules run on the venture and programme as they are now, not as loaded.
    const fresh = await refresh()
    if (fresh.kind !== 'ready') {
      // Not found replaces the page; a transient failure keeps it for a retry.
      inFlight.current = false
      setSubmitting(false)
      setFailure('failed')
      return
    }
    const { venture: now } = fresh.data
    const result = mutate((s) =>
      submitApplication(
        s,
        { id: now.id, type: now.type, status: now.status, relation: now.relation },
        fresh.programme,
        new Date(),
      ),
    )
    setSubmitting(false)
    if (result.ok) return // SUBMITTED: final, so the guard stays set.
    inFlight.current = false
    setFailure(result.reason === 'STORAGE' ? 'failed' : 'refused')
    // A refusal means the stored application is not the one shown: show the stored one.
    reread()
  }

  return (
    <div data-screen="WF05-S04" data-application-state={application?.status ?? 'NONE'}>
      <DemoPage
        title={COPY.title(programme.name)}
        meta={`${venture.name}${application ? ` · ${submitted ? 'Đã nộp' : 'Bản nháp'}` : ''}`}
        actions={actions}
      >
        {!ready ? (
          <p className="type-body-sm" data-state="review-loading">
            {COPY.loading}
          </p>
        ) : readFailed ? (
          <div className={cards.missing} role="alert" data-state="review-unreadable">
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
        ) : !application ? (
          <div className={cards.missing} data-state="review-no-application">
            <p className="type-body-sm">{COPY.noApplication}</p>
            {programme.eligibility.eligible ? (
              <Link
                href={toDraft}
                className={`weight-medium ${styles.textAction}`}
                data-nav="review-start"
              >
                {COPY.start}
              </Link>
            ) : null}
          </div>
        ) : (
          <>
            {submitted ? (
              <div className={cards.saved} data-state="review-submitted" role="status">
                <Notice>{COPY.submitted}</Notice>
              </div>
            ) : null}
            <Summary data={data} programme={programme} application={application} />
            {submitted ? (
              <section className={cards.card} data-section="submitted">
                <div className={cards.publish} data-publish-state="submitted">
                  <p className={`type-body-sm ${cards.publishText}`}>
                    <span className={`weight-medium ${pill.pill}`} data-application="SUBMITTED">
                      Đã nộp
                    </span>{' '}
                    {application.submitted_at
                      ? COPY.submittedOn(formatDemoDate(application.submitted_at) ?? '')
                      : null}
                  </p>
                </div>
              </section>
            ) : (
              <Checklist
                data={data}
                programme={programme}
                application={application}
                failure={failure}
                submitting={submitting}
                onSubmit={() => void submit()}
              />
            )}
          </>
        )}
      </DemoPage>
    </div>
  )
}

function Summary({
  data,
  programme,
  application,
}: {
  data: DemoVentureDetailDTO
  programme: Programme
  application: DemoApplication
}) {
  const { venture } = data
  const answers = application.programme_specific_answers
  const rows: [string, string, React.ReactNode][] = [
    [
      'venture',
      COPY.venture,
      <>
        <p className={`type-body-sm ${cards.reviewValue}`} data-review-venture>
          {venture.name}
        </p>
        <p className={`type-meta-xs ${cards.meta}`} data-review-applicant>
          {VENTURE_TYPE_LABEL[venture.type] ?? venture.type} · {COPY.applicantAs}:{' '}
          {APPLICANT_LABEL[venture.applicant_type]}
        </p>
      </>,
    ],
    [
      'programme',
      COPY.programme,
      <>
        <p className={`type-body-sm ${cards.reviewValue}`} data-review-programme>
          {programme.name}
        </p>
        <p className={`type-meta-xs ${cards.meta}`}>
          {TYPE_LABEL[programme.type]} · {programme.organization.name} ·{' '}
          {formatDemoDateRange(programme.starts_at, programme.ends_at)}
        </p>
      </>,
    ],
  ]
  return (
    <section className={cards.card} aria-labelledby="review-summary" data-review-summary>
      {rows.map(([key, label, value]) => (
        <div key={key} className={cards.reviewRow} data-review={key}>
          <p className={`type-body-sm weight-semibold ${cards.reviewLabel}`}>{label}</p>
          <div className={cards.reviewValue}>{value}</div>
          <span />
        </div>
      ))}
      <div className={cards.reviewRow} data-review="answers">
        <p id="review-summary" className={`type-body-sm weight-semibold ${cards.reviewLabel}`}>
          {COPY.answers}
        </p>
        <ol className={`type-body-sm ${cards.reviewValue}`}>
          {programme.questions.map((question, i) => {
            const text = answers[i]?.trim() ?? ''
            return (
              <li key={i} data-review-answer={i} data-answered={String(text.length > 0)}>
                <span className="weight-semibold">{question}</span>
                <br />
                <span className={`${styles.name} ${text ? '' : cards.meta}`}>
                  {text || COPY.noAnswer}
                </span>
              </li>
            )
          })}
        </ol>
        <span />
      </div>
    </section>
  )
}

function Checklist({
  data,
  programme,
  application,
  failure,
  submitting,
  onSubmit,
}: {
  data: DemoVentureDetailDTO
  programme: Programme
  application: DemoApplication
  failure: 'refused' | 'failed' | null
  submitting: boolean
  onSubmit: () => void
}) {
  const { venture } = data
  const answers = application.programme_specific_answers
  const items: [keyof typeof COPY.items, boolean][] = [
    ['owner', venture.relation === 'OWNER'],
    ['active', venture.status !== 'ARCHIVED'],
    ['type', programme.applicant_types.includes(venture.applicant_type)],
    [
      'answers',
      answers.length === programme.questions.length &&
        answers.every((a) => a.trim().length > 0) &&
        answersTooLong(answers).length === 0,
    ],
  ]
  const missing = items.filter(([, ok]) => !ok).length
  return (
    <section className={cards.card} aria-labelledby="review-checklist" data-review-checklist>
      <header className={cards.cardHead}>
        <div>
          <h2 id="review-checklist" className={`weight-semibold ${cards.cardTitle}`}>
            {COPY.checklist}
          </h2>
          <p className={`type-meta-xs ${cards.cardHint}`} data-readiness>
            {missing === 0 ? COPY.ready : COPY.missingCount(missing)}
          </p>
        </div>
      </header>
      <ul className={cards.list} aria-label={COPY.checklist}>
        {items.map(([item, ok]) => (
          <li key={item} className={cards.checkItem} data-check={item} data-ok={String(ok)}>
            <span
              className={`type-body-sm weight-semibold ${cards.checkState} ${ok ? cards.checkPass : cards.checkMissing}`}
            >
              {ok ? COPY.pass : COPY.fail}
            </span>
            <p className={`type-body-sm ${cards.checkLabel}`}>{COPY.items[item]}</p>
          </li>
        ))}
      </ul>
      {failure ? (
        <div className={cards.saved} role="alert" data-state={`submit-${failure}`}>
          <Notice tone="error">
            {failure === 'failed' ? COPY.submitFailed : COPY.submitRefused}
          </Notice>
        </div>
      ) : null}
      <div className={cards.publish} data-publish-state={missing === 0 ? 'ready' : 'incomplete'}>
        <p className={`type-body-sm ${cards.publishText}`}>
          {missing === 0 ? COPY.submitHint : COPY.blocked}
        </p>
        <button
          type="button"
          className={`weight-medium ${buttons.primary}`}
          disabled={missing > 0 || submitting}
          aria-disabled={missing > 0 || submitting ? 'true' : undefined}
          aria-busy={submitting || undefined}
          title={missing > 0 ? COPY.blocked : undefined}
          onClick={onSubmit}
          data-action="submit"
        >
          {submitting ? COPY.submitting : COPY.submit}
        </button>
      </div>
    </section>
  )
}
