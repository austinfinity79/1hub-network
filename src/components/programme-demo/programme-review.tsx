'use client'

import Link from 'next/link'
import { useRef, useState, type ReactNode } from 'react'

import { Notice } from '@/components/ui'
import { APPLICANT_LABEL, TEAM_ROLE_LABEL, TYPE_LABEL } from '@/lib/programme-demo/copy'
import { formatDemoDateRange } from '@/lib/programme-demo/format'
import { orderedStages } from '@/lib/programme-demo/journey'
import { programmeEvents } from '@/lib/programme-demo/programme-events'
import {
  publishProgramme,
  publishReadiness,
  type OrganizationAllowance,
  type ReadinessItem,
} from '@/lib/programme-demo/readiness'
import { demoRoutes, type SetupStep } from '@/lib/programme-demo/routes'
import type { ProgrammeDemoDetailDTO } from '@/lib/programme-demo/types'

import buttons from './demo-buttons.module.css'
import styles from './journey.module.css'
import { SetupScreen, type Apply } from './setup-screen'
import { ProgrammeStatusPill } from './status-pill'

/**
 * WF04-S07 — review + publish (DEC-WF04-H5, DEC-WF04-S07-D1..D3).
 *
 * A read-only summary of the programme's setup, the frozen H5 checklist
 * (`publishReadiness`, nothing added) and the one demo transition DRAFT →
 * PUBLISHED, applied atomically to the actor's session copy. No unpublish,
 * close or archive. After publishing the screen stays here in the PUBLISHED
 * state (the detail page is WF04-S08). Edit links point only at built steps.
 */

const COPY = {
  back: '← Đội vận hành',
  summary: 'Rà soát',
  summaryHint: 'Tóm tắt thiết lập của chương trình trước khi xuất bản.',
  edit: 'Sửa',
  basic: 'Thông tin cơ bản',
  type: 'Loại',
  name: 'Tên',
  summaryField: 'Tóm tắt',
  owner: 'Đơn vị chủ trì',
  time: 'Thời gian',
  status: 'Trạng thái',
  journey: 'Hành trình',
  problems: 'Bài toán',
  events: 'Sự kiện',
  registration: 'Đăng ký',
  team: 'Đội vận hành',
  none: '—',
  stages: (n: number) => `${n} giai đoạn`,
  problemsCount: (n: number) => `${n} bài toán`,
  eventsCount: (n: number) => `${n} sự kiện`,
  questions: (n: number) => `${n} câu hỏi riêng`,
  members: (n: number) => `${n} thành viên`,
  noApplicants: 'Chưa chọn người đăng ký',
  checklist: 'Điều kiện xuất bản',
  ready: 'Sẵn sàng xuất bản',
  missing: (n: number) => `Còn thiếu ${n} mục`,
  pass: '✓ Đạt',
  fail: '✗ Còn thiếu',
  publish: 'Xuất bản',
  publishHint: 'Chương trình sẽ ở trạng thái đang công khai trong bản demo.',
  blocked: 'Hoàn thành các mục còn thiếu để xuất bản.',
  published: 'Đã xuất bản. Chương trình đang công khai trong bản demo.',
  toList: 'Về danh sách',
} as const

const ITEM_LABEL: Record<ReadinessItem, string> = {
  name: 'Có tên chương trình',
  type: 'Loại là Chương trình hoặc Challenge',
  owner: 'Đơn vị chủ trì thuộc phạm vi bạn vận hành',
  dates: 'Thời gian hợp lệ (kết thúc không trước bắt đầu)',
  problems: 'Challenge có ít nhất một bài toán',
}

/** Where a missing item is fixed; basic information has no built edit step yet (S08). */
const ITEM_STEP: Partial<Record<ReadinessItem, SetupStep>> = { problems: 'journey' }

export function ProgrammeReview({
  id,
  server,
}: {
  id: string
  server: ProgrammeDemoDetailDTO | null
}) {
  return (
    <SetupScreen
      id={id}
      server={server}
      step="review"
      screen="WF04-S07"
      back={{ href: demoRoutes.setup(id, 'team'), label: COPY.back, nav: 'review-back' }}
      next={null}
    >
      {({ detail, apply, allowance }) => (
        <ReviewBody detail={detail} apply={apply} allowance={allowance} />
      )}
    </SetupScreen>
  )
}

