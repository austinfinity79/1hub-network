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
 * DEC-WF01-S06-D1 (DOMAIN+SKILL), D2 (progression), D3 (avatar), D4 (max 5).
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
  const rejects = (accountId: string, body: unknown, code: string, field?: string) =>
    expect(updateOwnProfile(accountId, body)).rejects.toMatchObject({
      code,
      status: code === 'PROFILE_DEACTIVATED' ? 409 : 422,
      ...(field ? { fields: expect.objectContaining({ [field]: expect.any(String) }) } : {}),
    })

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

  it('DEC-WF01-S06-D4: at most 5 DOMAIN + SKILL items, counting what is kept', async () => {
    const accountId = await newAccount()
    await rejects(
      accountId,
      { domain_ids: [V.d1, V.d2, V.d3, V.d4], skill_ids: [V.s1, V.s2] },
      'PROFILE_VALIDATION_FAILED',
      'domain_ids',
    )
    await updateOwnProfile(accountId, { skill_ids: [V.s1, V.s2, V.s3] })
    // 3 kept skills + 3 domains = 6: refused even though domains alone is 3.
    await rejects(accountId, { domain_ids: [V.d1, V.d2, V.d3] }, 'PROFILE_VALIDATION_FAILED')
    await updateOwnProfile(accountId, { domain_ids: [V.d1, V.d2] })
    const dto = await getOwnProfile(accountId)
    expect(dto.domains.length + dto.skills.length).toBe(5)
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

describe('onboarding step after S06', () => {
  it('moves to PRIVACY only when name, headline, region and one expertise are saved', async () => {
    const accountId = await newAccount()
    await query(
      `INSERT INTO individual_profiles (account_id, primary_intent) VALUES ($1, 'EXPLORE_NETWORK')`,
      [accountId],
    )
    const step = async () => (await getOnboardingState(accountId)).current_step
    expect(await step()).toBe('PROFILE')
    await updateOwnProfile(accountId, { display_name: 'X', headline: 'H', region_id: V.region })
    expect(await step()).toBe('PROFILE')
    await updateOwnProfile(accountId, { skill_ids: [V.s1] })
    expect(await step()).toBe('PRIVACY')
    expect((await getOnboardingState(accountId)).completed).toBe(false)
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
