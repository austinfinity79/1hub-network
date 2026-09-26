import type { Executor } from '@/lib/db/client'

/**
 * The ONE product analytics writer (API 05 §10; DEC-WF01-S08-D8), over the
 * existing `analytics_events` table. Written in the caller's transaction so
 * an event exists only if the change it describes committed.
 *
 * Only frozen P0 event names, and only the frozen common properties plus
 * small non-personal numbers. Never profile text, contact data or consent
 * content (05 §10: "Do not put private profile content into analytics").
 */
export type AnalyticsEventName =
  'account_created' | 'onboarding_completed' | 'profile_completion_changed'

export async function trackEvent(
  exec: Executor,
  event: {
    name: AnalyticsEventName
    accountId: string
    /** Null when the account has no profile yet (e.g. account_created). */
    profileId: string | null
    workflow: 'WF01' | 'WF02'
    screenId: string
    /** Non-personal extras, e.g. completion percentages. */
    extra?: Record<string, number>
  },
): Promise<void> {
  await exec(
    `INSERT INTO analytics_events (account_id, event_name, properties)
     VALUES ($1::uuid, $2, jsonb_build_object(
       'event_name', $2::text, 'occurred_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
       'account_id', $1::uuid::text, 'profile_id', $3::text, 'workflow', $4::text, 'screen_id', $5::text
     ) || $6::jsonb)`,
    [
      event.accountId,
      event.name,
      event.profileId,
      event.workflow,
      event.screenId,
      JSON.stringify(event.extra ?? {}),
    ],
  )
}

/**
 * profile_completion_changed, only when the authoritative percent actually
 * moved. Profile edits happen in onboarding (WF01-S06) until onboarding is
 * complete, and in the profile editor (WF02-S02) after.
 */
export async function trackCompletionChange(
  exec: Executor,
  change: { accountId: string; profileId: string; from: number; to: number; onboarded: boolean },
): Promise<void> {
  if (change.from === change.to) return
  await trackEvent(exec, {
    name: 'profile_completion_changed',
    accountId: change.accountId,
    profileId: change.profileId,
    workflow: change.onboarded ? 'WF02' : 'WF01',
    screenId: change.onboarded ? 'WF02-S02' : 'WF01-S06',
    extra: { from_percent: change.from, to_percent: change.to },
  })
}
