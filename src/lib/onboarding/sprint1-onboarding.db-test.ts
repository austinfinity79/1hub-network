import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { closePool, query } from '@/lib/db/client'
import { getProfileCompletion } from '@/lib/profile/completion'
import { getOwnProfile, updateOwnProfile } from '@/lib/profile/profile'
import { listActiveItems } from '@/lib/vocabulary/vocabulary'

import { completeOnboarding } from './complete'
import { monthNow } from './hub-position'
import {
  claimFilings,
  getDeclaredRoles,
  listHubCatalog,
  parseDeclaration,
  saveDeclaredRoles,
} from './roles'
import { passStage } from './state'
import { acceptBoth, ensureCapabilityMinimum, fillBasic, newAccount } from './testing'

/**
 * S1-UAT-03 (DEC-S1O) against live PostgreSQL: the canonical catalogue
 * (Appendix E), US-01.07 location, US-01.10 role minimum, US-01.11 HUB
 * position declarations, and that declaring grants nothing.
 */

const CATALOG_SQL = readFileSync(join(process.cwd(), 'db', 'seed', 'catalog_sprint1.sql'), 'utf8')
const HUB = '10000000-0000-0000-0000-000000000001'
const RID = 'req-s1o'

afterAll(async () => {
  await closePool()
})

const chapterId = async (name: string) =>
  (
    await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE name = $1 AND type = 'CHAPTER'`,
      [name],
    )
  )[0]!.id
const clubId = async (name: string) =>
  (
    await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE name = $1 AND type = 'CLB'`,
      [name],
    )
  )[0]!.id
const itemId = async (type: string, label: string) =>
  (
    await query<{ id: string }>(
      `SELECT id::text FROM vocabulary_items WHERE type_code = $1 AND label = $2 AND status = 'ACTIVE'`,
      [type, label],
    )
  )[0]!.id

const row = (over: Record<string, unknown>) => ({
  level: 'CHAPTER',
  organization_id: HUB,
  position: 'MEMBER',
  from: '2024-01',
  current: true,
  ...over,
})

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    const e = error as { code?: string; status?: number; fields?: Record<string, string> }
    return { code: e.code, status: e.status, fields: e.fields }
  }
  throw new Error('expected a refusal')
}

