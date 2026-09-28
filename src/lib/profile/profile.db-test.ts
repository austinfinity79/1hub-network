import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, query } from '@/lib/db/client'
import { isValidAvatar, saveAvatarAsset } from '@/lib/media/avatar-storage'
import { getOnboardingState } from '@/lib/onboarding/state'
import { listVocabularyItems } from '@/lib/vocabulary/vocabulary'

import {
  COMPLETION_GROUPS,
  computeCompletion,
  getProfileCompletion,
  loadCompletionFacts,
} from './completion'
import { getOwnProfile, updateOwnProfile } from './profile'

/**
 * WF01-S06 — profile, vocabulary and completion against live PostgreSQL.
 * DEC-WF01-S06-D1 (DOMAIN+SKILL), D3 (avatar); DEC-L1R-D4 (stage 1 and 2
 * fields, at most five specialisations).
 * Vocabulary items here are test data with unique slugs, never taxonomy.
 */

const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const V: Record<string, string> = {}

async function item(key: string, type: string, status = 'ACTIVE') {
  const [row] = await query<{ id: string }>(
    `INSERT INTO vocabulary_items (type_code, slug, label, sort_order, status)
     VALUES ($1, $2, $3, 900, $4::vocab_status) RETURNING id::text`,
    [type, `t-${run}-${key}`, `Test ${key} ${run}`, status],
  )
  V[key] = row!.id
}

