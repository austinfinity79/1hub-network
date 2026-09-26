import { afterAll, describe, expect, it } from 'vitest'

import { closePool, query, withTransaction } from '@/lib/db/client'
import { acceptConsent, getCurrentDocuments } from '@/lib/legal/legal'
import { getProfileCompletion } from '@/lib/profile/completion'
import { updateOwnProfile } from '@/lib/profile/profile'

import { completeOnboarding } from './complete'

/**
 * WF01-S08 — onboarding completion against live PostgreSQL.
 * DEC-WF01-S08-D1 (trigger), D5 (NULL intent), D8 (audit + analytics once).
 */

const REGION = '20000000-0000-0000-0000-000000000002'

afterAll(async () => {
  await closePool()
})

async function newAccount(): Promise<string> {
  const email = `cmp-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

async function acceptBoth(accountId: string, only?: string) {
  for (const doc of await getCurrentDocuments()) {
    if (only && doc.type !== only) continue
    await withTransaction((exec) =>
      acceptConsent(exec, accountId, { consent_type: doc.type, policy_version: doc.version }, 'r'),
    )
  }
}

/** The activation minimum and nothing else: name + region + both acceptances. */
async function readyAccount(): Promise<string> {
  const accountId = await newAccount()
  await updateOwnProfile(accountId, { display_name: 'Minimal', region_id: REGION })
  await acceptBoth(accountId)
  return accountId
}

async function profileRow(accountId: string) {
  const rows = await query<{ id: string; status: string; completed_at: Date | null }>(
    `SELECT id::text, status::text AS status, onboarding_completed_at AS completed_at
       FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
  return rows
}

const count = async (sql: string, accountId: string) =>
  (await query<{ n: number }>(sql, [accountId]))[0]!.n

const audits = (accountId: string) =>
  count(
    `SELECT count(*)::int AS n FROM audit_events WHERE actor_account_id = $1 AND action = 'PROFILE_ACTIVATED'`,
    accountId,
  )
const completedEvents = (accountId: string) =>
  count(
    `SELECT count(*)::int AS n FROM analytics_events WHERE account_id = $1 AND event_name = 'onboarding_completed'`,
    accountId,
  )

describe('activation requirements', () => {
  it.each([
    ['display_name', { region_id: REGION }, true],
    ['region_id', { display_name: 'X' }, true],
  ] as const)('missing %s → 422 and nothing changes', async (field, patch, legal) => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, patch)
    if (legal) await acceptBoth(accountId)
    await expect(completeOnboarding(accountId, 'r')).rejects.toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
      status: 422,
      fields: { [field]: 'missing' },
    })
    expect(await profileRow(accountId)).toMatchObject([{ status: 'DRAFT', completed_at: null }])
    expect(await audits(accountId)).toBe(0)
    expect(await completedEvents(accountId)).toBe(0)
  })

  it.each(['TERMS_ACCEPTANCE', 'PRIVACY_DATA_PROCESSING'])(
    'missing current %s → 422 naming it',
    async (missing) => {
      const accountId = await newAccount()
      await updateOwnProfile(accountId, { display_name: 'X', region_id: REGION })
      const other = missing === 'TERMS_ACCEPTANCE' ? 'PRIVACY_DATA_PROCESSING' : 'TERMS_ACCEPTANCE'
      await acceptBoth(accountId, other)
      await expect(completeOnboarding(accountId, 'r')).rejects.toMatchObject({
        code: 'ONBOARDING_REQUIREMENTS_MISSING',
        fields: { [missing]: 'missing' },
      })
      expect((await profileRow(accountId))[0]!.status).toBe('DRAFT')
    },
  )

  it('no profile at all reports every requirement', async () => {
    const accountId = await newAccount()
    await expect(completeOnboarding(accountId, 'r')).rejects.toMatchObject({
      fields: {
        display_name: 'missing',
        region_id: 'missing',
        TERMS_ACCEPTANCE: 'missing',
        PRIVACY_DATA_PROCESSING: 'missing',
      },
    })
    expect(await profileRow(accountId)).toEqual([])
  })

  it('completes below 80%, with NULL intent, no headline, expertise, avatar or bio', async () => {
    const accountId = await readyAccount()
    const [before] = await query<{ primary_intent: string | null; headline: string | null }>(
      'SELECT primary_intent, headline FROM individual_profiles WHERE account_id = $1',
      [accountId],
    )
    expect(before).toEqual({ primary_intent: null, headline: null })
    const result = await completeOnboarding(accountId, 'r')
    expect(result).toEqual({
      completed: true,
      profile_status: 'ACTIVE',
      completion_percent: (await getProfileCompletion(accountId)).percent,
      next: '/me',
    })
    expect(result.completion_percent).toBe(20)
  })
})