describe('catalogue (Appendix E; FB-06, FB-07, FB-11)', () => {
  it('HUB Network Tổng, 13 Chapters in FB-11 order, 55 CLBs under 4 Chapters', async () => {
    const catalog = await listHubCatalog()
    expect(catalog.hub).toMatchObject({ id: HUB, type: 'HUB' })
    expect(catalog.chapters.map((c) => c.name)).toEqual([
      'HUB Network HighSchool',
      'HUB Network Business',
      'HUB Network Hà Nội',
      'HUB Network Đà Nẵng',
      'HUB Network Hồ Chí Minh',
      'HUB Network Quảng Ninh',
      'HUB Network Trung Quốc (China)',
      'HUB Network Singapore',
      'HUB Network Châu Âu (EU)',
      'HUB Network Vương quốc Anh (UK)',
      'HUB Network Hoa Kỳ (USA)',
      'HUB Network các Tiểu vương quốc Ả Rập Thống nhất (UAE)',
      'HUB Network Úc (Australia)',
    ])
    const counts = Object.fromEntries(
      catalog.chapters
        .filter((c) => catalog.clubs[c.id])
        .map((c) => [c.name, catalog.clubs[c.id]!.length]),
    )
    expect(counts).toEqual({
      'HUB Network HighSchool': 7,
      'HUB Network Hà Nội': 22,
      'HUB Network Đà Nẵng': 6,
      'HUB Network Hồ Chí Minh': 20,
    })
    expect(Object.values(catalog.clubs).flat()).toHaveLength(55)
    // FB-11 spelling corrections are in the catalogue.
    const names = Object.values(catalog.clubs)
      .flat()
      .map((c) => c.name)
    expect(names).toContain('FIC - Entrepreneurship')
    expect(names).toContain('CSP Potential Entrepreneurship Club')
    expect(names.join(' ')).not.toMatch(/Entrpreneurship|Entreprenuership/)
    // Fixture units (Chapter 01/02, Club 01) are not catalogue units.
    expect(catalog.chapters.map((c) => c.name)).not.toContain('Chapter 01')
  })

  it('every catalogue unit has exactly one active PARENT relationship to its parent', async () => {
    const rows = await query<{ type: string; ok: boolean }>(
      `SELECT o.type::text AS type,
              (SELECT count(*) FROM organization_relationships r
                WHERE r.target_org_id = o.id AND r.relationship_type = 'PARENT'
                  AND r.state = 'ACTIVE' AND r.source_org_id = o.parent_id) = 1 AS ok
         FROM organizations o
        WHERE o.metadata->>'catalog' = 'S1_APPENDIX_E' AND o.type <> 'HUB'`,
    )
    expect(rows).toHaveLength(68)
    expect(rows.every((r) => r.ok)).toBe(true)
  })

  it('11 countries (10 + "Khác") and Việt Nam 34 provinces, 4 pinned first, in order', async () => {
    const countries = await listActiveItems(['COUNTRY'])
    expect(countries.map((c) => c.label)).toEqual([
      'Việt Nam',
      'Singapore',
      'Trung Quốc Đại lục',
      'Đài Loan',
      'Hồng Kông',
      'Vương quốc Anh',
      'Hoa Kỳ',
      'Úc',
      'Châu Âu',
      'Các Tiểu vương quốc Ả Rập Thống nhất',
    ])
    const regions = (await listActiveItems(['REGION'])).map((r) => r.label)
    expect(regions).toHaveLength(34)
    expect(regions.slice(0, 4)).toEqual([
      'TP. Hà Nội',
      'TP. Hồ Chí Minh',
      'TP. Đà Nẵng',
      'TP. Quảng Ninh',
    ])
    expect(regions.slice(4, 8)).toEqual(['An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng'])
    expect(regions.at(-1)).toBe('Vĩnh Long')
  })

  it('is idempotent: a second run changes no row', async () => {
    const snapshot = async () =>
      query<{ n: string }>(
        `SELECT md5(string_agg(t, '|' ORDER BY t)) AS n FROM (
           SELECT o.id::text || o.name || o.slug || coalesce(o.parent_id::text, '') || o.metadata::text
                  || o.updated_at::text AS t FROM organizations o
           UNION ALL SELECT v.id::text || v.label || v.sort_order || v.status || v.metadata::text
                  FROM vocabulary_items v WHERE v.type_code IN ('COUNTRY', 'REGION')
           UNION ALL SELECT r.id::text || r.source_org_id || r.target_org_id || r.state
                  FROM organization_relationships r) x`,
      )
    const before = await snapshot()
    await query(CATALOG_SQL)
    await query(CATALOG_SQL)
    expect(await snapshot()).toEqual(before)
  })

  it('uses no non-deterministic call', () => {
    expect(CATALOG_SQL).not.toMatch(/now\(\)|gen_random_uuid|random\(|clock_timestamp/i)
  })
})

describe('location (US-01.07)', () => {
  it('a typed country ("Khác") and a typed place are stored, shown and counted', async () => {
    const accountId = await newAccount('s1o-loc')
    const typed = `Thái Lan ${Date.now()}`
    await updateOwnProfile(accountId, { country: typed, locality: 'Bangkok' })
    const profile = await getOwnProfile(accountId)
    expect(profile.country).toMatchObject({ label: typed, status: 'UNNORMALIZED' })
    expect(profile.region).toMatchObject({ label: 'Bangkok', status: 'UNNORMALIZED' })
    // Equal text is one value; it is never offered as a choice.
    const other = await newAccount('s1o-loc')
    await updateOwnProfile(other, { country: ` ${typed.toUpperCase()} `, locality: 'bangkok' })
    expect((await getOwnProfile(other)).country!.id).toBe(profile.country!.id)
    expect((await listActiveItems(['COUNTRY'])).map((c) => c.id)).not.toContain(profile.country!.id)
    const location = (await getProfileCompletion(accountId)).groups.find(
      (g) => g.code === 'LOCATION',
    )
    expect(location?.complete).toBe(true)
  })

  it('another country types its place, never a Vietnamese province; Việt Nam "Khác" may normalise', async () => {
    const singapore = await itemId('COUNTRY', 'Singapore')
    const vietnam = await itemId('COUNTRY', 'Việt Nam')
    const hanoi = await itemId('REGION', 'TP. Hà Nội')
    const accountId = await newAccount('s1o-loc')
    expect(
      await refusal(updateOwnProfile(accountId, { country_id: singapore, region_id: hanoi })),
    ).toMatchObject({ status: 422, fields: { region_id: 'not_for_country' } })
    await updateOwnProfile(accountId, { country_id: singapore, locality: 'TP. Hà Nội' })
    const typed = (await getOwnProfile(accountId)).region!
    expect(typed.id).not.toBe(hanoi)
    expect(typed.status).toBe('UNNORMALIZED')
    await updateOwnProfile(accountId, { country_id: vietnam, locality: 'tp. hà nội' })
    expect((await getOwnProfile(accountId)).region!.id).toBe(hanoi)
  })

  it('a new country without a new place clears the old one; an active profile must give one', async () => {
    const singapore = await itemId('COUNTRY', 'Singapore')
    const accountId = await newAccount('s1o-loc')
    await fillBasic(accountId)
    await updateOwnProfile(accountId, { country_id: singapore })
    expect((await getOwnProfile(accountId)).region).toBeNull()
    // An activated profile keeps its minimum: the place comes with the country.
    const active = await newAccount('s1o-loc')
    await fillBasic(active)
    await ensureCapabilityMinimum(active)
    await passStage(active, { completed: 'CAPABILITY' })
    await saveDeclaredRoles(active, { roles: ['INNOVATOR'], hub_claims: [] })
    await passStage(active, { completed: 'ROLE' })
    await acceptBoth(active)
    await completeOnboarding(active, RID)
    expect(await refusal(updateOwnProfile(active, { country_id: singapore }))).toMatchObject({
      status: 422,
      fields: { region_id: 'required' },
    })
    await updateOwnProfile(active, { country_id: singapore, locality: 'Jurong' })
    expect((await getOwnProfile(active)).region!.label).toBe('Jurong')
  })

  it('typed names are 1–60 characters and exclusive with the ids', async () => {
    const accountId = await newAccount('s1o-loc')
    expect(await refusal(updateOwnProfile(accountId, { locality: 'x'.repeat(61) }))).toMatchObject({
      fields: { locality: 'too_long' },
    })
    expect(await refusal(updateOwnProfile(accountId, { country: '   ' }))).toMatchObject({
      fields: { country: 'required' },
    })
    expect(
      await refusal(updateOwnProfile(accountId, { country: 'Lào', country_id: null })),
    ).toMatchObject({ fields: { country: 'conflicts_with_ids' } })
    await updateOwnProfile(accountId, { country: 'Lào', locality: 'x'.repeat(60) })
    expect((await getOwnProfile(accountId)).region!.label).toHaveLength(60)
  })
})

describe('HUB position declarations (US-01.11; FB-12, FB-13)', () => {
  it('validates each row: level, unit, position texts, months, current term', async () => {
    const now = monthNow()
    const bad = (claim: Record<string, unknown>) =>
      refusal(
        Promise.resolve().then(() =>
          parseDeclaration({ roles: ['HUB_MEMBER'], hub_claims: [claim] }, now),
        ),
      )
    expect(await bad(row({ level: 'BOARD' }))).toMatchObject({
      fields: { hub_claims: 'level_required' },
    })
    expect(await bad(row({ position: 'PRESIDENT' }))).toMatchObject({
      fields: { hub_claims: 'position_required' },
    })
    expect(await bad(row({ position: 'HEAD_OF_BOARD' }))).toMatchObject({
      fields: { hub_claims: 'board_name_required' },
    })
    expect(await bad(row({ position: 'OTHER', position_other: ' ' }))).toMatchObject({
      fields: { hub_claims: 'position_other_required' },
    })
    expect(await bad(row({ position: 'HEAD_OF_BOARD', board_name: 'x'.repeat(61) }))).toMatchObject(
      {
        fields: { hub_claims: 'too_long' },
      },
    )
    expect(await bad(row({ from: null }))).toMatchObject({
      fields: { hub_claims: 'from_required' },
    })
    expect(await bad(row({ from: '01/2024' }))).toMatchObject({
      fields: { hub_claims: 'invalid_month' },
    })
    expect(await bad(row({ current: false }))).toMatchObject({
      fields: { hub_claims: 'to_required' },
    })
    expect(await bad(row({ current: false, from: '2024-05', to: '2024-04' }))).toMatchObject({
      fields: { hub_claims: 'end_before_start' },
    })
    const next = `${Number(now.slice(0, 4)) + 1}-01`
    expect(await bad(row({ from: next }))).toMatchObject({ fields: { hub_claims: 'future_month' } })
    expect(await bad(row({ current: false, from: '2024-01', to: next }))).toMatchObject({
      fields: { hub_claims: 'future_month' },
    })
    // A current term has no end: a sent "to" is dropped, never stored.
    expect(
      parseDeclaration({ roles: ['HUB_MEMBER'], hub_claims: [row({ to: '2024-06' })] }, now)
        .claims[0]!.to,
    ).toBeNull()
  })

  it('1–10 rows; a repeated unit + position over overlapping months is refused, another term is not', async () => {
    const now = monthNow()
    const hn = await chapterId('HUB Network Hà Nội')
    const many = Array.from({ length: 11 }, (_, i) =>
      row({ organization_id: hn, current: false, from: `20${10 + i}-01`, to: `20${10 + i}-06` }),
    )
    expect(
      await refusal(
        Promise.resolve().then(() =>
          parseDeclaration({ roles: ['HUB_MEMBER'], hub_claims: many }, now),
        ),
      ),
    ).toMatchObject({ fields: { hub_claims: 'too_many' } })
    expect(
      parseDeclaration({ roles: ['HUB_MEMBER'], hub_claims: many.slice(0, 10) }, now).claims,
    ).toHaveLength(10)
    // US-01.11: Thành viên 01/2022–12/2023, then Phó Chủ tịch 01/2024–hiện tại: allowed.
    const terms = [
      row({
        organization_id: hn,
        position: 'MEMBER',
        current: false,
        from: '2022-01',
        to: '2023-12',
      }),
      row({ organization_id: hn, position: 'VICE_CHAIR', from: '2024-01' }),
      row({
        organization_id: hn,
        position: 'MEMBER',
        current: false,
        from: '2024-01',
        to: '2024-06',
      }),
    ]
    expect(parseDeclaration({ roles: ['HUB_MEMBER'], hub_claims: terms }, now).claims).toHaveLength(
      3,
    )
    expect(
      await refusal(
        Promise.resolve().then(() =>
          parseDeclaration(
            {
              roles: ['HUB_MEMBER'],
              hub_claims: [
                ...terms,
                row({ organization_id: hn, position: 'VICE_CHAIR', from: '2025-01' }),
              ],
            },
            now,
          ),
        ),
      ),
    ).toMatchObject({ fields: { hub_claims: 'duplicate_position' } })
  })

  it('U8: three levels kept in order HUB → Chapter → CLB, current first, each "Chờ xác minh"', async () => {
    const hn = await chapterId('HUB Network Hà Nội')
    const hiec = await clubId('HIEC - CLB Sáng tạo và Khởi nghiệp HUST')
    const accountId = await newAccount('s1o-u8')
    const saved = await saveDeclaredRoles(accountId, {
      roles: ['HUB_MEMBER'],
      hub_claims: [
        row({
          level: 'CLB',
          organization_id: hiec,
          position: 'HEAD_OF_BOARD',
          board_name: 'Truyền thông',
        }),
        row({
          level: 'CHAPTER',
          organization_id: hn,
          position: 'MEMBER',
          current: false,
          from: '2020-01',
          to: '2021-12',
        }),
        row({ level: 'CHAPTER', organization_id: hn, position: 'CHAIR', from: '2023-03' }),
        row({ level: 'HUB', organization_id: HUB, position: 'VICE_CHAIR', from: '2024-01' }),
      ],
    })
    expect(
      saved.hub_claims.map((c) => [c.level, c.title, c.period, c.status, c.chapter?.name ?? null]),
    ).toEqual([
      ['HUB', 'Phó Chủ tịch', '01/2024 – Hiện tại', 'PENDING', null],
      ['CHAPTER', 'Chủ tịch', '03/2023 – Hiện tại', 'PENDING', null],
      ['CHAPTER', 'Thành viên', '01/2020 – 12/2021', 'PENDING', null],
      ['CLB', 'Trưởng Ban Truyền thông', '01/2024 – Hiện tại', 'PENDING', 'HUB Network Hà Nội'],
    ])
    expect(await getDeclaredRoles(accountId)).toEqual(saved)
  })

  it('a unit must match its level, a CLB must sit under a Chapter; "Đã xác minh" sent is ignored', async () => {
    const hn = await chapterId('HUB Network Hà Nội')
    const hiec = await clubId('HIEC - CLB Sáng tạo và Khởi nghiệp HUST')
    const accountId = await newAccount('s1o-level')
    for (const claim of [
      row({ level: 'CLB', organization_id: hn }),
      row({ level: 'CHAPTER', organization_id: hiec }),
      row({ level: 'HUB', organization_id: hn }),
    ]) {
      expect(
        await refusal(saveDeclaredRoles(accountId, { roles: ['HUB_MEMBER'], hub_claims: [claim] })),
      ).toMatchObject({ fields: { hub_claims: 'organization_not_available' } })
    }
    const saved = await saveDeclaredRoles(accountId, {
      roles: ['HUB_MEMBER'],
      hub_claims: [
        row({ organization_id: hn, position: 'CHAIR', status: 'VERIFIED', verified: true }),
      ],
    })
    expect(saved.hub_claims[0]!.status).toBe('PENDING')
    const [stored] = await query<{ claims: unknown }>(
      `SELECT onboarding_hub_claims AS claims FROM individual_profiles p
         JOIN user_accounts a ON a.id = p.account_id WHERE a.id = $1`,
      [accountId],
    )
    expect(JSON.stringify(stored!.claims)).not.toMatch(/VERIFIED|verified/)
    // Any other unknown field is refused.
    expect(
      await refusal(
        saveDeclaredRoles(accountId, {
          roles: ['HUB_MEMBER'],
          hub_claims: [row({ organization_id: hn, capability: 'organization.manage' })],
        }),
      ),
    ).toMatchObject({ fields: { hub_claims: 'invalid' } })
  })
})

describe('stage 3 gate (US-01.10, US-01.11)', () => {
  it('needs one role; a HUB member needs one complete position; a pre-S1-UAT-03 draft must be completed', async () => {
    const hn = await chapterId('HUB Network Hà Nội')
    const accountId = await newAccount('s1o-gate')
    await fillBasic(accountId)
    await ensureCapabilityMinimum(accountId)
    await passStage(accountId, { completed: 'CAPABILITY' })
    expect(await refusal(passStage(accountId, { completed: 'ROLE' }))).toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
      fields: { roles: 'missing' },
    })
    await saveDeclaredRoles(accountId, { roles: ['HUB_MEMBER'], hub_claims: [] })
    expect(await refusal(passStage(accountId, { completed: 'ROLE' }))).toMatchObject({
      fields: { hub_claims: 'missing' },
    })
    // A draft saved in the earlier shape reads back, but does not pass the stage.
    await query(
      `UPDATE individual_profiles SET onboarding_hub_claims = $2::jsonb
        WHERE account_id = $1`,
      [
        accountId,
        JSON.stringify([{ organization_id: hn, position: 'Trưởng chapter', period: '2024 – nay' }]),
      ],
    )
    expect((await getDeclaredRoles(accountId)).hub_claims[0]).toMatchObject({
      level: 'CHAPTER',
      position: null,
      title: 'Trưởng chapter',
      period: '2024 – nay',
    })
    expect(await refusal(passStage(accountId, { completed: 'ROLE' }))).toMatchObject({
      fields: { hub_claims: 'incomplete' },
    })
    await saveDeclaredRoles(accountId, {
      roles: ['HUB_MEMBER'],
      hub_claims: [row({ organization_id: hn })],
    })
    expect((await passStage(accountId, { completed: 'ROLE' })).current_step).toBe('REVIEW')
  })
})

