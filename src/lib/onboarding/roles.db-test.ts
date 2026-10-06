import { afterAll, describe, expect, it } from 'vitest'

import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { closePool, query } from '@/lib/db/client'

import { completeOnboarding } from './complete'
import { DECLARED_ROLES, getDeclaredRoles, saveDeclaredRoles } from './roles'
import { getOnboardingState } from './state'
import { newAccount, readyAccount } from './testing'

/**
 * WF01 stage 3 (ACC-08) — self-declared roles and HUB units against live
 * PostgreSQL (DEC-L1R-D5). The declaration is data about the member; it is
 * never an authorization input.
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'

const createdOrgs: string[] = []

afterAll(async () => {
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [createdOrgs])
  await closePool()
})

async function org(type: string, status: string): Promise<string> {
  const slug = `t-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const [row] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ($1::org_type, $2, $3, $4::publication_status) RETURNING id::text`,
    [type, slug, `Test ${type} ${status}`, status],
  )
  createdOrgs.push(row!.id)
  return row!.id
}

const stored = async (accountId: string) =>
  (
    await query<{ profiles: number; roles: number; claims: number; memberships: number }>(
      `SELECT (SELECT count(*)::int FROM individual_profiles p WHERE p.account_id = a.id) AS profiles,
              (SELECT count(*)::int FROM profile_declared_roles r
                 JOIN individual_profiles p ON p.id = r.profile_id
                WHERE p.account_id = a.id) AS roles,
              coalesce((SELECT jsonb_array_length(p.onboarding_hub_claims)
                          FROM individual_profiles p WHERE p.account_id = a.id), 0) AS claims,
              (SELECT count(*)::int FROM community_memberships m
                 JOIN individual_profiles p ON p.id = m.profile_id
                WHERE p.account_id = a.id) AS memberships
         FROM user_accounts a WHERE a.id = $1`,
      [accountId],
    )
  )[0]!

describe('declared roles', () => {
  it('are exactly the six roles ACC-08 draws', () => {
    expect([...DECLARED_ROLES]).toEqual([
      'HUB_MEMBER',
      'INNOVATOR',
      'STARTUP_FOUNDER',
      'ORGANIZATION_REPRESENTATIVE',
      'INVESTOR_REPRESENTATIVE',
      'INNOVATION_ENTHUSIAST',
    ])
  })

  it('an account that declared nothing reads as empty, without a profile being created', async () => {
    const accountId = await newAccount('role')
    expect(await getDeclaredRoles(accountId)).toEqual({ roles: [], hub_claims: [] })
    expect(await stored(accountId)).toMatchObject({ profiles: 0 })
  })

  it('are multi-select, replaced as a whole, and returned in the order of ACC-08', async () => {
    const accountId = await newAccount('role')
    expect(
      await saveDeclaredRoles(accountId, {
        roles: ['STARTUP_FOUNDER', 'INNOVATOR', 'STARTUP_FOUNDER'],
      }),
    ).toEqual({ roles: ['INNOVATOR', 'STARTUP_FOUNDER'], hub_claims: [] })
    expect(await saveDeclaredRoles(accountId, { roles: ['INNOVATION_ENTHUSIAST'] })).toEqual({
      roles: ['INNOVATION_ENTHUSIAST'],
      hub_claims: [],
    })
    expect(await saveDeclaredRoles(accountId, { roles: [] })).toEqual({
      roles: [],
      hub_claims: [],
    })
    expect(await stored(accountId)).toEqual({ profiles: 1, roles: 0, claims: 0, memberships: 0 })
  })

  it.each([
    [{ roles: ['PLATFORM_ADMIN'] }, 'roles'],
    [{ roles: ['HUB_COMMUNITY_LEADER'] }, 'roles'],
    [{ roles: ['hub_member'] }, 'roles'],
    [{ roles: 'HUB_MEMBER' }, 'roles'],
    [{}, 'roles'],
    [{ roles: [], role_code: 'PLATFORM_ADMIN' }, 'role_code'],
    [{ roles: [], capabilities: ['membership:confirm'] }, 'capabilities'],
    [{ roles: [], status: 'ACTIVE' }, 'status'],
    [null, 'body'],
    [[], 'body'],
  ] as const)('refuses %j and writes nothing', async (body, field) => {
    const accountId = await newAccount('role')
    await expect(saveDeclaredRoles(accountId, body)).rejects.toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      status: 422,
      fields: { [field]: expect.any(String) },
    })
    expect(await stored(accountId)).toMatchObject({ profiles: 0, roles: 0 })
  })
})

/** A complete S1-UAT-03 position row (US-01.11); overrides change one field. */
const claim = (over: Record<string, unknown>) => ({
  level: 'CHAPTER',
  organization_id: CHAPTER_01,
  position: 'MEMBER',
  from: '2024-01',
  current: true,
  ...over,
})

