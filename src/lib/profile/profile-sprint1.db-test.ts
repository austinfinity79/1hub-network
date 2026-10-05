import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'
import { vocabularyForLibrary } from '@/lib/library/canonical-source'
import { listActiveItems, listVocabularyItems } from '@/lib/vocabulary/vocabulary'

import { getProfileCompletion } from './completion'
import { getOwnProfile, updateOwnProfile } from './profile'
import { projectDiscovery } from './projection'

/**
 * S1-UAT-05 (DEC-S1P) — FB-09 tags, FB-10 skills, experience "Loại hình" and
 * "Địa điểm", against live PostgreSQL through the real services.
 * Canonical labels are the deterministic seed's ("Giáo dục") and migration
 * 010's ("Vận hành"); free text is unique per run.
 */

const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const REGION = '20000000-0000-0000-0000-000000000002'
const EDUCATION = '20000000-0000-0000-0000-000000000012'
const OPERATIONS = '22000000-0000-0000-0000-000000000001'
const SKILL = '20000000-0000-0000-0000-000000000021'

afterAll(async () => {
  // This run's free-text tags are test data: unlink and remove them.
  const own = `SELECT id FROM vocabulary_items WHERE status = 'UNNORMALIZED' AND label LIKE $1`
  await query(`DELETE FROM profile_domains WHERE vocab_id IN (${own})`, [`%${run}%`])
  await query(`DELETE FROM profile_specializations WHERE vocab_id IN (${own})`, [`%${run}%`])
  await query(`DELETE FROM vocabulary_items WHERE id IN (${own})`, [`%${run}%`])
  await closePool()
})

