import { ApiError } from '@/lib/api/errors'
import { query, type Executor } from '@/lib/db/client'

import { isPrimaryIntent, type PrimaryIntent } from './intent'

/**
 * WF01 onboarding state — the ONE server-side resolver (DEC-L1R-D3, which
 * supersedes the step order of DEC-WF01-RESUME-D1).
 *
 * Used by GET /me/onboarding, PUT /me/onboarding/stage, the sign-in
 * `next_step` (consumeMagicLink), `/session` and the onboarding page guards.
 * Derived only from persisted canonical data; nothing the client sends can
 * move it. First incomplete step of the four-stage flow (BA workbook row 56):
 *
 *   DONE        status ACTIVE and onboarding_completed_at set       → /me
 *   INTRO       nothing of the four-stage flow saved yet (ACC-05)   → /onboarding
 *   BASIC       a required stage 1 field is missing (ACC-06)        → /onboarding/profile
 *   CAPABILITY  stage 2 not yet passed (ACC-07)                     → /onboarding/capability
 *   ROLE        stage 3 not yet passed (ACC-08)                     → /onboarding/purpose
 *   REVIEW      stage 4: review, visibility, consent (ACC-09)       → /onboarding/privacy
 *
 * Stage 1 is complete by its data. Stages 2 and 3 have no required field, so
 * passing them is recorded (`capability_step_completed_at`,
 * `role_step_completed_at`, server time, never reset). The three older routes
 * are reused for the stages that replace their screens.
 */

export type OnboardingStep = 'INTRO' | 'BASIC' | 'CAPABILITY' | 'ROLE' | 'REVIEW'

export type OnboardingState = {
  completed: boolean
  /** Null once onboarding is complete, as in the consume response. */
  current_step: OnboardingStep | null
  intent: PrimaryIntent | null
}

export const STEP_ROUTES: Record<OnboardingStep, string> = {
  INTRO: '/onboarding',
  BASIC: '/onboarding/profile',
  CAPABILITY: '/onboarding/capability',
  ROLE: '/onboarding/purpose',
  REVIEW: '/onboarding/privacy',
}

/** Flow order; a stage page may be opened once every stage before it is passed. */
export const STEP_ORDER: readonly OnboardingStep[] = [
  'INTRO',
  'BASIC',
  'CAPABILITY',
  'ROLE',
  'REVIEW',
]

/** Where the account belongs now: its current step, or /me when done. */
export function routeFor(state: OnboardingState): string {
  return state.current_step ? STEP_ROUTES[state.current_step] : '/me'
}

/** True when `step` is the account's current step or one it has already passed. */
export function canOpen(state: OnboardingState, step: OnboardingStep): boolean {
  if (!state.current_step) return false
  // The intro is passed by pressing "Bắt đầu", so stage 1 is open from the start.
  const reached = state.current_step === 'INTRO' ? 'BASIC' : state.current_step
  return STEP_ORDER.indexOf(step) <= STEP_ORDER.indexOf(reached)
}

type Row = {
  status: string
  primary_intent: string | null
  onboarding_completed_at: Date | null
  started: boolean
  basic_done: boolean
  capability_done: boolean
  role_done: boolean
}

/**
 * Stage 1 is complete when the fields ACC-06 marks required exist: full name,
 * display name, country and province. The e-mail comes from the account.
 */
const BASIC_DONE_SQL = `
  coalesce(btrim(p.full_name), '') <> '' AND coalesce(btrim(p.display_name), '') <> ''
  AND EXISTS (SELECT 1 FROM vocabulary_items v
               WHERE v.id = p.country_vocab_id AND v.type_code = 'COUNTRY')
  AND EXISTS (SELECT 1 FROM vocabulary_items v
               WHERE v.id = p.region_vocab_id AND v.type_code = 'REGION')`

export async function getOnboardingState(
  accountId: string,
  exec: Executor = query,
): Promise<OnboardingState> {
  const [row] = await exec<Row>(
    `SELECT p.status::text AS status, p.primary_intent, p.onboarding_completed_at,
            (p.full_name IS NOT NULL OR p.country_vocab_id IS NOT NULL OR p.phone IS NOT NULL
              OR p.capability_step_completed_at IS NOT NULL
              OR p.role_step_completed_at IS NOT NULL) AS started,
            (${BASIC_DONE_SQL}) AS basic_done,
            p.capability_step_completed_at IS NOT NULL AS capability_done,
            p.role_step_completed_at IS NOT NULL AS role_done
       FROM individual_profiles p WHERE p.account_id = $1`,
    [accountId],
  )
  // A stored value outside the P0 allowlist is not surfaced as a selection.
  const intent = isPrimaryIntent(row?.primary_intent) ? row!.primary_intent : null
  const done = row?.status === 'ACTIVE' && Boolean(row.onboarding_completed_at)
  if (done) return { completed: true, current_step: null, intent }

  let step: OnboardingStep
  if (!row?.started) step = 'INTRO'
  else if (!row.basic_done) step = 'BASIC'
  else if (!row.capability_done) step = 'CAPABILITY'
  else if (!row.role_done) step = 'ROLE'
  else step = 'REVIEW'
  return { completed: false, current_step: step, intent }
}

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Onboarding request is not valid.', {
    [field]: reason,
  })

