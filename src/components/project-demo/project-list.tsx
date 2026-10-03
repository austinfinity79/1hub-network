'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { DemoPage } from '@/components/programme-demo/demo-page'
import cards from '@/components/programme-demo/journey.module.css'
import { ProgrammeStatusPill } from '@/components/programme-demo/status-pill'
import pill from '@/components/programme-demo/status-pill.module.css'
import { signInAgain } from '@/components/application/session'
import { APPLICATION_COPY } from '@/lib/application/copy'
import { APPLICANT_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatDemoDateRange } from '@/lib/programme-demo/format'
import type { ApplicantType } from '@/lib/programme-demo/types'
import {
  relationLabel,
  S01_COPY as COPY,
  VENTURE_STATUS_LABEL,
  VENTURE_TYPE_LABEL,
} from '@/lib/project-demo/copy'
import { applicationRoutes } from '@/lib/application/routes'
import type { ApplicationSummaryDTO } from '@/lib/application/types'
import { projectDemoRoutes } from '@/lib/project-demo/routes'
import type {
  DemoVenturesDTO,
  DemoVentureSummaryDTO,
  OpenProgrammeDTO,
} from '@/lib/project-demo/types'

import styles from './project-list.module.css'

/**
 * WF05-S01 — my Projects / Startups and the open programmes (DEC-WF05-G1..G3,
 * INTENTIONAL-DEMO composition: the WF04 demo frame and card chrome, the WF02
 * venture wording). Two reads: `GET /api/v1/demo/projects` (the member's own
 * relations and the PUBLISHED programmes) and `GET /api/v1/me/applications`
 * (the server applications, TASK 24.4 / DEC-L5-D4). No edit; each venture row
 * opens its detail (S02); each programme opens the L5 entry ("Đăng ký").
 * WF05-PROD-04: each venture lists all its applications, a closed programme's
 * too (marked "đã đóng"; S02 opens them, G25); a `401` signs in again.
 */

type Data = DemoVenturesDTO & { applications: ApplicationSummaryDTO[] }
type Load = { kind: 'loading' } | { kind: 'failed' } | { kind: 'ready'; data: Data }

export function ProjectDemoList() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })

  const fetchList = useCallback(async () => {
    setLoad({ kind: 'loading' })
    try {
      const [list, mine] = await Promise.all([
        fetch('/api/v1/demo/projects', { cache: 'no-store' }),
        fetch('/api/v1/me/applications', { cache: 'no-store' }),
      ])
      if (list.status === 401 || mine.status === 401) return signInAgain()
      if (!list.ok || !mine.ok) throw new Error(String(list.ok ? mine.status : list.status))
      setLoad({
        kind: 'ready',
        data: {
          ...((await list.json()) as DemoVenturesDTO),
          applications: ((await mine.json()) as { items: ApplicationSummaryDTO[] }).items,
        },
      })
    } catch {
      setLoad({ kind: 'failed' })
    }
  }, [])

  useEffect(() => {
    void fetchList()
  }, [fetchList])

  return (
    <div data-screen="WF05-S01">
      <DemoPage title={COPY.title} meta={COPY.meta}>
        {load.kind === 'failed' ? (
          <div className={cards.missing} role="alert" data-state="projects-failed">
            <p className="type-body-sm">{COPY.failed}</p>
            <button
              type="button"
              className={`weight-medium ${styles.textAction}`}
              onClick={() => void fetchList()}
              data-action="retry"
            >
              {COPY.retry}
            </button>
          </div>
        ) : (
          <Sections load={load} />
        )}
      </DemoPage>
    </div>
  )
}