async function account(): Promise<string> {
  const email = `s1p-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
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

const itemsLabelled = (label: string) =>
  query<{ id: string; status: string; type_code: string }>(
    `SELECT id::text, status::text AS status, type_code FROM vocabulary_items WHERE label = $1`,
    [label],
  )

describe('FB-09 — free text with suggestions', () => {
  it('a suggestion (canonical label, any case and spacing) links the canonical item', async () => {
    const id = await account()
    const dto = await updateOwnProfile(id, {
      domains: ['  giáo   DỤC '],
      specializations: ['Vận hành'],
    })
    expect(dto.domains).toEqual([{ id: EDUCATION, label: 'Giáo dục', status: 'ACTIVE' }])
    expect(dto.specializations).toEqual([{ id: OPERATIONS, label: 'Vận hành', status: 'ACTIVE' }])
  })

  it('custom free text is stored as "chưa chuẩn hóa" (UNNORMALIZED) and reused, never duplicated', async () => {
    const label = `Kinh tế tuần hoàn ${run}`
    const first = await account()
    const dto = await updateOwnProfile(first, { domains: [label] })
    expect(dto.domains).toEqual([{ id: expect.any(String), label, status: 'UNNORMALIZED' }])
    const second = await account()
    const other = await updateOwnProfile(second, { domains: [label.toUpperCase()] })
    expect(other.domains[0]!.id).toBe(dto.domains[0]!.id)
    expect(await itemsLabelled(label)).toEqual([
      { id: dto.domains[0]!.id, status: 'UNNORMALIZED', type_code: 'DOMAIN' },
    ])
  })

  it('a custom value is edited and survives a reload; the replaced one is unlinked', async () => {
    const id = await account()
    await updateOwnProfile(id, { specializations: [`Gọi vốn ${run}`, 'Vận hành'] })
    await updateOwnProfile(id, { specializations: [`Gọi vốn cộng đồng ${run}`, 'Vận hành'] })
    const reloaded = await getOwnProfile(id)
    expect(reloaded.specializations.map((s) => [s.label, s.status]).sort()).toEqual(
      [
        [`Gọi vốn cộng đồng ${run}`, 'UNNORMALIZED'],
        ['Vận hành', 'ACTIVE'],
      ].sort(),
    )
  })

  it('limits: duplicates, a sixth tag, 2–40 characters for a new value, ids and text together', async () => {
    const id = await account()
    const cases: [Record<string, unknown>, string, string][] = [
      [{ domains: ['Fintech', 'fintech '] }, 'domains', 'duplicate'],
      [
        { domains: ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'].map((t) => `${t}${run}`) },
        'domains',
        'too_many',
      ],
      [{ specializations: ['x'] }, 'specializations', 'tag_length'],
      [{ specializations: ['y'.repeat(41)] }, 'specializations', 'tag_length'],
      [{ domains: ['Giáo dục'], domain_ids: [EDUCATION] }, 'domains', 'conflicts_with_ids'],
      [{ domains: ['  '] }, 'domains', 'invalid'],
    ]
    for (const [body, field, reason] of cases) {
      expect(await refusal(updateOwnProfile(id, body)), JSON.stringify(body)).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [field]: reason },
      })
    }
    expect((await getOwnProfile(id)).domains).toEqual([])
  })

  it('an unnormalised value is never a suggestion, a Library filter or selectable by id', async () => {
    const label = `Nông nghiệp số ${run}`
    const owner = await account()
    const created = (await updateOwnProfile(owner, { domains: [label] })).domains[0]!
    const active = await listActiveItems(['DOMAIN'])
    expect(active.some((i) => i.id === created.id)).toBe(false)
    const searched = await listVocabularyItems('DOMAIN', { q: label, limit: 50 })
    expect(searched.items).toEqual([])
    const library = await vocabularyForLibrary()
    expect([...library.domainsBySlug.values()].some((v) => v.id === created.id)).toBe(false)
    expect(
      await refusal(updateOwnProfile(await account(), { domain_ids: [created.id] })),
    ).toMatchObject({ code: 'VOCABULARY_ITEM_INACTIVE', fields: { domain_ids: 'inactive' } })
    // Its owner keeps it on later saves by id (already linked).
    await updateOwnProfile(owner, { domain_ids: [created.id, EDUCATION] })
    expect((await getOwnProfile(owner)).domains).toHaveLength(2)
  })

  it('a tag counts once for completion whatever its status; suggestions add nothing', async () => {
    const id = await account()
    await updateOwnProfile(id, { domains: [`Khí hậu ${run}`] })
    const completion = await getProfileCompletion(id)
    expect(completion.groups.filter((g) => g.complete).map((g) => g.code)).toEqual(['DOMAIN'])
    expect(completion.percent).toBe(8)
  })
})

describe('FB-10 — skills', () => {
  it('stored skills stay, are not edited by tag saves and never count', async () => {
    const id = await account()
    await updateOwnProfile(id, { skill_ids: [SKILL] })
    await updateOwnProfile(id, { domains: ['Giáo dục'], specializations: ['Vận hành'] })
    const dto = await getOwnProfile(id)
    expect(dto.skills.map((s) => s.id)).toEqual([SKILL])
    expect((await getProfileCompletion(id)).groups.map((g) => g.code)).not.toContain('SKILLS')
    expect(dto.completion.percent).toBe(17)
  })
})

describe('experience — "Loại hình" and "Địa điểm"', () => {
  const record = {
    title: 'Đồng sáng lập · CEO',
    organization_name: 'Tracely',
    started_on: '2024-02',
    ended_on: null,
    description: 'Dẫn đội 6 người',
    employment_type: 'Toàn thời gian',
    location: 'Đà Nẵng',
  }

  it('create, reload, edit, keep on an editor save, clear', async () => {
    const id = await account()
    await updateOwnProfile(id, { experience: [record] })
    expect((await getOwnProfile(id)).experience[0]).toMatchObject({
      employment_type: 'Toàn thời gian',
      location: 'Đà Nẵng',
      started_on: '2024-02',
    })
    await updateOwnProfile(id, {
      experience: [{ ...record, employment_type: 'Bán thời gian', location: 'Cần Thơ' }],
    })
    expect((await getOwnProfile(id)).experience[0]).toMatchObject({
      employment_type: 'Bán thời gian',
      location: 'Cần Thơ',
    })
    // The WF02-S02 editor sends title and organisation only: the rest is kept.
    await updateOwnProfile(id, {
      experience: [{ title: record.title, organization_name: record.organization_name }],
    })
    expect((await getOwnProfile(id)).experience[0]).toMatchObject({
      employment_type: 'Bán thời gian',
      location: 'Cần Thơ',
      description: 'Dẫn đội 6 người',
    })
    // The dialog sends empty optional fields as null: they are cleared.
    await updateOwnProfile(id, {
      experience: [{ ...record, employment_type: null, location: '  ' }],
    })
    expect((await getOwnProfile(id)).experience[0]).toMatchObject({
      employment_type: null,
      location: null,
    })
  })

  it('bounds: "Loại hình" 40, place 200 characters', async () => {
    const id = await account()
    for (const extra of [{ employment_type: 't'.repeat(41) }, { location: 'p'.repeat(201) }]) {
      expect(
        await refusal(updateOwnProfile(id, { experience: [{ ...record, ...extra }] })),
      ).toMatchObject({ fields: { experience: 'too_long' } })
    }
    expect((await getOwnProfile(id)).experience).toEqual([])
  })
})

describe('privacy — the new fields follow their record', () => {
  it('only the owner reads them; the discovery projection never carries experience', async () => {
    const owner = await account()
    const stranger = await account()
    await updateOwnProfile(owner, {
      display_name: 'Chi',
      region_id: REGION,
      experience: [{ title: 'PM', employment_type: 'Toàn thời gian', location: 'Huế' }],
    })
    expect((await getOwnProfile(stranger)).experience).toEqual([])
    const projected = projectDiscovery(
      {
        profile_id: 'p',
        display_name: 'Chi',
        avatar_asset_id: null,
        headline: null,
        bio: null,
        domain_ids: [],
        region_id: REGION,
      },
      'NETWORK_ONLY',
      'NETWORK',
    )
    expect(JSON.stringify(projected)).not.toMatch(/Toàn thời gian|Huế|experience/)
    expect(
      projectDiscovery(
        {
          ...projected!,
          domain_ids: [],
          avatar_asset_id: null,
          headline: null,
          bio: null,
          display_name: 'Chi',
          region_id: REGION,
        },
        'PRIVATE',
        'NETWORK',
      ),
    ).toBeNull()
  })
})
