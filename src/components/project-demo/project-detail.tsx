'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import buttons from '@/components/programme-demo/demo-buttons.module.css'
import { DemoPage } from '@/components/programme-demo/demo-page'
import cards from '@/components/programme-demo/journey.module.css'
import pill from '@/components/programme-demo/status-pill.module.css'
import { signInAgain } from '@/components/application/session'
import { APPLICATION_COPY } from '@/lib/application/copy'
import { APPLICANT_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatDemoDateRange } from '@/lib/programme-demo/format'
import type { ApplicantType } from '@/lib/programme-demo/types'
import {
  relationLabel,
  S01_COPY,
  S02_COPY as COPY,
  VENTURE_STATUS_LABEL,
  VENTURE_TYPE_LABEL,
} from '@/lib/project-demo/copy'
import { applicationRoutes } from '@/lib/application/routes'
import type { ApplicationSummaryDTO } from '@/lib/application/types'
import { projectDemoRoutes } from '@/lib/project-demo/routes'
import type { DemoVentureDetailDTO } from '@/lib/project-demo/types'

import styles from './project-list.module.css'

/**
 * WF05-S02 — one Project / Startup and its participation (DEC-WF05-G1..G5,
 * INTENTIONAL-DEMO composition: the WF04 demo frame, detail rows and card
 * chrome, the WF02 venture wording). One read, `GET /api/v1/demo/projects/{id}`:
 * the canonical WF02 venture (owner or ACTIVE member), its team (owner +
 * ACTIVE members), and the PUBLISHED programmes with this actor's eligibility.
 * Read only: editing stays on WF02 ("Sửa hồ sơ", "Xem đội"); the eligible owner
 * opens the L5 application form with "Đăng ký", resumes a DRAFT with "Tiếp
 * tục" or views a SUBMITTED one; the status is the server application's
 * (`GET /api/v1/me/applications`, TASK 24.4 / DEC-L5-D4).
 *
 * WF05-PROD-04: a draft that can no longer be submitted (ineligible, or its
 * programme closed) opens read only with "Xem đơn"; an application to a
 * programme no longer open stays listed (G25); a `401` signs in again.
 */

type Load =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'missing' }
  | { kind: 'ready'; data: DemoVentureDetailDTO; applications: ApplicationSummaryDTO[] }

