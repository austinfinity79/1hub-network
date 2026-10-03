'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'
import { APPLICATION_COPY as COPY } from '@/lib/application/copy'
import { applicationRoutes, type ApplicationOrigin } from '@/lib/application/routes'
import type {
  ApplicationDTO,
  ApplicationLockReason,
  ApplicationProgramme,
  ApplicationQuestion,
  ApplicationTeamMember,
  FormStep,
} from '@/lib/application/types'
import { ANSWER_MAX_LENGTH } from '@/lib/application/types'

import styles from './application.module.css'
import { formatTime } from './format'
import { signInAgain } from './session'

/**
 * TASK 24.4 — SUB1, the application form (L38–L41, DEC-L5-D1/D4). The
 * programme's configured questions laid across the drawn steps; step 3 shows
 * the venture team read only; a step with nothing to show is skipped.
 *
 * The application is created on the first save (idempotent POST), then every
 * save PATCHes the same id: on leaving a field, every 20 seconds while there
 * are changes, and before changing step. Nothing is kept in the browser.
 *
 * WF05-PROD-04: the first words typed start that first save, so a page hide
 * can flush the rest (keepalive PATCH); a failed save offers "Thử lại"; the
 * server's verdict locks the form (`editable` / `reason`: a closed programme,
 * an archived venture), read only with its reason; a `401` signs in again and
 * comes back; a submitted application opens SUB3.
 */

const AUTOSAVE_MS = 20_000

type Eligibility =
  | { eligible: true }
  | { eligible: false; reason: 'NOT_PUBLISHED' | 'ARCHIVED' | 'TYPE_NOT_ACCEPTED' }