describe('lifecycle transition', () => {
  it('DRAFT → ACTIVE once; timestamp kept on repeat; audit and analytics once', async () => {
    const accountId = await readyAccount()
    await completeOnboarding(accountId, 'req-1')
    const [first] = await profileRow(accountId)
    expect(first).toMatchObject({ status: 'ACTIVE' })
    expect(first!.completed_at).toBeInstanceOf(Date)

    const again = await completeOnboarding(accountId, 'req-2')
    expect(again.profile_status).toBe('ACTIVE')
    const rows = await profileRow(accountId)
    expect(rows).toHaveLength(1)
    expect(rows[0]!.completed_at!.getTime()).toBe(first!.completed_at!.getTime())
    expect(await audits(accountId)).toBe(1)
    expect(await completedEvents(accountId)).toBe(1)

    const [audit] = await query<{ before_data: unknown; after_data: unknown; request_id: string }>(
      `SELECT before_data, after_data, request_id FROM audit_events
        WHERE actor_account_id = $1 AND action = 'PROFILE_ACTIVATED'`,
      [accountId],
    )
    expect(audit).toEqual({
      before_data: { status: 'DRAFT' },
      after_data: { status: 'ACTIVE' },
      request_id: 'req-1',
    })
  })

  it('concurrent completions make exactly one transition', async () => {
    const accountId = await readyAccount()
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => completeOnboarding(accountId, `c-${i}`)),
    )
    expect(results.every((r) => r.profile_status === 'ACTIVE')).toBe(true)
    expect(await audits(accountId)).toBe(1)
    expect(await completedEvents(accountId)).toBe(1)
  })

  it('an already ACTIVE, not yet onboarded profile completes without a second activation audit', async () => {
    const accountId = await readyAccount()
    await query(`UPDATE individual_profiles SET status = 'ACTIVE' WHERE account_id = $1`, [
      accountId,
    ])
    await completeOnboarding(accountId, 'r')
    expect(await audits(accountId)).toBe(0)
    expect(await completedEvents(accountId)).toBe(1)
  })

  it('a deactivated profile is refused', async () => {
    const accountId = await readyAccount()
    await query(`UPDATE individual_profiles SET status = 'DEACTIVATED' WHERE account_id = $1`, [
      accountId,
    ])
    await expect(completeOnboarding(accountId, 'r')).rejects.toMatchObject({
      code: 'PROFILE_DEACTIVATED',
    })
  })

  it('never creates or changes memberships', async () => {
    const accountId = await readyAccount()
    const [org] = await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE type = 'CHAPTER' LIMIT 1`,
    )
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source)
       SELECT id, $2, 'PENDING_APPROVAL', 'SELF_DECLARED' FROM individual_profiles WHERE account_id = $1`,
      [accountId, org!.id],
    )
    await completeOnboarding(accountId, 'r')
    const memberships = await query<{ state: string }>(
      `SELECT m.state::text FROM community_memberships m
         JOIN individual_profiles p ON p.id = m.profile_id WHERE p.account_id = $1`,
      [accountId],
    )
    expect(memberships).toEqual([{ state: 'PENDING_APPROVAL' }])
  })
})

describe('analytics', () => {
  it('profile_completion_changed only when the authoritative percent moves; no content', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, { display_name: 'Secret Name' })
    await updateOwnProfile(accountId, { display_name: 'Secret Name' })
    await updateOwnProfile(accountId, { headline: 'Secret Headline' })
    const events = await query<{ properties: Record<string, unknown> }>(
      `SELECT properties FROM analytics_events
        WHERE account_id = $1 AND event_name = 'profile_completion_changed' ORDER BY occurred_at, id`,
      [accountId],
    )
    expect(events.map((e) => [e.properties.from_percent, e.properties.to_percent])).toEqual([
      [0, 10],
      [10, 20],
    ])
    expect(Object.keys(events[0]!.properties).sort()).toEqual(
      [
        'account_id',
        'event_name',
        'from_percent',
        'occurred_at',
        'profile_id',
        'screen_id',
        'to_percent',
        'workflow',
      ].sort(),
    )
    expect(JSON.stringify(events)).not.toContain('Secret')
  })
})
