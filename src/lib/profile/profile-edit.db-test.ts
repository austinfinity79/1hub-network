import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'
import { saveAvatarAsset } from '@/lib/media/avatar-storage'

import { getProfileCompletion } from './completion'
import { getOwnProfile, updateOwnProfile } from './profile'

/**
 * WF02-S02 — PATCH /me/profile extensions against live PostgreSQL
 * (DEC-WF02-H1/H2, DEC-WF02-S02-D1..D3). The completion states are built from
 * canonical groups through the real services, never asserted by hand.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SKILL = '20000000-0000-0000-0000-000000000021'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

afterAll(async () => {
  await closePool()
})

async function account(): Promise<string> {
  const email = `edit-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

async function refusal(promise: Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status, fields: error.fields }
    throw error
  }
  throw new Error('expected a refusal')
}

const percent = async (id: string) => (await getProfileCompletion(id)).percent

describe('WF02-S02 profile edit', () => {
  it('completion matrix 0 → 10 → 70 → 80 → 90 → 100 from canonical groups', async () => {
    const id = await account()
    expect(await percent(id)).toBe(0)
    await updateOwnProfile(id, { display_name: 'Chi' })
    expect(await percent(id)).toBe(10)
    await updateOwnProfile(id, {
      headline: 'Founder',
      region_id: REGION,
      bio: 'Bio',
      domain_ids: [DOMAIN],
      skill_ids: [SKILL],
    })
    expect(await percent(id)).toBe(60)
    await updateOwnProfile(id, {
      experience: [{ title: 'Product Manager', organization_name: 'Tracely' }],
    })
    expect(await percent(id)).toBe(70)
    await updateOwnProfile(id, { development_goal: 'Xây sản phẩm khu vực công' })
    expect(await percent(id)).toBe(80)
    await updateOwnProfile(id, { current_need: 'Tìm cố vấn' })
    expect(await percent(id)).toBe(90)
    const asset = await saveAvatarAsset(id, PNG, 'image/png')
    await query('UPDATE individual_profiles SET avatar_asset_id = $2 WHERE account_id = $1', [
      id,
      asset,
    ])
    expect(await percent(id)).toBe(100)
    // Clearing a group lowers it again (valid clearing).
    await updateOwnProfile(id, { current_need: null, development_goal: '   ' })
    expect(await percent(id)).toBe(80)
    const dto = await getOwnProfile(id)
    expect(dto.completion.percent).toBe(80)
    expect(dto.development_goal).toBeNull()
  })

  it('experience list replaces as a whole; NO_EXPERIENCE_YET completes group 8; never both', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Chi' })
    const groups = async () =>
      (await getProfileCompletion(id)).groups.find((g) => g.code === 'EXPERIENCE')!.complete
    await updateOwnProfile(id, { no_experience_yet: true })
    expect(await groups()).toBe(true)
    expect((await getOwnProfile(id)).no_experience_yet).toBe(true)

    // Adding records while the flag stays set is refused, atomically.
    const refused = await refusal(
      updateOwnProfile(id, { headline: 'Changed', experience: [{ title: 'PM' }] }),
    )
    expect(refused).toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      status: 422,
      fields: { no_experience_yet: 'conflicts_with_experience' },
    })
    expect((await getOwnProfile(id)).headline).toBeNull()

    await updateOwnProfile(id, {
      no_experience_yet: false,
      experience: [{ title: 'PM', organization_name: 'A' }, { title: 'Dev' }],
    })
    const dto = await getOwnProfile(id)
    expect(dto.experience.map((e) => [e.title, e.organization_name])).toEqual([
      ['PM', 'A'],
      ['Dev', null],
    ])
    expect(await groups()).toBe(true)

    await updateOwnProfile(id, { experience: [] })
    expect(await groups()).toBe(false)
  })

  it('validates list items: titles required, unknown keys refused, technical bounds', async () => {
    const id = await account()
    for (const [body, field, reason] of [
      [{ experience: [{ title: '  ' }] }, 'experience', 'title_required'],
      [{ experience: [{ title: 'x', started_on: '2020-01-01' }] }, 'experience', 'invalid_month'],
      [{ experience: [{ title: 'x', employer: 'y' }] }, 'experience', 'invalid'],
      [{ experience: 'PM' }, 'experience', 'invalid'],
      [
        { experience: Array.from({ length: 21 }, () => ({ title: 't' })) },
        'experience',
        'too_many',
      ],
      [{ no_experience_yet: 'yes' }, 'no_experience_yet', 'invalid'],
      [{ development_goal: 42 }, 'development_goal', 'invalid'],
      [{ current_need: 'x'.repeat(2001) }, 'current_need', 'too_long'],
      [{ links: [{ url: 'javascript:alert(1)' }] }, 'links', 'invalid_url'],
      [{ links: [{ url: 'linkedin.com/in/x' }] }, 'links', 'invalid_url'],
      [{ links: [{ url: 'ftp://files.example' }] }, 'links', 'invalid_url'],
      [
        { links: Array.from({ length: 6 }, () => ({ url: 'https://a.example' })) },
        'links',
        'too_many',
      ],
    ] as const) {
      expect(await refusal(updateOwnProfile(id, body)), JSON.stringify(body)).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        fields: { [field]: reason },
      })
    }
  })

  it('links replace as a whole and keep order', async () => {
    const id = await account()
    await updateOwnProfile(id, {
      links: [
        { url: 'https://linkedin.com/in/chi', label: 'LinkedIn' },
        { url: 'https://github.com/chi' },
      ],
    })
    expect((await getOwnProfile(id)).links.map((l) => [l.label, l.url])).toEqual([
      ['LinkedIn', 'https://linkedin.com/in/chi'],
      [null, 'https://github.com/chi'],
    ])
    await updateOwnProfile(id, { links: [] })
    expect((await getOwnProfile(id)).links).toEqual([])
  })

  it('DEC-L2R-D3: education replaces as a whole, months as "YYYY-MM"; completion is untouched', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Chi' })
    const before = await percent(id)
    await updateOwnProfile(id, {
      education: [
        {
          institution: '  ĐH Bách khoa Hà Nội ',
          programme: ' Kỹ thuật phần mềm ',
          started_on: '2015-09',
          ended_on: '2020-06',
        },
        { institution: 'Fulbright', started_on: '2021-01' },
        { institution: 'Coursera', programme: '  ', started_on: null, ended_on: null },
      ],
    })
    const dto = await getOwnProfile(id)
    expect(
      dto.education.map((e) => [e.institution, e.programme, e.started_on, e.ended_on]),
    ).toEqual([
      ['ĐH Bách khoa Hà Nội', 'Kỹ thuật phần mềm', '2015-09', '2020-06'],
      ['Fulbright', null, '2021-01', null],
      ['Coursera', null, null, null],
    ])
    expect(dto.education.every((e) => typeof e.id === 'string')).toBe(true)
    // Replaced as a whole, in the order sent; a one-month period is allowed.
    await updateOwnProfile(id, {
      education: [{ institution: 'Fulbright', started_on: '2021-01', ended_on: '2021-01' }],
    })
    expect((await getOwnProfile(id)).education).toMatchObject([
      { institution: 'Fulbright', programme: null, started_on: '2021-01', ended_on: '2021-01' },
    ])
    await updateOwnProfile(id, { education: [] })
    expect((await getOwnProfile(id)).education).toEqual([])
    // Education is not one of the frozen completion groups.
    expect(await percent(id)).toBe(before)
  })

  it('validates education items: institution, months, period, unknown keys, bounds; atomic', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Chi', education: [{ institution: 'Kept' }] })
    for (const [body, reason] of [
      [{ education: [{ institution: '  ' }] }, 'institution_required'],
      [{ education: [{ programme: 'No school' }] }, 'institution_required'],
      [{ education: [{ institution: 'X', degree: 'BSc' }] }, 'invalid'],
      [{ education: [{ institution: 'X', id: 'abc' }] }, 'invalid'],
      [{ education: [{ institution: 'X', programme: 42 }] }, 'invalid'],
      [{ education: ['X'] }, 'invalid'],
      [{ education: { institution: 'X' } }, 'invalid'],
      [{ education: [{ institution: 'X', started_on: '2020-01-01' }] }, 'invalid_month'],
      [{ education: [{ institution: 'X', ended_on: '2021-13' }] }, 'invalid_month'],
      [
        { education: [{ institution: 'X', started_on: '2021-06', ended_on: '2021-05' }] },
        'invalid_period',
      ],
      [{ education: [{ institution: 'X', ended_on: '2021-05' }] }, 'invalid_period'],
      [
        { education: [{ institution: 'X', started_on: null, ended_on: '2021-05' }] },
        'invalid_period',
      ],
      [{ education: [{ institution: 'x'.repeat(201) }] }, 'too_long'],
      [{ education: Array.from({ length: 21 }, () => ({ institution: 'X' })) }, 'too_many'],
    ] as const) {
      expect(
        await refusal(updateOwnProfile(id, { headline: 'Changed', ...body })),
        JSON.stringify(body),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { education: reason },
      })
    }
    const dto = await getOwnProfile(id)
    expect([dto.headline, dto.education.map((e) => e.institution)]).toEqual([null, ['Kept']])
  })

  it('server-owned and foreign fields are refused before any write', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Before' })
    for (const key of [
      'completion_percent',
      'status',
      'onboarding_completed_at',
      'avatar_asset_id',
      'profile_id',
      'account_id',
      'primary_intent',
    ]) {
      const r = await refusal(updateOwnProfile(id, { display_name: 'After', [key]: 1 }))
      expect(r, key).toMatchObject({ code: 'PROFILE_VALIDATION_FAILED', status: 422 })
    }
    expect((await getOwnProfile(id)).display_name).toBe('Before')
  })

  it('a failing vocabulary id leaves every other field untouched (atomic)', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Chi', development_goal: 'G' })
    const r = await refusal(
      updateOwnProfile(id, {
        development_goal: 'Changed',
        current_need: 'Changed',
        experience: [{ title: 'PM' }],
        links: [{ url: 'https://a.example' }],
        domain_ids: [SKILL], // a SKILL id in the DOMAIN field
      }),
    )
    expect(r).toMatchObject({ status: 422 })
    const dto = await getOwnProfile(id)
    expect([dto.development_goal, dto.current_need, dto.experience, dto.links]).toEqual([
      'G',
      null,
      [],
      [],
    ])
  })

  it('completion analytics: once per real change, nothing for an unchanged PATCH', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Chi' })
    const count = async () =>
      (
        await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM analytics_events WHERE account_id = $1 AND event_name = 'profile_completion_changed'`,
          [id],
        )
      )[0]!.n
    const before = await count()
    await updateOwnProfile(id, { display_name: 'Chi' })
    await updateOwnProfile(id, { development_goal: null })
    expect(await count()).toBe(before)
    await updateOwnProfile(id, { development_goal: 'G' })
    expect(await count()).toBe(before + 1)
  })

  it('an ACTIVE profile cannot clear its activation minimum (name, region)', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Chi', region_id: REGION })
    await query(`UPDATE individual_profiles SET status = 'ACTIVE' WHERE account_id = $1`, [id])
    for (const [body, field] of [
      [{ display_name: '   ' }, 'display_name'],
      [{ display_name: null }, 'display_name'],
      [{ region_id: null }, 'region_id'],
    ] as const) {
      expect(await refusal(updateOwnProfile(id, body))).toMatchObject({
        fields: { [field]: 'required' },
      })
    }
    const dto = await getOwnProfile(id)
    expect([dto.display_name, dto.region?.id, dto.status]).toEqual(['Chi', REGION, 'ACTIVE'])
  })

  it('never touches visibility, membership or leadership', async () => {
    const id = await account()
    await updateOwnProfile(id, { display_name: 'Chi' })
    const [p] = await query<{ id: string }>(
      'SELECT id::text FROM individual_profiles WHERE account_id = $1',
      [id],
    )
    await query(
      `INSERT INTO profile_visibility_settings (profile_id, default_level, group_overrides) VALUES ($1, 'NETWORK_ONLY', '{"PROFILE_DISCOVERY":"PRIVATE"}')`,
      [p!.id],
    )
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'PENDING_APPROVAL', 'SELF_DECLARED')`,
      [p!.id, CHAPTER_01],
    )
    const snapshot = () =>
      query(
        `SELECT (SELECT group_overrides::text FROM profile_visibility_settings WHERE profile_id = $1) AS v,
                (SELECT string_agg(state::text, ',') FROM community_memberships WHERE profile_id = $1) AS m,
                (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS l,
                (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id = $1) AS r`,
        [p!.id],
      )
    const before = await snapshot()
    await updateOwnProfile(id, {
      headline: 'H',
      region_id: REGION,
      bio: 'B',
      development_goal: 'G',
      current_need: 'N',
      experience: [{ title: 'PM' }],
      links: [{ url: 'https://a.example' }],
    })
    expect(await snapshot()).toEqual(before)
  })
})