describe('completion and authority', () => {
  it('declaring "Chủ tịch HUB Network Hà Nội" grants no capability, scope, leadership or assignment', async () => {
    const hn = await chapterId('HUB Network Hà Nội')
    const hiec = await clubId('HIEC - CLB Sáng tạo và Khởi nghiệp HUST')
    const accountId = await newAccount('s1o-auth')
    await fillBasic(accountId)
    await ensureCapabilityMinimum(accountId)
    await passStage(accountId, { completed: 'CAPABILITY' })
    await saveDeclaredRoles(accountId, {
      roles: ['HUB_MEMBER', 'INVESTOR_REPRESENTATIVE', 'ORGANIZATION_REPRESENTATIVE'],
      hub_claims: [
        row({ level: 'HUB', organization_id: HUB, position: 'VICE_CHAIR' }),
        row({ organization_id: hn, position: 'CHAIR' }),
        row({
          organization_id: hn,
          position: 'MEMBER',
          current: false,
          from: '2020-01',
          to: '2021-12',
        }),
        row({
          level: 'CLB',
          organization_id: hiec,
          position: 'HEAD_OF_BOARD',
          board_name: 'Truyền thông',
        }),
      ],
    })
    await passStage(accountId, { completed: 'ROLE' })
    await acceptBoth(accountId)
    await completeOnboarding(accountId, RID)

    const actor = await resolveActor(accountId)
    expect(deriveCapabilities(actor)).toEqual([])
    expect(deriveManagedScopes(actor)).toEqual([])
    const [granted] = await query<{ leadership: number; assignments: number; active: number }>(
      `SELECT (SELECT count(*)::int FROM leadership_records l WHERE l.profile_id = p.id) AS leadership,
              (SELECT count(*)::int FROM role_assignments r WHERE r.individual_profile_id = p.id) AS assignments,
              (SELECT count(*)::int FROM community_memberships m
                WHERE m.profile_id = p.id AND m.state = 'ACTIVE') AS active
         FROM individual_profiles p WHERE p.account_id = $1`,
      [accountId],
    )
    expect(granted).toEqual({ leadership: 0, assignments: 0, active: 0 })
    // One pending, self-declared request per unit, with the printed position (03B
    // replaces it with one verification request per position).
    const filed = await query<{ unit: string; position: string; period: string }>(
      `SELECT o.name AS unit, m.claimed_position AS position, m.claimed_period AS period
         FROM community_memberships m
         JOIN organizations o ON o.id = m.organization_id
         JOIN individual_profiles p ON p.id = m.profile_id
        WHERE p.account_id = $1 AND m.state = 'PENDING_APPROVAL' AND m.source = 'SELF_DECLARED'
        ORDER BY o.type, o.name`,
      [accountId],
    )
    expect(filed).toEqual([
      { unit: 'HUB Network', position: 'Phó Chủ tịch', period: '01/2024 – Hiện tại' },
      { unit: 'HUB Network Hà Nội', position: 'Chủ tịch', period: '01/2024 – Hiện tại' },
      {
        unit: 'HIEC - CLB Sáng tạo và Khởi nghiệp HUST',
        position: 'Trưởng Ban Truyền thông',
        period: '01/2024 – Hiện tại',
      },
    ])
  })

  it('files a pre-S1-UAT-03 draft with its own text', () => {
    expect(
      claimFilings([{ organization_id: HUB, position: 'Trưởng chapter', period: '2024 – nay' }]),
    ).toEqual([{ organization_id: HUB, position: 'Trưởng chapter', period: '2024 – nay' }])
  })
})