const STAGE_MARKERS = {
  CAPABILITY: 'capability_step_completed_at',
  ROLE: 'role_step_completed_at',
} as const

/**
 * PUT /me/onboarding/stage — `{ "completed": "CAPABILITY" | "ROLE" }`, sent by
 * "Tiếp tục" on ACC-07 and ACC-08 after the stage's own data is saved.
 *
 * Records that the stage was passed, once and with the server's time. A stage
 * can be passed only when every stage before it is: otherwise nothing is
 * written and the answer names what is missing. After onboarding is complete
 * the call changes nothing. Any other field, a client timestamp included, is
 * refused.
 */
export async function passStage(accountId: string, body: unknown): Promise<OnboardingState> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('body', 'invalid')
  }
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (key !== 'completed') throw invalid(key, 'not_accepted')
  }
  const stage = input.completed
  if (stage !== 'CAPABILITY' && stage !== 'ROLE') throw invalid('completed', 'unsupported')

  const state = await getOnboardingState(accountId)
  if (state.completed) return state
  if (!canOpen(state, stage)) {
    const missing = state.current_step === 'CAPABILITY' ? 'capability_stage' : 'basic_stage'
    throw new ApiError(
      'ONBOARDING_REQUIREMENTS_MISSING',
      422,
      'An earlier onboarding stage is not complete.',
      { [missing]: 'missing' },
    )
  }
  // FB-09 (US-01.09): stage 2 is passed only with at least one domain and one
  // specialisation; "Lưu và hoàn tất sau" saves without passing it.
  if (stage === 'CAPABILITY') {
    const [counts] = await query<{ domains: number; specializations: number }>(
      `SELECT (SELECT count(*)::int FROM profile_domains d WHERE d.profile_id = p.id) AS domains,
              (SELECT count(*)::int FROM profile_specializations s WHERE s.profile_id = p.id)
                AS specializations
         FROM individual_profiles p WHERE p.account_id = $1`,
      [accountId],
    )
    const missing: Record<string, string> = {}
    if (!counts?.domains) missing.domains = 'missing'
    if (!counts?.specializations) missing.specializations = 'missing'
    if (Object.keys(missing).length > 0) {
      throw new ApiError(
        'ONBOARDING_REQUIREMENTS_MISSING',
        422,
        'At least one domain and one specialisation are required.',
        missing,
      )
    }
  }
  const column = STAGE_MARKERS[stage]
  await query(
    `UPDATE individual_profiles
        SET ${column} = COALESCE(${column}, now()), updated_at = now()
      WHERE account_id = $1`,
    [accountId],
  )
  return getOnboardingState(accountId)
}

/**
 * PUT /me/onboarding/intent (05 §4.2, amended by DEC-WF01-RESUME-D1). Kept as
 * contracted; since DEC-L1R-D3 no onboarding screen calls it and the resolver
 * does not read what it writes.
 *
 *   { "action": "SAVE", "primary_intent": "<P0 code>" }   (action may be omitted: frozen shape)
 *   { "action": "SKIP" }                                   "Bỏ qua, làm sau"
 *
 * SAVE stores the intent (exact allowlist, DEC-WF01-S05-D1); SKIP stores no
 * intent and leaves an existing one untouched. Both record the Purpose step
 * once (`purpose_step_completed_at`, server time, never reset). Any other
 * field — a client timestamp included — is refused. The first write creates
 * the DRAFT profile; UNIQUE account_id keeps it one per account.
 */
export async function submitPurpose(accountId: string, body: unknown): Promise<OnboardingState> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('body', 'invalid')
  }
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (key !== 'action' && key !== 'primary_intent') throw invalid(key, 'not_accepted')
  }
  const action = input.action ?? 'SAVE'

  if (action === 'SKIP') {
    if ('primary_intent' in input) throw invalid('primary_intent', 'not_allowed_with_skip')
    await query(
      `INSERT INTO individual_profiles (account_id, purpose_step_completed_at) VALUES ($1, now())
       ON CONFLICT (account_id) DO UPDATE
         SET purpose_step_completed_at =
               COALESCE(individual_profiles.purpose_step_completed_at, now()),
             updated_at = now()`,
      [accountId],
    )
    return getOnboardingState(accountId)
  }
  if (action !== 'SAVE') throw invalid('action', 'unsupported')
  if (!isPrimaryIntent(input.primary_intent)) {
    throw new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Unsupported primary intent.', {
      primary_intent: 'unsupported',
    })
  }
  await query(
    `INSERT INTO individual_profiles (account_id, primary_intent, purpose_step_completed_at)
     VALUES ($1, $2, now())
     ON CONFLICT (account_id) DO UPDATE
       SET primary_intent = EXCLUDED.primary_intent,
           purpose_step_completed_at =
             COALESCE(individual_profiles.purpose_step_completed_at, now()),
           updated_at = now()`,
    [accountId, input.primary_intent],
  )
  return getOnboardingState(accountId)
}

/** Frozen-shape helper kept for callers that only save an intent. */
export async function setPrimaryIntent(
  accountId: string,
  value: unknown,
): Promise<OnboardingState> {
  return submitPurpose(accountId, { action: 'SAVE', primary_intent: value })
}
