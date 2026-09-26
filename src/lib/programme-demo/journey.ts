import { dayToInstant, isValidDay } from './basic-info'
import type { ProblemStatementDTO, ProgrammeDemoDetail, ProgrammeStageDTO } from './types'

/**
 * WF04-S03 — Structure & journey edits of a demo Programme (DEC-WF04-H3/H4,
 * DEC-WF04-S03-D1..D3). Pure and atomic: every function returns a NEW detail
 * or a refusal, and never touches its input, so an invalid edit changes
 * nothing.
 *
 * - Stages are an ordered list; `position` is the order (1..n, contiguous).
 *   Fields are the frozen stage shape only: name (required), summary
 *   (optional), start / end calendar days (optional, end ≥ start).
 * - Problem statements ("Bài toán") exist on a CHALLENGE only: title
 *   (required), summary (optional).
 * No rule, branch, condition, scoring or transition is modelled.
 */

export type StageInput = { name: string; summary: string; starts_on: string; ends_on: string }
export type ProblemInput = { title: string; summary: string }

export type StageErrors = Partial<Record<'name' | 'dates', 'required' | 'invalid' | 'order'>>
export type ProblemErrors = Partial<Record<'title', 'required'>>

export type EditResult<E> =
  | { ok: true; detail: ProgrammeDemoDetail }
  | { ok: false; reason: 'invalid'; errors: E }
  | { ok: false; reason: 'not_found' | 'boundary' | 'not_challenge' }

export function validateStage(input: StageInput): StageErrors {
  const errors: StageErrors = {}
  if (!input.name.trim()) errors.name = 'required'
  const start = input.starts_on.trim()
  const end = input.ends_on.trim()
  if ((start && !isValidDay(start)) || (end && !isValidDay(end))) errors.dates = 'invalid'
  else if (start && end && end < start) errors.dates = 'order'
  return errors
}

export function validateProblem(input: ProblemInput): ProblemErrors {
  return input.title.trim() ? {} : { title: 'required' }
}

/** Stages in stored order (by `position`, then id for a stable tie-break). */
export function orderedStages(detail: Pick<ProgrammeDemoDetail, 'stages'>): ProgrammeStageDTO[] {
  return [...detail.stages].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

/** yyyy-mm-dd of a stored instant, in Vietnam (for editing). */
export function instantToDay(value: string | null): string {
  if (!value) return ''
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time + 7 * 3600_000).toISOString().slice(0, 10) : ''
}

function touched(detail: ProgrammeDemoDetail, now: Date): ProgrammeDemoDetail {
  const copy = structuredClone(detail)
  copy.programme.updated_at = now.toISOString()
  return copy
}

function renumber(stages: ProgrammeStageDTO[]): ProgrammeStageDTO[] {
  return stages.map((s, i) => ({ ...s, position: i + 1 }))
}

function stageFields(input: StageInput) {
  return {
    name: input.name.trim(),
    summary: input.summary.trim() || null,
    starts_at: dayToInstant(input.starts_on, 'start'),
    ends_at: dayToInstant(input.ends_on, 'end'),
  }
}

export function addStage(
  detail: ProgrammeDemoDetail,
  input: StageInput,
  { id, now }: { id: string; now: Date },
): EditResult<StageErrors> {
  const errors = validateStage(input)
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const next = touched(detail, now)
  next.stages = renumber([...orderedStages(detail), { id, position: 0, ...stageFields(input) }])
  return { ok: true, detail: next }
}

export function updateStage(
  detail: ProgrammeDemoDetail,
  stageId: string,
  input: StageInput,
  now: Date,
): EditResult<StageErrors> {
  if (!detail.stages.some((s) => s.id === stageId)) return { ok: false, reason: 'not_found' }
  const errors = validateStage(input)
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const next = touched(detail, now)
  next.stages = orderedStages(detail).map((s) =>
    s.id === stageId ? { ...s, ...stageFields(input) } : s,
  )
  return { ok: true, detail: next }
}

export function removeStage(
  detail: ProgrammeDemoDetail,
  stageId: string,
  now: Date,
): EditResult<never> {
  if (!detail.stages.some((s) => s.id === stageId)) return { ok: false, reason: 'not_found' }
  const next = touched(detail, now)
  next.stages = renumber(orderedStages(detail).filter((s) => s.id !== stageId))
  return { ok: true, detail: next }
}

export function moveStage(
  detail: ProgrammeDemoDetail,
  stageId: string,
  direction: 'up' | 'down',
  now: Date,
): EditResult<never> {
  const stages = orderedStages(detail)
  const at = stages.findIndex((s) => s.id === stageId)
  if (at < 0) return { ok: false, reason: 'not_found' }
  const to = direction === 'up' ? at - 1 : at + 1
  if (to < 0 || to >= stages.length) return { ok: false, reason: 'boundary' }
  const swapped = [...stages]
  ;[swapped[at], swapped[to]] = [swapped[to]!, swapped[at]!]
  const next = touched(detail, now)
  next.stages = renumber(swapped)
  return { ok: true, detail: next }
}

function problemFields(input: ProblemInput) {
  return { title: input.title.trim(), summary: input.summary.trim() || null }
}

export function addProblem(
  detail: ProgrammeDemoDetail,
  input: ProblemInput,
  { id, now }: { id: string; now: Date },
): EditResult<ProblemErrors> {
  if (detail.programme.type !== 'CHALLENGE') return { ok: false, reason: 'not_challenge' }
  const errors = validateProblem(input)
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const next = touched(detail, now)
  const problem: ProblemStatementDTO = { id, ...problemFields(input) }
  next.problem_statements = [...(detail.problem_statements ?? []), problem]
  return { ok: true, detail: next }
}

export function updateProblem(
  detail: ProgrammeDemoDetail,
  problemId: string,
  input: ProblemInput,
  now: Date,
): EditResult<ProblemErrors> {
  if (detail.programme.type !== 'CHALLENGE') return { ok: false, reason: 'not_challenge' }
  if (!(detail.problem_statements ?? []).some((p) => p.id === problemId))
    return { ok: false, reason: 'not_found' }
  const errors = validateProblem(input)
  if (Object.keys(errors).length > 0) return { ok: false, reason: 'invalid', errors }
  const next = touched(detail, now)
  next.problem_statements = (detail.problem_statements ?? []).map((p) =>
    p.id === problemId ? { ...p, ...problemFields(input) } : p,
  )
  return { ok: true, detail: next }
}

export function removeProblem(
  detail: ProgrammeDemoDetail,
  problemId: string,
  now: Date,
): EditResult<never> {
  if (detail.programme.type !== 'CHALLENGE') return { ok: false, reason: 'not_challenge' }
  if (!(detail.problem_statements ?? []).some((p) => p.id === problemId))
    return { ok: false, reason: 'not_found' }
  const next = touched(detail, now)
  next.problem_statements = (detail.problem_statements ?? []).filter((p) => p.id !== problemId)
  return { ok: true, detail: next }
}
