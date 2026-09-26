import type { OrganizationAllowance } from './readiness'
import type { ProgrammeDemoDetailDTO, ProgrammeDemoSummaryDTO } from './types'

/**
 * WF04-T00 — Programme demo session store (DEC-WF04-T00-D3).
 *
 * Every demo change (S02–S07) lives in the browser's `sessionStorage` under one
 * key per signed-in actor, and nowhere else: no API accepts a demo mutation and
 * nothing reaches PostgreSQL, audit or analytics.
 *
 * Semantics (deterministic):
 * - refresh / navigation in the same tab keeps the session state;
 * - a new tab, a closed tab or another signed-in actor starts from the fixture;
 * - "Đặt lại demo" removes the key: the next read is exactly the fixture;
 * - a stored value that is unreadable or of another version is ignored.
 *
 * The state is the actor's own browser data. It is never sent to the server and
 * never trusted by it; server reads always come from the frozen fixture and the
 * actor's server-side scope.
 *
 * Pure functions over a Storage-like object, so the rules are unit-tested
 * without a browser.
 */

export const DEMO_STORE_VERSION = 1 as const
const KEY_PREFIX = 'hub.wf04-demo.v1.'

export type DemoSessionState = {
  version: typeof DEMO_STORE_VERSION
  /** Session copies of fixture programmes and session-created drafts, by id. */
  programmes: Record<string, ProgrammeDemoDetailDTO>
  /** Ids created in this session (not fixture), newest first. */
  created: string[]
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function demoStoreKey(actorKey: string): string {
  return `${KEY_PREFIX}${actorKey}`
}

export function emptyDemoState(): DemoSessionState {
  return { version: DEMO_STORE_VERSION, programmes: {}, created: [] }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validDetail(id: string, value: unknown): value is ProgrammeDemoDetailDTO {
  if (!isRecord(value) || value.demo !== true || !isRecord(value.programme)) return false
  if (!isRecord(value.organization)) return false
  return (
    value.programme.id === id &&
    Array.isArray(value.stages) &&
    Array.isArray(value.events) &&
    Array.isArray(value.team) &&
    isRecord(value.registration) &&
    isRecord(value.application_counts)
  )
}

export function readDemoState(storage: StorageLike | null, key: string): DemoSessionState {
  if (!storage) return emptyDemoState()
  try {
    return parseDemoState(storage.getItem(key))
  } catch {
    return emptyDemoState()
  }
}

/** The state a stored value encodes; anything unreadable is the empty (fixture) state. */
export function parseDemoState(raw: string | null): DemoSessionState {
  if (!raw) return emptyDemoState()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyDemoState()
  }
  if (!isRecord(parsed) || parsed.version !== DEMO_STORE_VERSION || !isRecord(parsed.programmes))
    return emptyDemoState()
  const programmes: Record<string, ProgrammeDemoDetailDTO> = {}
  for (const [id, value] of Object.entries(parsed.programmes))
    if (validDetail(id, value)) programmes[id] = value
  const created = Array.isArray(parsed.created)
    ? parsed.created.filter((id): id is string => typeof id === 'string' && id in programmes)
    : []
  return { version: DEMO_STORE_VERSION, programmes, created }
}

/** False when the browser refuses to store (private mode, quota); the caller keeps memory state. */
export function writeDemoState(
  storage: StorageLike | null,
  key: string,
  state: DemoSessionState,
): boolean {
  if (!storage) return false
  try {
    storage.setItem(key, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function resetDemoState(storage: StorageLike | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    // Nothing stored means nothing to reset.
  }
}

/** Stores a copy of `detail`; `created` marks a session-created draft (not a fixture copy). */
export function withProgramme(
  state: DemoSessionState,
  detail: ProgrammeDemoDetailDTO,
  created = false,
): DemoSessionState {
  const id = detail.programme.id
  const copy = structuredClone(detail)
  const ids = created && !state.created.includes(id) ? [id, ...state.created] : state.created
  return { ...state, programmes: { ...state.programmes, [id]: copy }, created: ids }
}

export function withoutProgramme(state: DemoSessionState, id: string): DemoSessionState {
  const programmes = { ...state.programmes }
  delete programmes[id]
  return { ...state, programmes, created: state.created.filter((c) => c !== id) }
}

export function inAllowance(
  detail: { organization: { id: string } },
  allowance: OrganizationAllowance,
) {
  return allowance === 'ALL' || allowance.includes(detail.organization.id)
}

/** The session copy when one exists, else a copy of the server (fixture) detail. */
export function effectiveDetail(
  state: DemoSessionState,
  id: string,
  server?: ProgrammeDemoDetailDTO,
): ProgrammeDemoDetailDTO | undefined {
  const stored = state.programmes[id]
  if (stored) return structuredClone(stored)
  return server ? structuredClone(server) : undefined
}

export function toSummary(detail: ProgrammeDemoDetailDTO): ProgrammeDemoSummaryDTO {
  return {
    ...detail.programme,
    organization: detail.organization,
    counts: {
      stages: detail.stages.length,
      events: detail.events.length,
      problem_statements:
        detail.programme.type === 'CHALLENGE' ? (detail.problem_statements?.length ?? 0) : null,
    },
    demo: true,
  }
}

/**
 * The list the demo shows: session-created drafts in the actor's allowance
 * (newest first), then the server list, in the server's order, with session
 * copies applied. A session copy never adds a programme the server did not
 * list, and an id is never shown twice.
 */
export function mergedSummaries(
  server: readonly ProgrammeDemoSummaryDTO[],
  state: DemoSessionState,
  allowance: OrganizationAllowance,
): ProgrammeDemoSummaryDTO[] {
  const listedIds = new Set(server.map((s) => s.id))
  const drafts = state.created
    .filter((id) => !listedIds.has(id))
    .map((id) => state.programmes[id])
    .filter((d): d is ProgrammeDemoDetailDTO => Boolean(d) && inAllowance(d!, allowance))
    .map(toSummary)
  const listed = server.map((s) => {
    const copy = state.programmes[s.id]
    return copy ? toSummary(copy) : s
  })
  return [...drafts, ...listed]
}
