'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { apiRequest } from '@/lib/api/client'
import { APPLICATION_COPY as COPY } from '@/lib/application/copy'
import { applicationRoutes } from '@/lib/application/routes'
import type { ApplicationDTO } from '@/lib/application/types'

import styles from './application.module.css'

/**
 * TASK 24.4 — SUB2, review and submit (L42, DEC-L5-D1/D4). Every answer with
 * its "Sửa" link, the venture that will be attached, one submit. The submit is
 * idempotent (one key per visit), so a double click sends one application; a
 * SUBMITTED application is final. Not drawn here (DEC-L5-D6): profile
 * completion, commitment checkboxes, "editable until the deadline".
 */
export function ApplicationReview({
  application,
  ventureId,
}: {
  application: ApplicationDTO
  ventureId: string
}) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'submitting' | 'failed'>('idle')
  const key = useRef<string | null>(null)
  const { programme, venture, questions, answers, missing } = application
  const ready = missing.length === 0
  const valueOf = (id: string) => answers.find((a) => a.question_id === id)?.value ?? ''

  const submit = async () => {
    if (!ready || state === 'submitting') return
    setState('submitting')
    key.current ??= crypto.randomUUID()
    try {
      await apiRequest(`/applications/${application.id}/submit`, {
        method: 'POST',
        idempotencyKey: key.current,
      })
      router.replace(applicationRoutes.submitted(ventureId, programme.id))
    } catch {
      setState('failed')
    }
  }

  return (
    <div className={styles.page} data-screen="L5-SUB2">
      <header className={styles.bar}>
        <div>
          <p className={styles.barTitle}>{COPY.reviewBar}</p>
          <p className={styles.barSub}>
            {programme.name} · {venture.name}
          </p>
        </div>
        <span className={`${styles.pill} ${styles.pillSmall}`} data-anchor="readiness">
          {ready ? COPY.ready : COPY.remaining(missing.length)}
        </span>
      </header>

      <div className={styles.body}>
        <div className={styles.reviewGrid}>
          <main>
            <h1 className={styles.reviewTitle}>{COPY.reviewSheet}</h1>
            <ol className={styles.answers}>
              {questions.map((q, i) => {
                const value = valueOf(q.id)
                return (
                  <li key={q.id} className={styles.answer} data-question={q.id}>
                    <p className={styles.answerHead}>
                      <span>
                        Câu {i + 1} · {q.prompt}
                      </span>
                      <Link
                        href={applicationRoutes.form(ventureId, programme.id, q.step)}
                        className={styles.answerEdit}
                      >
                        {COPY.edit}
                      </Link>
                    </p>
                    <p className={`${styles.answerText} ${value ? '' : styles.answerEmpty}`}>
                      {value || COPY.unanswered}
                    </p>
                  </li>
                )
              })}
            </ol>
          </main>

          <aside className={styles.side}>
            <h2 className={styles.reviewTitle}>{COPY.reviewAttached}</h2>
            <section className={styles.card} data-anchor="attached">
              <div className={styles.venture}>
                <span className={styles.ventureMark} aria-hidden="true">
                  {venture.name.slice(0, 2)}
                </span>
                <div>
                  <p className={styles.ventureName}>{venture.name}</p>
                  <p className={styles.ventureMeta}>
                    {[
                      COPY.types[venture.type],
                      venture.stage?.label,
                      COPY.members(application.team.length),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              <p className={styles.cardText}>{COPY.reviewSnapshot}</p>
            </section>
            {!ready ? (
              <p className={styles.alert} role="status">
                {COPY.incomplete}
              </p>
            ) : null}
            {state === 'failed' ? (
              <p className={styles.alert} role="alert">
                {COPY.submitFailed}
              </p>
            ) : null}
            <button
              type="button"
              className={`${styles.primary} ${styles.submit}`}
              onClick={submit}
              disabled={!ready || state === 'submitting'}
              data-action="submit"
            >
              {state === 'submitting' ? COPY.submitting : COPY.submit}
            </button>
            <p className={styles.after}>{COPY.final}</p>
          </aside>
        </div>
      </div>
    </div>
  )
}
