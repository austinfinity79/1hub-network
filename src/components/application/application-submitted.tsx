import Link from 'next/link'

import { APPLICATION_COPY as COPY } from '@/lib/application/copy'
import type { ApplicationDTO } from '@/lib/application/types'
import { projectDemoRoutes } from '@/lib/project-demo/routes'

import styles from './application.module.css'
import { formatDate, formatTime } from './format'

/**
 * TASK 24.4 — SUB3, submitted (L43, DEC-L5-D1/D4), read from the snapshot only.
 * Not drawn here (DEC-L5-D6): the application code, the e-mail line, the
 * timeline dates and the Future cards (chapter events, related problems).
 */
export function ApplicationSubmitted({
  application,
  ventureId,
}: {
  application: ApplicationDTO
  ventureId: string
}) {
  const at = application.submitted_at!
  return (
    <div className={styles.page} data-screen="L5-SUB3">
      <section className={styles.hero} data-anchor="hero">
        <span className={styles.heroMark} aria-hidden="true" />
        <h1 className={styles.heroTitle}>{COPY.doneTitle}</h1>
        <p className={styles.heroMeta}>
          {COPY.doneMeta(formatTime(at), formatDate(at))} · {application.programme.name}
        </p>
        <div className={styles.heroActions}>
          <a href="#ho-so-da-nop" className={styles.heroPrimary}>
            {COPY.viewSubmitted}
          </a>
          {/* WF05-PROD-04 (G24): the list that shows this application and its status. */}
          <Link href={projectDemoRoutes.list()} className={styles.heroSecondary}>
            {COPY.toMine}
          </Link>
        </div>
      </section>

      <section className={styles.section} data-anchor="waiting">
        <h2 className={styles.sectionSmall}>{COPY.waiting}</h2>
        <ul className={styles.cards}>
          <li className={styles.card}>
            <p className={styles.cardTitle}>{COPY.completeTeam}</p>
            <p className={styles.cardText}>{COPY.completeTeamText}</p>
            <Link href={`/projects/${ventureId}/edit`} className={styles.cardAction}>
              {COPY.complete}
            </Link>
          </li>
        </ul>
      </section>

      <section className={`${styles.section} ${styles.body}`} id="ho-so-da-nop">
        <h2 className={styles.sectionTitle}>{COPY.submittedSheet}</h2>
        <ol className={styles.answers}>
          {application.questions.map((q, i) => (
            <li key={q.id} className={styles.answer} data-question={q.id}>
              <p className={styles.answerHead}>
                <span>
                  Câu {i + 1} · {q.prompt}
                </span>
              </p>
              <p className={styles.answerText}>
                {application.answers.find((a) => a.question_id === q.id)?.value ?? ''}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
