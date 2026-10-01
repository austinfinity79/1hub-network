import type { OrganizationRefDTO } from '@/lib/ops/organizations'
import { dayToInstant } from '@/lib/programme-demo/basic-info'
import { instantToDay, orderedStages } from '@/lib/programme-demo/journey'
import type {
  ProgrammeDemoDetail,
  ProgrammeStageDTO as ScreenStage,
} from '@/lib/programme-demo/types'

import type { ProgrammeActions, ProgrammeDetailDTO, ProgrammeRegistrationDTO } from './types'

/**
 * WF04-PROD-04 — what the approved WF04 screens render, built from the
 * canonical `GET /programmes/{id}` detail (API 05 §22). Client-safe: types and
 * pure helpers only.
 *
 * The screens keep the shapes they were approved with (DEC-WF04-T00-D2); this
 * maps the server's representation into them and back, so the server stays
 * the only source of truth:
 * - stages: the stored calendar days ↔ the instants the editors use;
 * - registration: the stored form, shown as applicant types and prompts;
 * - team (Q4) and application counts (Q5, HD-A13) have no v1 source: empty.
 */

export type ProgrammeScreen = ProgrammeDemoDetail & {
  organization: OrganizationRefDTO
  actions: ProgrammeActions
  owner_archived: boolean
  /** The canonical form as stored (questions with `required` and `step`), or null. */
  form: ProgrammeRegistrationDTO | null
}

export function toScreen(detail: ProgrammeDetailDTO): ProgrammeScreen {
  return {
    programme: detail.programme,
    organization: detail.organization,
    stages: detail.stages.map((s) => ({
      id: s.id,
      position: s.position,
      name: s.name,
      summary: s.summary,
      starts_at: s.starts_on ? dayToInstant(s.starts_on, 'start') : null,
      ends_at: s.ends_on ? dayToInstant(s.ends_on, 'end') : null,
    })),
    ...(detail.problem_statements ? { problem_statements: detail.problem_statements } : {}),
    events: detail.events,
    team: [],
    registration: {
      applicant_types: detail.registration?.applicant_types ?? [],
      questions: detail.registration?.questions.map((q) => q.prompt) ?? [],
    },
    application_counts: {},
    actions: detail.actions,
    owner_archived: detail.owner_archived,
    form: detail.registration,
  }
}

const stagesOf = (stages: ScreenStage[]) =>
  orderedStages({ stages }).map((s) => ({
    id: s.id,
    name: s.name,
    summary: s.summary,
    starts_on: s.starts_at ? instantToDay(s.starts_at) : null,
    ends_on: s.ends_at ? instantToDay(s.ends_at) : null,
  }))

const problemsOf = (detail: Pick<ProgrammeDemoDetail, 'problem_statements'>) =>
  (detail.problem_statements ?? []).map(({ id, title, summary }) => ({ id, title, summary }))

const BASIC = ['name', 'summary', 'starts_at', 'ends_at'] as const

/**
 * The `PATCH /programmes/{id}` body for an edit the screen computed: only the
 * fields that differ, lists as whole replacements. Empty when nothing changed.
 */
export function patchFor(current: ProgrammeScreen, next: ProgrammeDemoDetail) {
  const body: Record<string, unknown> = {}
  for (const field of BASIC)
    if (next.programme[field] !== current.programme[field]) body[field] = next.programme[field]
  const stages = stagesOf(next.stages)
  if (JSON.stringify(stages) !== JSON.stringify(stagesOf(current.stages))) body.stages = stages
  if (current.programme.type === 'CHALLENGE') {
    const problems = problemsOf(next)
    if (JSON.stringify(problems) !== JSON.stringify(problemsOf(current)))
      body.problem_statements = problems
  }
  return body
}

/** Publish checklist items (contract §8, REQUIRED and TECHNICALLY REQUIRED only; no demo rule). */
export type PublishItem = 'name' | 'type' | 'owner' | 'dates'

export function publishChecks(screen: ProgrammeScreen): { item: PublishItem; ok: boolean }[] {
  const p = screen.programme
  const start = p.starts_at ? Date.parse(p.starts_at) : null
  const end = p.ends_at ? Date.parse(p.ends_at) : null
  return [
    { item: 'name', ok: p.name.trim().length > 0 },
    { item: 'type', ok: p.type === 'PROGRAMME' || p.type === 'CHALLENGE' },
    { item: 'owner', ok: Boolean(screen.organization.id) && !screen.owner_archived },
    { item: 'dates', ok: start === null || end === null || end >= start },
  ]
}

/** Server validation fields of a failed publish, as checklist items. */
export function failingItems(fields: Record<string, string> | undefined): PublishItem[] {
  if (!fields) return []
  const items = new Set<PublishItem>()
  for (const field of Object.keys(fields)) {
    if (field === 'name') items.add('name')
    else if (field === 'starts_at' || field === 'ends_at') items.add('dates')
    else if (field === 'type') items.add('type')
  }
  return [...items]
}