describe('HUB units', () => {
  it('are kept as a draft with level, position and term; no membership exists yet', async () => {
    const accountId = await newAccount('role')
    const saved = await saveDeclaredRoles(accountId, {
      roles: ['HUB_MEMBER'],
      hub_claims: [
        claim({
          level: 'CLB',
          organization_id: CLUB_01,
          position: 'OTHER',
          position_other: ' Cố vấn ',
        }),
        claim({ position: 'VICE_CHAIR', from: '2023-02' }),
        claim({
          level: 'HUB',
          organization_id: HUB.toUpperCase(),
          position: 'HEAD_OF_BOARD',
          board_name: 'Đối ngoại',
          current: false,
          from: '2021-01',
          to: '2022-12',
        }),
      ],
    })
    expect(saved).toEqual({
      roles: ['HUB_MEMBER'],
      hub_claims: [
        {
          level: 'HUB',
          organization: { id: HUB, name: 'HUB Network', type: 'HUB' },
          chapter: null,
          position: 'HEAD_OF_BOARD',
          board_name: 'Đối ngoại',
          position_other: null,
          from: '2021-01',
          to: '2022-12',
          current: false,
          status: 'PENDING',
          title: 'Trưởng Ban Đối ngoại',
          period: '01/2021 – 12/2022',
        },
        {
          level: 'CHAPTER',
          organization: { id: CHAPTER_01, name: 'Chapter 01', type: 'CHAPTER' },
          chapter: null,
          position: 'VICE_CHAIR',
          board_name: null,
          position_other: null,
          from: '2023-02',
          to: null,
          current: true,
          status: 'PENDING',
          title: 'Phó Chủ tịch',
          period: '02/2023 – Hiện tại',
        },
        {
          level: 'CLB',
          organization: { id: CLUB_01, name: 'Club 01', type: 'CLB' },
          chapter: { id: CHAPTER_01, name: 'Chapter 01', type: 'CHAPTER' },
          position: 'OTHER',
          board_name: null,
          position_other: 'Cố vấn',
          from: '2024-01',
          to: null,
          current: true,
          status: 'PENDING',
          title: 'Cố vấn',
          period: '01/2024 – Hiện tại',
        },
      ],
    })
    expect(await getDeclaredRoles(accountId)).toEqual(saved)
    expect(await stored(accountId)).toEqual({ profiles: 1, roles: 1, claims: 3, memberships: 0 })
  })

  it('leave with the HUB role: deselecting it needs the units removed', async () => {
    const accountId = await newAccount('role')
    await saveDeclaredRoles(accountId, { roles: ['HUB_MEMBER'], hub_claims: [claim({})] })
    await expect(
      saveDeclaredRoles(accountId, { roles: ['INNOVATOR'], hub_claims: [claim({})] }),
    ).rejects.toMatchObject({ fields: { hub_claims: 'requires_hub_member' } })
    expect(await saveDeclaredRoles(accountId, { roles: ['INNOVATOR'] })).toEqual({
      roles: ['INNOVATOR'],
      hub_claims: [],
    })
  })

  it('refuse a unit that is unknown, unpublished or not a HUB unit, all alike', async () => {
    const accountId = await newAccount('role')
    const draft = await org('CHAPTER', 'DRAFT')
    const company = await org('COMPANY', 'PUBLISHED')
    for (const organization_id of [draft, company, '10000000-0000-0000-0000-00000000ffff']) {
      await expect(
        saveDeclaredRoles(accountId, {
          roles: ['HUB_MEMBER'],
          hub_claims: [claim({ organization_id })],
        }),
      ).rejects.toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        fields: { hub_claims: 'organization_not_available' },
      })
    }
    for (const organization_id of ['chapter-01', 42, null]) {
      await expect(
        saveDeclaredRoles(accountId, {
          roles: ['HUB_MEMBER'],
          hub_claims: [claim({ organization_id })],
        }),
      ).rejects.toMatchObject({ fields: { hub_claims: 'organization_required' } })
    }
    expect(await stored(accountId)).toMatchObject({ roles: 0, claims: 0, memberships: 0 })
  })

  it.each([
    [[claim({}), claim({ from: '2024-03' })], 'duplicate_position'],
    [
      Array.from({ length: 11 }, (_, i) =>
        claim({ current: false, from: `20${10 + i}-01`, to: `20${10 + i}-02` }),
      ),
      'too_many',
    ],
    [[claim({ position: 'HEAD_OF_BOARD', board_name: 'x'.repeat(61) })], 'too_long'],
    [[claim({ position: 'OTHER', position_other: 'x'.repeat(61) })], 'too_long'],
    [[claim({ state: 'ACTIVE' })], 'invalid'],
    [[claim({ role_code: 'HUB_COMMUNITY_LEADER' })], 'invalid'],
    [[claim({ position: 7 })], 'position_required'],
    [
      [{ organization_id: CHAPTER_01, position: 'Trưởng chapter', period: '2024 – nay' }],
      'invalid',
    ],
    ['chapter-01', 'invalid'],
  ] as const)('refuse %j', async (hub_claims, reason) => {
    const accountId = await newAccount('role')
    await expect(
      saveDeclaredRoles(accountId, { roles: ['HUB_MEMBER'], hub_claims }),
    ).rejects.toMatchObject({ fields: { hub_claims: reason } })
    expect(await stored(accountId)).toMatchObject({ roles: 0, claims: 0 })
  })
})