function Sections({ load }: { load: Exclude<Load, { kind: 'failed' }> }) {
  const busy = load.kind === 'loading'
  const data = load.kind === 'ready' ? load.data : null
  return (
    <>
      <section
        className={cards.card}
        aria-labelledby="my-ventures"
        aria-busy={busy || undefined}
        data-section="ventures"
      >
        <header className={cards.cardHead}>
          <div>
            <h2 id="my-ventures" className={`weight-semibold ${cards.cardTitle}`}>
              {COPY.venturesTitle}
            </h2>
            <p className={`type-meta-xs ${cards.cardHint}`}>{COPY.venturesHint}</p>
          </div>
          <Link
            href="/projects/new"
            className={`weight-medium ${styles.textAction}`}
            data-nav="create-project"
          >
            {COPY.create}
          </Link>
        </header>
        {busy ? (
          <p className={`type-body-sm ${cards.empty}`} data-state="projects-loading">
            {COPY.loading}
          </p>
        ) : data && data.ventures.length === 0 ? (
          <p className={`type-body-sm ${cards.empty}`} data-state="ventures-empty">
            {COPY.venturesEmpty}
          </p>
        ) : data ? (
          <ul className={cards.list}>
            {data.ventures.map((v) => (
              <VentureRow key={v.id} venture={v} applications={data.applications} />
            ))}
          </ul>
        ) : null}
      </section>

      <section
        className={cards.card}
        aria-labelledby="open-programmes"
        aria-busy={busy || undefined}
        data-section="programmes"
      >
        <header className={cards.cardHead}>
          <div>
            <h2 id="open-programmes" className={`weight-semibold ${cards.cardTitle}`}>
              {COPY.programmesTitle}
            </h2>
            <p className={`type-meta-xs ${cards.cardHint}`}>{COPY.programmesHint}</p>
          </div>
        </header>
        {busy ? (
          <p className={`type-body-sm ${cards.empty}`}>{COPY.loading}</p>
        ) : data && data.programmes.length === 0 ? (
          <p className={`type-body-sm ${cards.empty}`} data-state="programmes-empty">
            {COPY.programmesEmpty}
          </p>
        ) : data ? (
          <ul className={cards.list}>
            {data.programmes.map((p) => (
              <ProgrammeRow key={p.id} programme={p} />
            ))}
          </ul>
        ) : null}
      </section>
    </>
  )
}

function VentureRow({
  venture,
  applications,
}: {
  venture: DemoVentureSummaryDTO
  applications: ApplicationSummaryDTO[]
}) {
  return (
    <li
      className={`${cards.item} ${styles.row}`}
      data-venture={venture.id}
      data-venture-type={venture.type}
      data-relation={venture.relation}
    >
      <div className={styles.text}>
        <p className={`type-body-md weight-medium ${styles.name}`}>
          {/* WF05-S02: the row opens the venture's detail (the name is the link, the row its hit area). */}
          <Link
            href={projectDemoRoutes.detail(venture.id)}
            className={styles.rowLink}
            data-nav="venture-detail"
          >
            {venture.name}
          </Link>
        </p>
        <p className={`type-meta-xs ${cards.meta}`} data-venture-meta>
          {VENTURE_TYPE_LABEL[venture.type] ?? venture.type} ·{' '}
          {relationLabel(venture.relation, venture.role_label)}
        </p>
        <Applications ventureId={venture.id} applications={applications} />
      </div>
      <span className={`weight-medium ${pill.pill}`} data-venture-status={venture.status}>
        {VENTURE_STATUS_LABEL[venture.status] ?? venture.status}
      </span>
    </li>
  )
}

/** The server applications of one venture, in every programme state, if any (read only). */
function Applications({
  ventureId,
  applications,
}: {
  ventureId: string
  applications: ApplicationSummaryDTO[]
}) {
  const mine = applications.filter((a) => a.venture.id === ventureId)
  if (mine.length === 0) return null
  return (
    <p className={`type-meta-xs ${styles.applications}`} data-venture-applications>
      {COPY.applications}:{' '}
      {mine
        .map(
          (a) =>
            `${a.programme.name} · ${APPLICATION_COPY.status[a.status]}${a.programme.status === 'PUBLISHED' ? '' : ` (${COPY.closed})`}`,
        )
        .join('; ')}
    </p>
  )
}

function ProgrammeRow({ programme }: { programme: OpenProgrammeDTO }) {
  return (
    <li
      className={`${cards.item} ${styles.row}`}
      data-programme={programme.id}
      data-programme-type={programme.type}
    >
      <div className={styles.text}>
        <p className={`type-meta-xs ${cards.meta}`} data-programme-kind>
          {TYPE_LABEL[programme.type]} · {programme.organization.name}
        </p>
        <p className={`type-body-md weight-medium ${styles.name}`}>{programme.name}</p>
        {programme.summary ? (
          <p className={`type-body-sm ${styles.summary}`}>{programme.summary}</p>
        ) : null}
        <p className={`type-meta-xs ${cards.meta}`} data-programme-meta>
          {formatDemoDateRange(programme.starts_at, programme.ends_at)} · {COPY.applicantTypes}:{' '}
          {programme.applicant_types
            .map((t) => APPLICANT_LABEL[t as ApplicantType] ?? t)
            .join(', ')}
        </p>
      </div>
      <div className={styles.rowActions}>
        <ProgrammeStatusPill status={programme.status} />
        {/* TASK 24.4: the L5 entry (SUB0 without an eligible venture, else the form). */}
        <Link
          href={applicationRoutes.apply(programme.id)}
          className={`weight-medium ${styles.textAction}`}
          data-action="apply-entry"
        >
          {COPY.apply}
        </Link>
      </div>
    </li>
  )
}