beforeAll(async () => {
  await item('region', 'REGION')
  await item('region2', 'REGION')
  await item('regionOld', 'REGION', 'ARCHIVED')
  for (const k of ['d1', 'd2', 'd3', 'd4', 'd5', 'd6']) await item(k, 'DOMAIN')
  await item('dOld', 'DOMAIN', 'ARCHIVED')
  for (const k of ['s1', 's2', 's3']) await item(k, 'SKILL')
  await item('sOld', 'SKILL', 'ARCHIVED')
  await item('country', 'COUNTRY')
  for (const k of ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']) await item(k, 'SPECIALIZATION')
})

afterAll(async () => {
  // Test items must not surface in ACTIVE pickers (and the S06 chip count) later.
  await query(`UPDATE vocabulary_items SET status = 'ARCHIVED' WHERE slug LIKE $1`, [`t-${run}-%`])
  await closePool()
})

async function newAccount(): Promise<string> {
  const email = `prf-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

const profileId = async (accountId: string) =>
  (
    await query<{ id: string }>('SELECT id::text FROM individual_profiles WHERE account_id = $1', [
      accountId,
    ])
  )[0]!.id

const rejects = (accountId: string, body: unknown, code: string, field?: string) =>
  expect(updateOwnProfile(accountId, body)).rejects.toMatchObject({
    code,
    status: code === 'PROFILE_DEACTIVATED' ? 409 : 422,
    ...(field ? { fields: expect.objectContaining({ [field]: expect.any(String) }) } : {}),
  })

describe('completion service — ten groups, ten points each', () => {
  it('lists exactly the frozen groups, HEADLINE third, no NETWORK_CONTEXT', () => {
    expect([...COMPLETION_GROUPS]).toEqual([
      'DISPLAY_NAME',
      'AVATAR',
      'HEADLINE',
      'REGION',
      'BIO',
      'DOMAIN',
      'SKILLS',
      'EXPERIENCE',
      'DEVELOPMENT_GOAL',
      'CURRENT_NEED',
    ])
  })

  it('no profile scores 0%', async () => {
    expect((await getProfileCompletion(await newAccount())).percent).toBe(0)
  })

  it('adds 10 points per group, 0% to 100%, one group at a time', async () => {
    const accountId = await newAccount()
    await query('INSERT INTO individual_profiles (account_id) VALUES ($1)', [accountId])
    const pid = await profileId(accountId)
    const set = (sql: string, params: unknown[] = []) => query(sql, [pid, ...params])
    const steps: (() => Promise<unknown>)[] = [
      () => set(`UPDATE individual_profiles SET display_name = 'A' WHERE id = $1`),
      async () => {
        const asset = await saveAvatarAsset(
          accountId,
          new Uint8Array([0xff, 0xd8, 0xff, 0]),
          'image/jpeg',
        )
        await set('UPDATE individual_profiles SET avatar_asset_id = $2 WHERE id = $1', [asset])
      },
      () => set(`UPDATE individual_profiles SET headline = 'H' WHERE id = $1`),
      () => set('UPDATE individual_profiles SET region_vocab_id = $2 WHERE id = $1', [V.region]),
      () => set(`UPDATE individual_profiles SET bio = 'B' WHERE id = $1`),
      () => set('INSERT INTO profile_domains VALUES ($1, $2)', [V.d1]),
      () => set('INSERT INTO profile_skills VALUES ($1, $2)', [V.s1]),
      () => set('UPDATE individual_profiles SET no_experience_yet = true WHERE id = $1'),
      () => set(`UPDATE individual_profiles SET development_goal = 'G' WHERE id = $1`),
      () => set(`UPDATE individual_profiles SET current_need = 'N' WHERE id = $1`),
    ]
    expect((await getProfileCompletion(accountId)).percent).toBe(0)
    for (const [i, step] of steps.entries()) {
      await step()
      const completion = await getProfileCompletion(accountId)
      expect(completion.percent, COMPLETION_GROUPS[i]).toBe((i + 1) * 10)
      expect(completion.groups[i]).toEqual({
        code: COMPLETION_GROUPS[i],
        complete: true,
        weight: 10,
      })
    }
  })

  it('whitespace-only text does not count', () => {
    const base = computeCompletion({
      display_name: '   ',
      avatar_valid: false,
      headline: '\n',
      region_valid: false,
      bio: ' ',
      domain_count: 0,
      skill_count: 0,
      experience_count: 0,
      no_experience_yet: false,
      development_goal: '',
      current_need: null,
    })
    expect(base.percent).toBe(0)
  })

  it('DOMAIN and SKILLS are independent groups', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, { domain_ids: [V.d1] })
    let groups = (await getProfileCompletion(accountId)).groups
    expect(groups.find((g) => g.code === 'DOMAIN')!.complete).toBe(true)
    expect(groups.find((g) => g.code === 'SKILLS')!.complete).toBe(false)

    await updateOwnProfile(accountId, { domain_ids: [], skill_ids: [V.s1] })
    groups = (await getProfileCompletion(accountId)).groups
    expect(groups.find((g) => g.code === 'DOMAIN')!.complete).toBe(false)
    expect(groups.find((g) => g.code === 'SKILLS')!.complete).toBe(true)

    await updateOwnProfile(accountId, { domain_ids: [V.d1], skill_ids: [V.s1] })
    groups = (await getProfileCompletion(accountId)).groups
    expect(
      groups.filter((g) => g.code === 'DOMAIN' || g.code === 'SKILLS').every((g) => g.complete),
    ).toBe(true)
  })

  it('EXPERIENCE: nothing → incomplete; no_experience_yet or a record → complete', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, { display_name: 'X' })
    const pid = await profileId(accountId)
    const experience = async () =>
      (await getProfileCompletion(accountId)).groups.find((g) => g.code === 'EXPERIENCE')!.complete
    expect(await experience()).toBe(false)
    await query('UPDATE individual_profiles SET no_experience_yet = true WHERE id = $1', [pid])
    expect(await experience()).toBe(true)
    await query('UPDATE individual_profiles SET no_experience_yet = false WHERE id = $1', [pid])
    await query(`INSERT INTO profile_experience (profile_id, title) VALUES ($1, 'Role')`, [pid])
    expect(await experience()).toBe(true)
  })

  it('an archived relation already linked still counts', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, { display_name: 'X' })
    const pid = await profileId(accountId)
    await query('UPDATE individual_profiles SET region_vocab_id = $2 WHERE id = $1', [
      pid,
      V.regionOld,
    ])
    await query('INSERT INTO profile_domains VALUES ($1, $2)', [pid, V.dOld])
    await query('INSERT INTO profile_skills VALUES ($1, $2)', [pid, V.sOld])
    const done = (await getProfileCompletion(accountId)).groups.filter((g) => g.complete)
    expect(done.map((g) => g.code)).toEqual(['DISPLAY_NAME', 'REGION', 'DOMAIN', 'SKILLS'])
  })

  it('a dangling or foreign avatar id is not a valid asset', async () => {
    const owner = await newAccount()
    const other = await newAccount()
    const asset = await saveAvatarAsset(owner, new Uint8Array([0xff, 0xd8, 0xff, 0]), 'image/jpeg')
    expect(await isValidAvatar(asset, owner)).toBe(true)
    expect(await isValidAvatar(asset, other)).toBe(false)
    expect(await isValidAvatar('asset_demo_member_avatar', owner)).toBe(false)
  })

  it('/me/profile carries the same figures as the service', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, { display_name: 'X', headline: 'H', region_id: V.region })
    const profile = await getOwnProfile(accountId)
    const completion = await getProfileCompletion(accountId)
    expect(profile.completion).toEqual({
      percent: completion.percent,
      completed_groups: completion.completed_groups,
      total_groups: 10,
    })
    expect(completion.percent).toBe(30)
  })
})

describe('PATCH /me/profile rules', () => {
  it('saves the six S06 fields into the right columns and relations', async () => {
    const accountId = await newAccount()
    const dto = await updateOwnProfile(accountId, {
      display_name: '  Đặng Kim Chi  ',
      headline: 'CEO',
      region_id: V.region,
      bio: 'Bio',
      domain_ids: [V.d1, V.d2],
      skill_ids: [V.s1],
    })
    expect(dto).toMatchObject({
      status: 'DRAFT',
      display_name: 'Đặng Kim Chi',
      headline: 'CEO',
      region: { id: V.region, status: 'ACTIVE' },
      bio: 'Bio',
    })
    expect(dto.domains.map((d) => d.id).sort()).toEqual([V.d1, V.d2].sort())
    expect(dto.skills.map((s) => s.id)).toEqual([V.s1])
    // DEC-WF01-S06-D2: saving S06 never activates or completes onboarding.
    const [row] = await query<{ status: string; onboarding_completed_at: Date | null }>(
      'SELECT status::text, onboarding_completed_at FROM individual_profiles WHERE account_id = $1',
      [accountId],
    )
    expect(row).toEqual({ status: 'DRAFT', onboarding_completed_at: null })
  })

  it('refuses completion_percent and any field outside the S06 set', async () => {
    const accountId = await newAccount()
    await rejects(
      accountId,
      { completion_percent: 100 },
      'PROFILE_VALIDATION_FAILED',
      'completion_percent',
    )
    for (const key of ['status', 'avatar_asset_id', 'onboarding_completed_at', 'primary_intent']) {
      await rejects(accountId, { [key]: 'x' }, 'PROFILE_VALIDATION_FAILED', key)
    }
    await rejects(accountId, null, 'PROFILE_VALIDATION_FAILED')
    await rejects(accountId, { display_name: 42 }, 'PROFILE_VALIDATION_FAILED', 'display_name')
    await rejects(accountId, { domain_ids: 'x' }, 'PROFILE_VALIDATION_FAILED', 'domain_ids')
  })

  it('wrong vocabulary type is refused on every canonical field', async () => {
    const accountId = await newAccount()
    await rejects(accountId, { region_id: V.d1 }, 'PROFILE_VALIDATION_FAILED', 'region_id')
    await rejects(accountId, { domain_ids: [V.s1] }, 'PROFILE_VALIDATION_FAILED', 'domain_ids')
    await rejects(accountId, { skill_ids: [V.d1] }, 'PROFILE_VALIDATION_FAILED', 'skill_ids')
    await rejects(
      accountId,
      { skill_ids: ['not-a-uuid'] },
      'PROFILE_VALIDATION_FAILED',
      'skill_ids',
    )
    await rejects(
      accountId,
      { domain_ids: ['00000000-0000-0000-0000-00000000dead'] },
      'PROFILE_VALIDATION_FAILED',
      'domain_ids',
    )
  })

  it('an archived item cannot be newly selected but may stay linked', async () => {
    const accountId = await newAccount()
    await rejects(accountId, { region_id: V.regionOld }, 'VOCABULARY_ITEM_INACTIVE', 'region_id')
    await rejects(accountId, { domain_ids: [V.dOld] }, 'VOCABULARY_ITEM_INACTIVE', 'domain_ids')
    await rejects(accountId, { skill_ids: [V.sOld] }, 'VOCABULARY_ITEM_INACTIVE', 'skill_ids')

    await updateOwnProfile(accountId, { display_name: 'X' })
    const pid = await profileId(accountId)
    await query('UPDATE individual_profiles SET region_vocab_id = $2 WHERE id = $1', [
      pid,
      V.regionOld,
    ])
    await query('INSERT INTO profile_domains VALUES ($1, $2)', [pid, V.dOld])

    // Readable, and resubmitting the existing archived links is accepted.
    const dto = await updateOwnProfile(accountId, {
      region_id: V.regionOld,
      domain_ids: [V.dOld, V.d1],
    })
    expect(dto.region).toMatchObject({ id: V.regionOld, status: 'ARCHIVED' })
    expect(dto.domains.map((d) => d.status).sort()).toEqual(['ACTIVE', 'ARCHIVED'])
  })

  it('ACC-07: at most 5 specialisations; domains and skills are not counted together', async () => {
    const accountId = await newAccount()
    await rejects(
      accountId,
      { specialization_ids: [V.p1, V.p2, V.p3, V.p4, V.p5, V.p6] },
      'PROFILE_VALIDATION_FAILED',
      'specialization_ids',
    )
    expect(await loadCompletionFacts(accountId)).toBeNull()
    await updateOwnProfile(accountId, {
      domain_ids: [V.d1, V.d2, V.d3, V.d4],
      specialization_ids: [V.p1, V.p2, V.p3, V.p4, V.p5],
      skill_ids: [V.s1, V.s2, V.s3],
    })
    const dto = await getOwnProfile(accountId)
    expect([dto.domains.length, dto.specializations.length, dto.skills.length]).toEqual([4, 5, 3])
    // A list is replaced as a whole, and an id of another type is refused.
    await updateOwnProfile(accountId, { specialization_ids: [V.p6] })
    expect((await getOwnProfile(accountId)).specializations.map((r) => r.id)).toEqual([V.p6])
    await rejects(
      accountId,
      { specialization_ids: [V.s1] },
      'PROFILE_VALIDATION_FAILED',
      'specialization_ids',
    )
    // Specialisations are not a completion group.
    expect(dto.completion.percent).toBe(20)
  })

  it('is atomic: a failure leaves scalars and both relations untouched', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, {
      display_name: 'Before',
      domain_ids: [V.d1],
      skill_ids: [V.s1],
    })
    const before = await getOwnProfile(accountId)
    // The last id is invalid: nothing of the valid parts may land.
    await rejects(
      accountId,
      { display_name: 'After', domain_ids: [V.d2], skill_ids: [V.s2, V.d3] },
      'PROFILE_VALIDATION_FAILED',
    )
    expect(await getOwnProfile(accountId)).toEqual(before)
  })

  it('a failed first save creates no profile', async () => {
    const accountId = await newAccount()
    await rejects(accountId, { display_name: 'X', skill_ids: [V.d1] }, 'PROFILE_VALIDATION_FAILED')
    expect(await loadCompletionFacts(accountId)).toBeNull()
  })

  it('a deactivated profile refuses edits', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, { display_name: 'X' })
    await query(`UPDATE individual_profiles SET status = 'DEACTIVATED' WHERE account_id = $1`, [
      accountId,
    ])
    await rejects(accountId, { display_name: 'Y' }, 'PROFILE_DEACTIVATED')
  })
})

describe('stage 1 fields (ACC-06)', () => {
  it('stores full name, country and phone; the step moves on only with the required four', async () => {
    const accountId = await newAccount()
    const step = async () => (await getOnboardingState(accountId)).current_step
    expect(await step()).toBe('INTRO')
    await updateOwnProfile(accountId, {
      full_name: '  Đặng Kim Chi ',
      display_name: 'Kim Chi Đặng',
      headline: 'Đồng sáng lập',
      phone: '+84 (0)90-123.4567',
    })
    expect(await step()).toBe('BASIC')
    await updateOwnProfile(accountId, { country_id: V.country!.toUpperCase() })
    expect(await step()).toBe('BASIC')
    await updateOwnProfile(accountId, { region_id: V.region })
    expect(await step()).toBe('CAPABILITY')
    expect((await getOnboardingState(accountId)).completed).toBe(false)

    const dto = await getOwnProfile(accountId)
    expect(dto).toMatchObject({
      full_name: 'Đặng Kim Chi',
      display_name: 'Kim Chi Đặng',
      phone: '+840901234567',
      country: { id: V.country, status: 'ACTIVE' },
      region: { id: V.region },
    })
    // Full name, country and phone are not completion groups.
    expect(dto.completion.percent).toBe(30)

    await updateOwnProfile(accountId, { phone: '  ' })
    expect((await getOwnProfile(accountId)).phone).toBeNull()
  })

  it.each([
    [{ phone: '12345' }, 'phone'],
    [{ phone: '1234567890123456' }, 'phone'],
    [{ phone: '090 123 4567 ext 2' }, 'phone'],
    [{ phone: 901234567 }, 'phone'],
    [{ full_name: 'x'.repeat(201) }, 'full_name'],
    [{ full_name: 42 }, 'full_name'],
    [{ country_id: 'vn' }, 'country_id'],
    [{ country_id: 42 }, 'country_id'],
  ] as const)('refuses %j', async (patch, field) => {
    const accountId = await newAccount()
    await rejects(accountId, patch, 'PROFILE_VALIDATION_FAILED', field)
    expect(await loadCompletionFacts(accountId)).toBeNull()
  })

  it('a country must be a COUNTRY item and a province a REGION item', async () => {
    const accountId = await newAccount()
    await rejects(accountId, { country_id: V.region }, 'PROFILE_VALIDATION_FAILED', 'country_id')
    await rejects(accountId, { region_id: V.country }, 'PROFILE_VALIDATION_FAILED', 'region_id')
  })
})

describe('stage 2 experience (ACC-07)', () => {
  it('stores period and description as months; an open end reads as current', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, {
      experience: [
        {
          title: 'Đồng sáng lập · CEO',
          organization_name: 'Tracely',
          started_on: '2022-02',
          ended_on: null,
          description: 'Dẫn đội 6 người',
        },
        { title: 'Trưởng bộ phận', started_on: '2017-05', ended_on: '2022-01' },
      ],
    })
    expect((await getOwnProfile(accountId)).experience).toMatchObject([
      {
        title: 'Đồng sáng lập · CEO',
        organization_name: 'Tracely',
        started_on: '2022-02',
        ended_on: null,
        description: 'Dẫn đội 6 người',
      },
      {
        title: 'Trưởng bộ phận',
        organization_name: null,
        started_on: '2017-05',
        ended_on: '2022-01',
        description: null,
      },
    ])
  })

  it('a save without period or description keeps them for the same title and organisation', async () => {
    const accountId = await newAccount()
    await updateOwnProfile(accountId, {
      experience: [
        { title: 'CEO', organization_name: 'Tracely', started_on: '2022-02', description: 'D' },
        { title: 'PM', organization_name: 'Other', started_on: '2019-01', ended_on: '2021-12' },
      ],
    })
    // The WF02-S02 editor sends title and organisation only.
    await updateOwnProfile(accountId, {
      experience: [
        { title: 'PM', organization_name: 'Renamed' },
        { title: 'CEO', organization_name: 'Tracely' },
      ],
    })
    expect((await getOwnProfile(accountId)).experience).toMatchObject([
      { title: 'PM', organization_name: 'Renamed', started_on: null, description: null },
      { title: 'CEO', organization_name: 'Tracely', started_on: '2022-02', description: 'D' },
    ])
    // An explicit null clears.
    await updateOwnProfile(accountId, {
      experience: [
        { title: 'CEO', organization_name: 'Tracely', started_on: null, description: null },
      ],
    })
    expect((await getOwnProfile(accountId)).experience).toMatchObject([
      { title: 'CEO', started_on: null, ended_on: null, description: null },
    ])
  })

  it.each([
    [{ title: 'x', started_on: '2020-13' }, 'invalid_month'],
    [{ title: 'x', started_on: '2020-1' }, 'invalid_month'],
    [{ title: 'x', started_on: '01/2020' }, 'invalid_month'],
    [{ title: 'x', started_on: 2020 }, 'invalid_month'],
    [{ title: 'x', ended_on: '2020-01' }, 'invalid_period'],
    [{ title: 'x', started_on: '2021-06', ended_on: '2021-05' }, 'invalid_period'],
    [{ title: 'x', description: 'x'.repeat(2001) }, 'too_long'],
    [{ title: 'x', is_current: true }, 'invalid'],
  ] as const)('refuses %j', async (record, reason) => {
    const accountId = await newAccount()
    await expect(updateOwnProfile(accountId, { experience: [record] })).rejects.toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      fields: { experience: reason },
    })
    expect(await loadCompletionFacts(accountId)).toBeNull()
  })
})

describe('vocabulary listing', () => {
  it('lists ACTIVE items of one type only, searchable, paged by cursor', async () => {
    const page = await listVocabularyItems('DOMAIN', { q: `t-${run}-d`, limit: 4 })
    expect(page.items.map((i) => i.id)).toEqual([V.d1, V.d2, V.d3, V.d4])
    expect(page.items.every((i) => i.status === 'ACTIVE')).toBe(true)
    const next = await listVocabularyItems('DOMAIN', {
      q: `t-${run}-d`,
      limit: 4,
      cursor: page.nextCursor!,
    })
    expect(next.items.map((i) => i.id)).toEqual([V.d5, V.d6])
    expect(next.nextCursor).toBeNull()

    const archived = await listVocabularyItems('DOMAIN', {
      q: `t-${run}`,
      status: 'ARCHIVED',
      limit: 50,
    })
    expect(archived.items.map((i) => i.id)).toEqual([V.dOld])
    const skills = await listVocabularyItems('SKILL', { q: `t-${run}-d`, limit: 50 })
    expect(skills.items).toEqual([])
  })
})