export function ApplicationForm({
  ventureId,
  programme,
  questions,
  team,
  application,
  eligibility,
  initialStep,
  from,
  backHref,
}: {
  ventureId: string
  programme: ApplicationProgramme
  questions: ApplicationQuestion[]
  team: ApplicationTeamMember[]
  application: ApplicationDTO | null
  eligibility: Eligibility
  initialStep: FormStep | null
  from: ApplicationOrigin | null
  backHref: string
}) {
  const router = useRouter()
  const steps = useMemo(
    () =>
      ([1, 2, 3, 4] as FormStep[]).filter((s) => s === 3 || questions.some((q) => q.step === s)),
    [questions],
  )
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries((application?.answers ?? []).map((a) => [a.question_id, a.value])),
  )
  const missing = questions.filter((q) => q.required && !answers[q.id]?.trim())
  // Resume on the first step with an unanswered required question (autosave note).
  const [step, setStep] = useState<FormStep>(() => {
    if (initialStep && steps.includes(initialStep)) return initialStep
    const open = steps.find((s) =>
      questions.some((q) => q.step === s && q.required && !answers[q.id]?.trim()),
    )
    return application && open ? open : steps[0]!
  })
  const [savedAt, setSavedAt] = useState<string | null>(application?.updated_at ?? null)
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle')
  const id = useRef<string | null>(application?.id ?? null)
  const createKey = useRef<string | null>(null)
  const dirty = useRef(false)
  const started = useRef(false)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const latest = useRef(answers)
  latest.current = answers
  const lockReason: ApplicationLockReason | 'TYPE_NOT_ACCEPTED' | null =
    application && !application.editable
      ? application.reason
      : eligibility.eligible
        ? null
        : eligibility.reason
  const locked = lockReason !== null

  const ensure = useCallback(async (): Promise<string> => {
    if (id.current) return id.current
    createKey.current ??= crypto.randomUUID()
    try {
      const created = await apiRequest<ApplicationDTO>('/applications', {
        method: 'POST',
        body: { venture_id: ventureId, programme_id: programme.id },
        idempotencyKey: createKey.current,
      })
      id.current = created.id
    } catch (caught) {
      const error = caught as { code?: string; fields?: Record<string, string> }
      if (error.code !== 'APPLICATION_EXISTS' || !error.fields?.application_id) throw caught
      id.current = error.fields.application_id
    }
    return id.current
  }, [ventureId, programme.id])

  const body = useCallback(
    () => ({
      answers: questions.map((q) => ({ question_id: q.id, value: latest.current[q.id] ?? '' })),
    }),
    [questions],
  )

  /** The server refused: sign in again, the submitted view, or the page re-read (read only or 404). */
  const refused = useCallback(
    (caught: unknown) => {
      if (!isApiError(caught)) return
      if (caught.status === 401) signInAgain()
      else if (caught.code === 'APPLICATION_SUBMITTED')
        router.replace(applicationRoutes.submitted(ventureId, programme.id))
      else if (caught.status === 403 || caught.status === 404 || caught.status === 409)
        router.refresh()
    },
    [router, ventureId, programme.id],
  )

  const save = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) await inFlight.current
    if (!dirty.current && id.current) return true
    const run = (async () => {
      setState('saving')
      try {
        const target = await ensure()
        dirty.current = false
        const saved = await apiRequest<ApplicationDTO>(`/applications/${target}`, {
          method: 'PATCH',
          body: body(),
        })
        setSavedAt(saved.updated_at)
        setState('idle')
        return true
      } catch (caught) {
        dirty.current = true
        setState('failed')
        refused(caught)
        return false
      }
    })()
    inFlight.current = run
    const ok = await run
    inFlight.current = null
    return ok
  }, [ensure, body, refused])

  useEffect(() => {
    if (locked) return
    const timer = window.setInterval(() => {
      if (dirty.current) void save()
    }, AUTOSAVE_MS)
    return () => window.clearInterval(timer)
  }, [locked, save])

  // Unsaved typing leaves with the page (WF05 contract: flushed on page hide).
  useEffect(() => {
    if (locked) return
    const flush = () => {
      if (!dirty.current || !id.current) return
      dirty.current = false
      apiRequest<ApplicationDTO>(`/applications/${id.current}`, {
        method: 'PATCH',
        body: body(),
        keepalive: true,
      })
        .then((saved) => setSavedAt(saved.updated_at))
        .catch(() => {
          dirty.current = true
        })
    }
    const hidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', hidden)
    }
  }, [locked, body])

  const go = async (next: FormStep) => {
    if (!locked && !(await save())) return
    setStep(next)
    router.replace(applicationRoutes.form(ventureId, programme.id, next, from), { scroll: true })
  }
  const toReview = async () => {
    if (!(await save())) return
    router.push(applicationRoutes.review(ventureId, programme.id))
  }

  const index = steps.indexOf(step)
  const prev = steps[index - 1]
  const next = steps[index + 1]
  const stepQuestions = questions.filter((q) => q.step === step)

  const status =
    state === 'saving'
      ? COPY.saving
      : state === 'failed'
        ? COPY.saveFailed
        : savedAt
          ? COPY.savedAt(formatTime(savedAt))
          : COPY.notSaved

  return (
    <div className={styles.page} data-screen="L5-SUB1" data-step={step}>
      <header className={styles.bar}>
        <div>
          <p className={styles.barTitle}>{COPY.barTitle(programme.name)}</p>
          <p className={styles.barSub} data-save-state={state}>
            {status}
            {state === 'failed' && !locked ? (
              <>
                {' '}
                <button
                  type="button"
                  className={styles.retry}
                  onClick={() => void save()}
                  data-action="save-retry"
                >
                  {COPY.retry}
                </button>
              </>
            ) : null}
          </p>
        </div>
        <span className={styles.pill} data-anchor="remaining">
          {locked ? COPY.readOnly : missing.length ? COPY.remaining(missing.length) : COPY.ready}
        </span>
      </header>

      <div className={styles.body}>
        <ol className={styles.steps} aria-label="Các bước">
          {steps.map((s) => (
            <li
              key={s}
              className={styles.step}
              data-state={s === step ? 'current' : steps.indexOf(s) < index ? 'done' : 'todo'}
              aria-current={s === step ? 'step' : undefined}
            >
              {COPY.steps[s]}
            </li>
          ))}
        </ol>

        <div className={styles.grid}>
          <main>
            <div className={styles.head}>
              <div>
                <h1 className={styles.title}>{COPY.steps[step]}</h1>
                <p className={styles.lead}>
                  {step === 3
                    ? COPY.teamLead
                    : COPY.stepLead(programme.name, programme.organization.name)}
                </p>
              </div>
            </div>

            {lockReason ? (
              <p className={styles.alert} role="status" data-ineligible={lockReason}>
                {COPY.ineligible[lockReason]}
              </p>
            ) : null}

            {stepQuestions.map((q) => {
              const value = answers[q.id] ?? ''
              const inputId = `q-${q.id}`
              return (
                <div key={q.id} className={styles.field}>
                  <label className={styles.fieldLabel} htmlFor={inputId}>
                    {q.prompt}
                    {q.required ? <span className={styles.required}>{COPY.required}</span> : null}
                  </label>
                  <p className={styles.help}>{COPY.answerHelp}</p>
                  <textarea
                    id={inputId}
                    className={styles.textarea}
                    value={value}
                    maxLength={ANSWER_MAX_LENGTH}
                    disabled={locked}
                    onChange={(e) => {
                      dirty.current = true
                      setAnswers((all) => ({ ...all, [q.id]: e.target.value }))
                      // The first words start the first save once (the draft gets its id).
                      if (!id.current && !started.current) {
                        started.current = true
                        void save()
                      }
                    }}
                    onBlur={() => {
                      if (dirty.current) void save()
                    }}
                  />
                </div>
              )
            })}

            {step === 3 ? <p className={styles.note}>{COPY.teamNote}</p> : null}

            <div className={styles.actions}>
              {prev ? (
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => go(prev)}
                  data-action="prev"
                >
                  {COPY.backStep(steps.indexOf(prev) + 1)}
                </button>
              ) : (
                <Link href={backHref} className={styles.secondary} data-nav="application-back">
                  {COPY.back}
                </Link>
              )}
              {next ? (
                <button
                  type="button"
                  className={styles.primary}
                  // Not disabled while saving: the blur that starts a save comes before
                  // this click, and a disabled button would drop it. go() waits.
                  onClick={() => go(next)}
                  data-action="next"
                >
                  {COPY.next(COPY.steps[next])}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.primary}
                  onClick={toReview}
                  disabled={locked}
                  data-action="to-review"
                >
                  {COPY.toReview}
                </button>
              )}
            </div>
          </main>

          <aside className={styles.side}>
            {step === 3 ? (
              <section className={styles.card} data-anchor="team">
                <p className={styles.label}>{COPY.teamLabel}</p>
                <ul className={styles.team}>
                  {team.map((m, i) => (
                    <li key={`${m.display_name}-${i}`}>
                      <span className={styles.avatar} aria-hidden="true" />
                      <span className={styles.teamText}>
                        <span className={styles.teamName}>{m.display_name}</span>
                        {m.role_label ? (
                          <span className={styles.teamRole}>{m.role_label}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link href={`/projects/${ventureId}/team`} className={styles.cardAction}>
                  {COPY.inviteMore}
                </Link>
              </section>
            ) : (
              <section className={styles.card} data-anchor="progress">
                <p className={styles.label}>{COPY.progressLabel}</p>
                <ol className={styles.progress}>
                  {steps.map((s, i) => {
                    const answered = questions
                      .filter((q) => q.step === s && q.required)
                      .every((q) => answers[q.id]?.trim())
                    const st =
                      s === step ? 'current' : answered && (s !== 3 || i < index) ? 'done' : 'todo'
                    return (
                      <li key={s} data-state={st}>
                        <span>
                          0{i + 1} · {COPY.steps[s]}
                        </span>
                        <span className={styles.progressState}>{COPY.progress[st]}</span>
                      </li>
                    )
                  })}
                </ol>
              </section>
            )}
            {/* A read-only draft is never saved: no autosave promise (WF05-PROD-04). */}
            {locked ? null : (
              <section className={styles.cardPink} data-anchor="autosave">
                <p className={styles.label}>{COPY.autosaveLabel}</p>
                <p className={styles.cardText}>{COPY.autosaveText}</p>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
