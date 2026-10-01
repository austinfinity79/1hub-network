'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { APPLICANT_LABEL, TEAM_ROLE_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatEventWhen } from '@/lib/programme-demo/event-time'
import { formatDemoDateRange } from '@/lib/programme-demo/format'
import { orderedStages } from '@/lib/programme-demo/journey'
import { programmeEvents } from '@/lib/programme-demo/programme-events'
import { demoRoutes, type SetupStep } from '@/lib/programme-demo/routes'
import type { ProgrammeDetailDTO } from '@/lib/programme/types'
import type { ProgrammeScreen } from '@/lib/programme/view'

import buttons from './demo-buttons.module.css'
import styles from './journey.module.css'
import { SetupScreen } from './setup-screen'
import { EventStatusPill, ProgrammeStatusPill } from './status-pill'

/**
 * WF04-S08 — programme detail / manage (DEC-WF04-S08-D1..D3; WF04-PROD-04).
 * One page for PROGRAMME and CHALLENGE (the CHALLENGE adds its problem
 * statements), from the canonical API: identity, status, owner, time, summary,
 * and summaries of the journey, events, registration and team, each linking to
 * its setup step while the programme can be edited. Publishing is S07. Closing
 * (DEC-W4P-D12) is API-only: the approved design has no close control, so
 * none is drawn until a PO / design decision (WF04-PROD-04-FIX); a closed
 * programme is shown read only. No metric, application count, funnel or
 * public link.
 */

const COPY = {
  back: '← Danh sách',
  reviewDraft: 'Rà soát & xuất bản',
  review: 'Rà soát',
  draft: 'Chưa công khai. Rà soát rồi xuất bản khi đã sẵn sàng.',
  published: 'Đang công khai.',
  closedText: 'Đã đóng: không nhận đăng ký mới và không chỉnh sửa được.',
  archivedText: 'Đã lưu trữ.',
  overview: 'Thông tin chung',
  type: 'Loại',
  owner: 'Đơn vị chủ trì',
  time: 'Thời gian',
  summary: 'Tóm tắt',
  edit: 'Sửa',
  manage: 'Quản lý',
  journey: 'Hành trình',
  problems: 'Bài toán',
  events: 'Sự kiện',
  registration: 'Đăng ký',
  team: 'Đội vận hành',
  stages: (n: number) => `${n} giai đoạn`,
  problemsCount: (n: number) => `${n} bài toán`,
  eventsCount: (n: number) => `${n} sự kiện`,
  members: (n: number) => `${n} thành viên`,
  questions: (n: number) => `${n} câu hỏi riêng`,
  noApplicants: 'Chưa chọn người đăng ký',
  noTime: 'Chưa có thời gian',
} as const

export function ProgrammeDetail({ id, initial }: { id: string; initial: ProgrammeDetailDTO }) {
  return (
    <SetupScreen
      initial={initial}
      screen="WF04-S08"
      actions={(detail) => (
        <div className={buttons.group}>
          <Link
            href={demoRoutes.list()}
            className={`weight-medium ${buttons.secondary}`}
            data-nav="detail-back"
          >
            {COPY.back}
          </Link>
          <Link
            href={demoRoutes.setup(id, 'review')}
            className={`weight-medium ${detail.actions.publish ? buttons.primary : buttons.secondary}`}
            data-nav="detail-review"
          >
            {detail.actions.publish ? COPY.reviewDraft : COPY.review}
          </Link>
        </div>
      )}
    >
      {({ detail }) => <DetailBody detail={detail} />}
    </SetupScreen>
  )
}

function Card({
  programmeId,
  name,
  title,
  step,
  editable,
  children,
}: {
  programmeId: string
  name: string
  title: string
  step: SetupStep
  /** Links to the setup step only while the server allows edits. */
  editable: boolean
  children: ReactNode
}) {
  return (
    <section className={styles.card} aria-labelledby={`detail-${name}`} data-detail={name}>
      <header className={styles.cardHead}>
        <h2 id={`detail-${name}`} className={`weight-semibold ${styles.cardTitle}`}>
          {title}
        </h2>
        {editable ? (
          <Link
            href={demoRoutes.setup(programmeId, step)}
            className={`weight-medium ${styles.editLink}`}
            data-manage={step}
          >
            {COPY.manage}
          </Link>
        ) : null}
      </header>
      <div className={`type-body-sm ${styles.cardBody}`}>{children}</div>
    </section>
  )
}