describe('authorization', () => {
  it('a declaration grants no capability, scope, leadership or role assignment', async () => {
    const accountId = await newAccount('role')
    await saveDeclaredRoles(accountId, {
      roles: [...DECLARED_ROLES],
      hub_claims: [claim({ position: 'CHAIR' })],
    })
    const actor = await resolveActor(accountId)
    expect(deriveCapabilities(actor)).toEqual([])
    expect(deriveManagedScopes(actor)).toEqual([])
    const [granted] = await query<{ leadership: number; assignments: number }>(
      `SELECT (SELECT count(*)::int FROM leadership_records l WHERE l.profile_id = p.id) AS leadership,
              (SELECT count(*)::int FROM role_assignments r
                WHERE r.individual_profile_id = p.id) AS assignments
         FROM individual_profiles p WHERE p.account_id = $1`,
      [accountId],
    )
    expect(granted).toEqual({ leadership: 0, assignments: 0 })
    // Declaring does not pass a stage or complete onboarding either.
    expect((await getOnboardingState(accountId)).current_step).toBe('INTRO')
  })

  it('after onboarding is complete the declaration cannot be rewritten here', async () => {
    const accountId = await readyAccount('role')
    await saveDeclaredRoles(accountId, { roles: ['HUB_MEMBER'], hub_claims: [claim({})] })
    await completeOnboarding(accountId, 'r')
    await expect(
      saveDeclaredRoles(accountId, { roles: ['INNOVATOR'], hub_claims: [] }),
    ).rejects.toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      status: 422,
      fields: { onboarding: 'completed' },
    })
    expect(await getDeclaredRoles(accountId)).toEqual({ roles: ['HUB_MEMBER'], hub_claims: [] })
    expect(await stored(accountId)).toMatchObject({ roles: 1, claims: 0, memberships: 1 })
  })
})
