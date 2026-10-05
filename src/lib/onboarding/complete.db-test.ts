import { afterAll, describe, expect, it } from 'vitest'

import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { closePool, query } from '@/lib/db/client'
import { getProfileCompletion } from '@/lib/profile/completion'
import { updateOwnProfile } from '@/lib/profile/profile'

import { completeOnboarding } from './complete'
import { saveDeclaredRoles } from './roles'
import { acceptBoth, fillBasic, passStages } from './testing'
import * as steps from './testing'

/**
 * Onboarding completion against live PostgreSQL (DEC-L1R-D6).
 * DEC-WF01-S08-D5 (NULL intent) and D8 (audit + analytics once) still hold.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'

afterAll(async () => {
  await closePool()
})

const newAccount = () => steps.newAccount('cmp')
const readyAccount = () => steps.readyAccount('cmp')

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
    ['full_name', { full_name: null }],
    ['display_name', { display_name: null }],
    ['country_id', { country_id: null }],
    ['region_id', { region_id: null }],
  ] as const)('missing %s → 422 and nothing changes', async (field, patch) => {
    const accountId = await newAccount()
    await fillBasic(accountId)
    await passStages(accountId)
    await updateOwnProfile(accountId, patch)
    await acceptBoth(accountId)
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
      await fillBasic(accountId)
      await passStages(accountId)
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
        full_name: 'missing',
        display_name: 'missing',
        country_id: 'missing',
        region_id: 'missing',
        capability_stage: 'missing',
        role_stage: 'missing',
        TERMS_ACCEPTANCE: 'missing',
        PRIVACY_DATA_PROCESSING: 'missing',
      },
    })
    expect(await profileRow(accountId)).toEqual([])
  })

  it('stage 1 data and both acceptances are not enough: stages 2 and 3 must be passed', async () => {
    const accountId = await newAccount()
    await fillBasic(accountId)
    await acceptBoth(accountId)
    await expect(completeOnboarding(accountId, 'r')).rejects.toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
      fields: { capability_stage: 'missing', role_stage: 'missing' },
    })
    expect(await profileRow(accountId)).toMatchObject([{ status: 'DRAFT', completed_at: null }])
  })

  it('completes below 80%, with NULL intent, no headline, avatar or bio', async () => {
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
    // Full name, location and stage 2's minimum (one domain, one specialisation): 4 of 12.
    expect(result.completion_percent).toBe(33)
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

  it('without a HUB unit named, creates no membership and changes none', async () => {
    const accountId = await readyAccount()
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source)
       SELECT id, $2, 'PENDING_APPROVAL', 'SELF_DECLARED' FROM individual_profiles WHERE account_id = $1`,
      [accountId, CHAPTER_01],
    )
    await completeOnboarding(accountId, 'r')
    expect(await memberships(accountId)).toEqual([
      {
        organization_id: CHAPTER_01,
        state: 'PENDING_APPROVAL',
        source: 'SELF_DECLARED',
        claimed_position: null,
        claimed_period: null,
        hub_declaration: false,
      },
    ])
  })
})

const memberships = (accountId: string) =>
  query<{
    organization_id: string
    state: string
    source: string
    claimed_position: string | null
    claimed_period: string | null
    hub_declaration: boolean
  }>(
    `SELECT m.organization_id::text, m.state::text AS state, m.source, m.claimed_position,
            m.claimed_period, m.hub_declaration
       FROM community_memberships m
       JOIN individual_profiles p ON p.id = m.profile_id
      WHERE p.account_id = $1 ORDER BY m.organization_id`,
    [accountId],
  )

describe('HUB units named in stage 3', () => {
  const declare = (accountId: string) =>
    saveDeclaredRoles(accountId, {
      roles: ['HUB_MEMBER', 'INNOVATOR'],
      hub_claims: [
        { organization_id: CHAPTER_01, position: 'Phó trưởng chapter', period: '2024 – nay' },
        { organization_id: CHAPTER_02 },
      ],
    })

  it('become pending, self-declared requests on completion, once, and grant nothing', async () => {
    const accountId = await readyAccount()
    await declare(accountId)
    // Until completion the units are a draft: no membership exists.
    expect(await memberships(accountId)).toEqual([])

    await completeOnboarding(accountId, 'req-claims')
    // DEC-PDF-D6B: a declaration, which only a Platform Admin verifies.
    const pending = { state: 'PENDING_APPROVAL', source: 'SELF_DECLARED', hub_declaration: true }
    const filed = [
      {
        ...pending,
        organization_id: CHAPTER_01,
        claimed_position: 'Phó trưởng chapter',
        claimed_period: '2024 – nay',
      },
      { ...pending, organization_id: CHAPTER_02, claimed_position: null, claimed_period: null },
    ]
    expect(await memberships(accountId)).toEqual(filed)

    const audit = await query<{ after_data: unknown; request_id: string }>(
      `SELECT after_data, request_id FROM audit_events
        WHERE actor_account_id = $1 AND action = 'MEMBERSHIP_REQUESTED'
        ORDER BY after_data->>'organization_id'`,
      [accountId],
    )
    expect(audit).toEqual(
      [CHAPTER_01, CHAPTER_02].map((organization_id) => ({
        after_data: { organization_id, state: 'PENDING_APPROVAL' },
        request_id: 'req-claims',
      })),
    )
    const [draft] = await query<{ claims: unknown[] }>(
      'SELECT onboarding_hub_claims AS claims FROM individual_profiles WHERE account_id = $1',
      [accountId],
    )
    expect(draft!.claims).toEqual([])

    // A repeat files nothing again.
    await completeOnboarding(accountId, 'req-again')
    expect(await memberships(accountId)).toEqual(filed)

    // No leadership, no RoleAssignment, no capability, no managed scope.
    const [granted] = await query<{ leadership: number; roles: number }>(
      `SELECT (SELECT count(*)::int FROM leadership_records l WHERE l.profile_id = p.id) AS leadership,
              (SELECT count(*)::int FROM role_assignments r
                WHERE r.individual_profile_id = p.id) AS roles
         FROM individual_profiles p WHERE p.account_id = $1`,
      [accountId],
    )
    expect(granted).toEqual({ leadership: 0, roles: 0 })
    const actor = await resolveActor(accountId)
    expect(deriveCapabilities(actor)).toEqual([])
    expect(deriveManagedScopes(actor)).toEqual([])
  })

  it('skip a unit where a membership already stands, and leave that record as it is', async () => {
    const accountId = await readyAccount()
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source)
       SELECT id, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED' FROM individual_profiles
        WHERE account_id = $1`,
      [accountId, CHAPTER_01],
    )
    await declare(accountId)
    await completeOnboarding(accountId, 'r')
    expect(await memberships(accountId)).toEqual([
      {
        organization_id: CHAPTER_01,
        state: 'ACTIVE',
        source: 'ORGANIZATION_VERIFIED',
        claimed_position: null,
        claimed_period: null,
        hub_declaration: false,
      },
      {
        organization_id: CHAPTER_02,
        state: 'PENDING_APPROVAL',
        source: 'SELF_DECLARED',
        claimed_position: null,
        claimed_period: null,
        hub_declaration: true,
      },
    ])
  })

  it('are not filed when completion is refused', async () => {
    const accountId = await newAccount()
    await fillBasic(accountId)
    await passStages(accountId)
    await declare(accountId)
    await expect(completeOnboarding(accountId, 'r')).rejects.toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
    })
    expect(await memberships(accountId)).toEqual([])
    const [draft] = await query<{ n: number }>(
      `SELECT jsonb_array_length(onboarding_hub_claims) AS n FROM individual_profiles
        WHERE account_id = $1`,
      [accountId],
    )
    expect(draft!.n).toBe(2)
  })
})

describe('analytics', () => {
  it('profile_completion_changed only when the authoritative percent moves; no content', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, { full_name: 'Secret Name' })
    await updateOwnProfile(accountId, { full_name: 'Secret Name' })
    await updateOwnProfile(accountId, { headline: 'Secret Headline' })
    const events = await query<{ properties: Record<string, unknown> }>(
      `SELECT properties FROM analytics_events
        WHERE account_id = $1 AND event_name = 'profile_completion_changed' ORDER BY occurred_at, id`,
      [accountId],
    )
    expect(events.map((e) => [e.properties.from_percent, e.properties.to_percent])).toEqual([
      [0, 8],
      [8, 17],
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