function ReviewBody({
  detail,
  apply,
  allowance,
}: {
  detail: ProgrammeDemoDetailDTO
  apply: Apply
  allowance: OrganizationAllowance
}) {
  const [publishing, setPublishing] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const inFlight = useRef(false)
  const { programme, organization, registration } = detail
  const id = programme.id
  const challenge = programme.type === 'CHALLENGE'
  const checks = publishReadiness(detail, allowance)
  const missing = checks.filter((c) => !c.ok)
  const draft = programme.status === 'DRAFT'
  const stages = orderedStages(detail)
  const events = programmeEvents(detail)
  const problems = detail.problem_statements ?? []

  function publish() {
    if (inFlight.current || !draft || missing.length > 0) return
    inFlight.current = true
    setPublishing(true)
    const outcome = apply(publishProgramme(detail, allowance, new Date()))
    setPublishing(false)
    if (outcome.ok) setJustPublished(true)
    else inFlight.current = false
  }

  const row = (key: string, label: string, value: ReactNode, step?: SetupStep) => (
    <div className={styles.reviewRow} data-review={key}>
      <p className={`type-body-sm weight-semibold ${styles.reviewLabel}`}>{label}</p>
      <div className={`type-body-sm ${styles.reviewValue}`}>{value}</div>
      {step ? (
        <Link
          href={demoRoutes.setup(id, step)}
          className={`weight-medium ${styles.editLink}`}
          data-edit={step}
        >
          {COPY.edit}
        </Link>
      ) : (
        <span />
      )}
    </div>
  )

  return (
    <>
      {justPublished ? (
        <div className={styles.saved} data-state="published-now">
          <Notice>{COPY.published}</Notice>
        </div>
      ) : null}
      <section className={styles.card} aria-labelledby="review-summary" data-review-summary>
        <header className={styles.cardHead}>
          <div>
            <h2 id="review-summary" className={`weight-semibold ${styles.cardTitle}`}>
              {COPY.summary}
            </h2>
            <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.summaryHint}</p>
          </div>
        </header>
        {row(
          'basic',
          COPY.basic,
          <>
            <p className={styles.reviewValue}>
              {TYPE_LABEL[programme.type]} · {programme.name}
            </p>
            <p className={`type-meta-xs ${styles.meta}`}>
              {[
                organization.name,
                formatDemoDateRange(programme.starts_at, programme.ends_at),
                programme.summary,
              ]
                .filter((x) => x && x !== '—')
                .join(' · ')}
            </p>
            <p className={styles.reviewValue}>
              <ProgrammeStatusPill status={programme.status} />
            </p>
          </>,
        )}
        {row(
          'journey',
          COPY.journey,
          stages.length > 0 ? (
            <>
              {COPY.stages(stages.length)}
              <ol>
                {stages.map((s) => (
                  <li key={s.id}>{s.name}</li>
                ))}
              </ol>
            </>
          ) : (
            COPY.stages(0)
          ),
          'journey',
        )}
        {challenge
          ? row(
              'problems',
              COPY.problems,
              problems.length > 0 ? (
                <>
                  {COPY.problemsCount(problems.length)}
                  <ul>
                    {problems.map((p) => (
                      <li key={p.id}>{p.title}</li>
                    ))}
                  </ul>
                </>
              ) : (
                COPY.problemsCount(0)
              ),
              'journey',
            )
          : null}
        {row(
          'events',
          COPY.events,
          events.length > 0 ? (
            <>
              {COPY.eventsCount(events.length)}
              <ul>
                {events.map((e) => (
                  <li key={e.id}>{e.name}</li>
                ))}
              </ul>
            </>
          ) : (
            COPY.eventsCount(0)
          ),
          'events',
        )}
        {row(
          'registration',
          COPY.registration,
          <>
            {registration.applicant_types.length > 0
              ? registration.applicant_types.map((t) => APPLICANT_LABEL[t]).join(' · ')
              : COPY.noApplicants}
            {' · '}
            {COPY.questions(registration.questions.length)}
          </>,
          'registration',
        )}
        {row(
          'team',
          COPY.team,
          detail.team.length > 0 ? (
            <>
              {COPY.members(detail.team.length)}
              <ul>
                {detail.team.map((m) => (
                  <li key={m.id}>
                    {m.display_name} · {TEAM_ROLE_LABEL[m.role_label] ?? m.role_label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            COPY.members(0)
          ),
          'team',
        )}
      </section>

      <section className={styles.card} aria-labelledby="review-checklist" data-review-checklist>
        <header className={styles.cardHead}>
          <div>
            <h2 id="review-checklist" className={`weight-semibold ${styles.cardTitle}`}>
              {COPY.checklist}
            </h2>
            <p className={`type-meta-xs ${styles.cardHint}`} data-readiness>
              {missing.length === 0 ? COPY.ready : COPY.missing(missing.length)}
            </p>
          </div>
        </header>
        <ul className={styles.list} aria-label={COPY.checklist}>
          {checks.map((c) => (
            <li
              key={c.item}
              className={styles.checkItem}
              data-check={c.item}
              data-ok={c.ok ? 'true' : 'false'}
            >
              <span
                className={`type-body-sm weight-semibold ${styles.checkState} ${c.ok ? styles.checkPass : styles.checkMissing}`}
              >
                {c.ok ? COPY.pass : COPY.fail}
              </span>
              <p className={`type-body-sm ${styles.checkLabel}`}>{ITEM_LABEL[c.item]}</p>
              {!c.ok && ITEM_STEP[c.item] ? (
                <Link
                  href={demoRoutes.setup(id, ITEM_STEP[c.item]!)}
                  className={`weight-medium ${styles.editLink}`}
                  data-fix={c.item}
                >
                  {COPY.edit}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <div
          className={styles.publish}
          data-publish-state={draft ? (missing.length ? 'incomplete' : 'ready') : 'published'}
        >
          {draft ? (
            <>
              <p className={`type-body-sm ${styles.publishText}`}>
                {missing.length === 0 ? COPY.publishHint : COPY.blocked}
              </p>
              <button
                type="button"
                className={`weight-medium ${buttons.primary}`}
                disabled={missing.length > 0 || publishing}
                aria-disabled={missing.length > 0 || publishing ? 'true' : undefined}
                aria-busy={publishing || undefined}
                title={missing.length > 0 ? COPY.blocked : undefined}
                onClick={publish}
                data-action="publish"
              >
                {COPY.publish}
              </button>
            </>
          ) : (
            <>
              <p className={`type-body-sm ${styles.publishText}`} data-state="published">
                <ProgrammeStatusPill status={programme.status} />
              </p>
              <Link
                href={demoRoutes.list()}
                className={`weight-medium ${buttons.secondary}`}
                data-nav="review-list"
              >
                {COPY.toList}
              </Link>
            </>
          )}
        </div>
      </section>
    </>
  )
}