const STATUS_TEXT: Record<ProgrammeScreen['programme']['status'], string> = {
  DRAFT: COPY.draft,
  PUBLISHED: COPY.published,
  CLOSED: COPY.closedText,
  ARCHIVED: COPY.archivedText,
}

function DetailBody({ detail }: { detail: ProgrammeScreen }) {
  const { programme, organization, registration } = detail
  const stages = orderedStages(detail)
  const events = programmeEvents(detail)
  const problems = detail.problem_statements ?? []
  const editable = detail.actions.edit

  return (
    <>
      <div className={styles.status} data-detail-status={programme.status}>
        <ProgrammeStatusPill status={programme.status} />
        <p className={`type-body-sm ${styles.statusText}`}>{STATUS_TEXT[programme.status]}</p>
      </div>

      <section className={styles.card} aria-labelledby="detail-overview" data-detail="overview">
        <header className={styles.cardHead}>
          <h2 id="detail-overview" className={`weight-semibold ${styles.cardTitle}`}>
            {COPY.overview}
          </h2>
          {editable ? (
            <Link
              href={demoRoutes.setup(programme.id, 'basic')}
              className={`weight-medium ${styles.editLink}`}
              data-manage="basic"
            >
              {COPY.edit}
            </Link>
          ) : null}
        </header>
        {(
          [
            ['type', COPY.type, TYPE_LABEL[programme.type]],
            ['owner', COPY.owner, organization.name],
            ['time', COPY.time, formatDemoDateRange(programme.starts_at, programme.ends_at)],
            ['summary', COPY.summary, programme.summary ?? '—'],
          ] as const
        ).map(([key, label, value]) => (
          <div key={key} className={styles.reviewRow} data-overview={key}>
            <p className={`type-body-sm weight-semibold ${styles.reviewLabel}`}>{label}</p>
            <p className={`type-body-sm ${styles.reviewValue}`}>{value}</p>
            <span />
          </div>
        ))}
      </section>

      <div className={styles.detailGrid}>
        <Card
          editable={editable}
          programmeId={programme.id}
          name="journey"
          title={COPY.journey}
          step="journey"
        >
          {COPY.stages(stages.length)}
          {stages.length > 0 ? (
            <ol>
              {stages.map((s) => (
                <li key={s.id}>
                  {s.name}
                  <span className={styles.cardMeta}>
                    {' · '}
                    {formatDemoDateRange(s.starts_at, s.ends_at)}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>

        {programme.type === 'CHALLENGE' ? (
          <Card
            editable={editable}
            programmeId={programme.id}
            name="problems"
            title={COPY.problems}
            step="journey"
          >
            {COPY.problemsCount(problems.length)}
            {problems.length > 0 ? (
              <ul>
                {problems.map((p) => (
                  <li key={p.id}>{p.title}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}

        <Card
          editable={editable}
          programmeId={programme.id}
          name="events"
          title={COPY.events}
          step="events"
        >
          {COPY.eventsCount(events.length)}
          {events.length > 0 ? (
            <ul>
              {events.map((e) => (
                <li key={e.id}>
                  {e.name}
                  <span className={styles.cardMeta}>
                    {' · '}
                    {formatEventWhen(e.starts_at, e.ends_at) ?? COPY.noTime}
                  </span>{' '}
                  <EventStatusPill status={e.status} />
                </li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card
          editable={editable}
          programmeId={programme.id}
          name="registration"
          title={COPY.registration}
          step="registration"
        >
          {registration.applicant_types.length > 0
            ? registration.applicant_types.map((t) => APPLICANT_LABEL[t]).join(' · ')
            : COPY.noApplicants}
          {' · '}
          {COPY.questions(registration.questions.length)}
        </Card>

        <Card
          editable={editable}
          programmeId={programme.id}
          name="team"
          title={COPY.team}
          step="team"
        >
          {COPY.members(detail.team.length)}
          {detail.team.length > 0 ? (
            <ul>
              {detail.team.map((m) => (
                <li key={m.id}>
                  {m.display_name}
                  <span className={styles.cardMeta}>
                    {' · '}
                    {TEAM_ROLE_LABEL[m.role_label] ?? m.role_label}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </>
  )
}