export function ProjectDemoDetail({ id }: { id: string }) {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const fetchDetail = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      const [response, mine] = await Promise.all([
        fetch(`/api/v1/demo/projects/${encodeURIComponent(id)}`, { cache: 'no-store' }),
        fetch('/api/v1/me/applications', { cache: 'no-store' }),
      ])
      if (response.status === 401 || mine.status === 401) return signInAgain()
      if (response.status === 404) return setLoad({ kind: 'missing' })
      if (!response.ok || !mine.ok) throw new Error(String(response.status))
      setLoad({
        kind: 'ready',
        data: (await response.json()) as DemoVentureDetailDTO,
        applications: ((await mine.json()) as { items: ApplicationSummaryDTO[] }).items,
      })
    } catch {
      setLoad({ kind: 'failed' })
    }
  }, [id])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  const back = (
    <Link
      href={projectDemoRoutes.list()}
      className={`weight-medium ${buttons.secondary}`}
      data-nav="detail-back"
    >
      {COPY.back}
    </Link>
  )

  if (load.kind !== 'ready') {
    return (
      <div data-screen="WF05-S02">
        <DemoPage title={load.kind === 'loading' ? COPY.loading : S01_COPY.title} actions={back}>
          {load.kind === 'loading' ? (
            <p className="type-body-sm" data-state="venture-loading" aria-busy="true">
              {COPY.loading}
            </p>
          ) : load.kind === 'missing' ? (
            <div className={cards.missing} data-state="venture-missing">
              <p className="type-body-sm">{COPY.missing}</p>
            </div>
          ) : (
            <div className={cards.missing} role="alert" data-state="venture-failed">
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

  const { venture, team, programmes } = load.data
  const mine = load.applications.filter((a) => a.venture.id === venture.id)
  // Applications to a programme no longer open: still listed, read only (G25).
  const closed = mine.filter((a) => !programmes.some((p) => p.id === a.programme.id))
  return (
    <div data-screen="WF05-S02" data-venture-type={venture.type} data-relation={venture.relation}>
      <DemoPage
        title={venture.name}
        meta={`${VENTURE_TYPE_LABEL[venture.type] ?? venture.type} · ${relationLabel(venture.relation, null)}`}
        actions={
          <div className={buttons.group}>
            {back}
            {venture.can_edit ? (
              <Link
                href={`/projects/${encodeURIComponent(venture.id)}/edit`}
                className={`weight-medium ${buttons.primary}`}
                data-nav="venture-edit"
              >
                {COPY.edit}
              </Link>
            ) : null}
          </div>
        }
      >
        {venture.status === 'ARCHIVED' ? (
          <div className={cards.status} data-state="venture-archived">
            <p className={`type-body-sm ${cards.statusText}`}>{COPY.archived}</p>
          </div>
        ) : null}

        <section className={cards.card} aria-labelledby="venture-overview" data-detail="overview">
          <header className={cards.cardHead}>
            <h2 id="venture-overview" className={`weight-semibold ${cards.cardTitle}`}>
              {COPY.overview}
            </h2>
          </header>
          {(
            [
              ['type', COPY.type, VENTURE_TYPE_LABEL[venture.type] ?? venture.type],
              ['status', COPY.status, VENTURE_STATUS_LABEL[venture.status] ?? venture.status],
              ['summary', COPY.summary, venture.summary ?? COPY.none],
              ['region', COPY.region, venture.region?.label ?? COPY.none],
              [
                'domains',
                COPY.domains,
                venture.domains.length > 0
                  ? venture.domains.map((d) => d.label).join(', ')
                  : COPY.none,
              ],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className={cards.reviewRow} data-overview={key}>
              <p className={`type-body-sm weight-semibold ${cards.reviewLabel}`}>{label}</p>
              <p className={`type-body-sm ${cards.reviewValue}`}>{value}</p>
              <span />
            </div>
          ))}
        </section>

        <section className={cards.card} aria-labelledby="venture-team" data-detail="team">
          <header className={cards.cardHead}>
            <div>
              <h2 id="venture-team" className={`weight-semibold ${cards.cardTitle}`}>
                {COPY.team}
              </h2>
              <p className={`type-meta-xs ${cards.cardHint}`} data-team-count>
                {COPY.members(team.members)}
              </p>
            </div>
            <Link
              href={`/projects/${encodeURIComponent(venture.id)}/team`}
              className={`weight-medium ${styles.textAction}`}
              data-nav="venture-team"
            >
              {COPY.teamLink}
            </Link>
          </header>
          <ul className={cards.list}>
            {team.rows.map((row, i) => (
              <li key={i} className={cards.item} data-team-row={row.relation}>
                <p className={`type-body-sm ${styles.name}`}>
                  {row.display_name}
                  <span className={cards.cardMeta}>
                    {' · '}
                    {relationLabel(row.relation, row.role_label)}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          className={cards.card}
          aria-labelledby="venture-programmes"
          data-detail="programmes"
        >
          <header className={cards.cardHead}>
            <div>
              <h2 id="venture-programmes" className={`weight-semibold ${cards.cardTitle}`}>
                {COPY.programmesTitle}
              </h2>
              <p className={`type-meta-xs ${cards.cardHint}`}>{COPY.programmesHint}</p>
            </div>
          </header>
          {programmes.length === 0 && closed.length === 0 ? (
            <p className={`type-body-sm ${cards.empty}`} data-state="programmes-empty">
              {COPY.programmesEmpty}
            </p>
          ) : (
            <ul className={cards.list}>
              {programmes.map((p) => (
                <ParticipationRow
                  key={p.id}
                  ventureId={venture.id}
                  programme={p}
                  application={mine.find((a) => a.programme.id === p.id) ?? null}
                />
              ))}
              {closed.map((a) => (
                <ClosedRow key={a.id} ventureId={venture.id} application={a} />
              ))}
            </ul>
          )}
        </section>
      </DemoPage>
    </div>
  )
}

function ParticipationRow({
  ventureId,
  programme,
  application,
}: {
  ventureId: string
  programme: DemoVentureDetailDTO['programmes'][number]
  application: ApplicationSummaryDTO | null
}) {
  const { eligibility } = programme
  return (
    <li
      className={`${cards.item} ${styles.row}`}
      data-programme={programme.id}
      data-programme-type={programme.type}
      data-eligible={String(eligibility.eligible)}
    >
      <div className={styles.text}>
        <p className={`type-meta-xs ${cards.meta}`} data-programme-kind>
          {TYPE_LABEL[programme.type]} · {programme.organization.name}
        </p>
        <p className={`type-body-md weight-medium ${styles.name}`}>{programme.name}</p>
        <p className={`type-meta-xs ${cards.meta}`} data-programme-meta>
          {formatDemoDateRange(programme.starts_at, programme.ends_at)} · {COPY.applicantTypes}:{' '}
          {programme.applicant_types
            .map((t) => APPLICANT_LABEL[t as ApplicantType] ?? t)
            .join(', ')}
        </p>
        {!eligibility.eligible && application?.status !== 'SUBMITTED' ? (
          <p className={`type-meta-xs ${cards.meta}`} data-ineligible={eligibility.reason}>
            {COPY.ineligible[eligibility.reason]}
          </p>
        ) : null}
      </div>
      {application ? (
        <div className={buttons.group}>
          <span className={`weight-medium ${pill.pill}`} data-application={application.status}>
            {APPLICATION_COPY.status[application.status]}
          </span>
          {application.status === 'DRAFT' && eligibility.eligible ? (
            <Link
              href={applicationRoutes.form(ventureId, programme.id)}
              className={`weight-medium ${styles.textAction}`}
              data-nav="application-resume"
            >
              {COPY.resume}
            </Link>
          ) : (
            <ViewLink ventureId={ventureId} application={application} />
          )}
        </div>
      ) : eligibility.eligible ? (
        // TASK 24.4: the eligible owner opens the L5 form; the draft is created on the first save.
        <Link
          href={applicationRoutes.form(ventureId, programme.id)}
          className={`weight-medium ${buttons.secondary}`}
          data-action="apply"
        >
          {COPY.apply}
        </Link>
      ) : null}
    </li>
  )
}

/** "Xem đơn": a submitted application's SUB3, or a draft's form, read only. */
function ViewLink({
  ventureId,
  application,
}: {
  ventureId: string
  application: ApplicationSummaryDTO
}) {
  const { programme } = application
  return (
    <Link
      href={
        application.status === 'SUBMITTED'
          ? applicationRoutes.submitted(ventureId, programme.id)
          : applicationRoutes.form(ventureId, programme.id)
      }
      className={`weight-medium ${styles.textAction}`}
      data-nav="application-view"
    >
      {COPY.view}
    </Link>
  )
}

/** This venture's application to a programme no longer open: read only (WF05-PROD-04, G25). */
function ClosedRow({
  ventureId,
  application,
}: {
  ventureId: string
  application: ApplicationSummaryDTO
}) {
  return (
    <li
      className={`${cards.item} ${styles.row}`}
      data-programme={application.programme.id}
      data-programme-status={application.programme.status}
    >
      <div className={styles.text}>
        <p className={`type-body-md weight-medium ${styles.name}`}>{application.programme.name}</p>
        <p className={`type-meta-xs ${cards.meta}`} data-programme-closed>
          {COPY.closed}
        </p>
      </div>
      <div className={buttons.group}>
        <span className={`weight-medium ${pill.pill}`} data-application={application.status}>
          {APPLICATION_COPY.status[application.status]}
        </span>
        <ViewLink ventureId={ventureId} application={application} />
      </div>
    </li>
  )
}
