/**
 * WF04-T00 — the demo route map frozen by the WF04 audit (architecture 04 A2).
 *
 * Kept apart from `src/lib/routes.ts`, which mirrors the WF01–WF03 Screen
 * Contracts only. Screens are added by their own tasks (S01–S08); until then a
 * route without a screen is the ordinary 404, never a placeholder page, and
 * nothing links to it.
 */

export const DEMO_PROGRAMMES_PATH = '/demo/programmes'

export const SETUP_STEPS = ['basic', 'journey', 'events', 'registration', 'team', 'review'] as const
export type SetupStep = (typeof SETUP_STEPS)[number]

/** Screen ids of the WF04 plan, for traceability. */
export const SETUP_STEP_SCREEN: Record<SetupStep, string> = {
  basic: 'WF04-S02',
  journey: 'WF04-S03',
  events: 'WF04-S04',
  registration: 'WF04-S05',
  team: 'WF04-S06',
  review: 'WF04-S07',
}

export const demoRoutes = {
  list: () => DEMO_PROGRAMMES_PATH,
  create: () => `${DEMO_PROGRAMMES_PATH}/new`,
  detail: (id: string) => `${DEMO_PROGRAMMES_PATH}/${encodeURIComponent(id)}`,
  setup: (id: string, step: SetupStep) =>
    `${DEMO_PROGRAMMES_PATH}/${encodeURIComponent(id)}/setup/${step}`,
} as const

/** The step after `step` in the frozen order, or null after review. */
export function nextSetupStep(step: SetupStep): SetupStep | null {
  return SETUP_STEPS[SETUP_STEPS.indexOf(step) + 1] ?? null
}

/** The step before `step`, or null before basic (back goes to the detail). */
export function previousSetupStep(step: SetupStep): SetupStep | null {
  const at = SETUP_STEPS.indexOf(step)
  return at > 0 ? SETUP_STEPS[at - 1]! : null
}

export function isSetupStep(value: string): value is SetupStep {
  return (SETUP_STEPS as readonly string[]).includes(value)
}
