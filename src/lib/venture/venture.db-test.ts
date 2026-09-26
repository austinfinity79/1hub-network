import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'
import { getProfileCompletion } from '@/lib/profile/completion'

import { createVenture, getVenture, updateVenture } from './venture'

/**
 * WF02-S05 — canonical Project/Startup against live PostgreSQL
 * (DEC-WF02-H6/H7, DEC-WF02-S05-G1..G5, DEC-WF02-VENTURE-TAXONOMY-STORAGE).
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const REGION_2 = '20000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const SKILL = '20000000-0000-0000-0000-000000000021'

afterAll(async () => {
  // Test vocabulary only: unlink it first (FK), then remove it.
  await query(
    `DELETE FROM project_domains WHERE vocabulary_item_id IN
       (SELECT id FROM vocabulary_items WHERE slug LIKE 'venture-test-%')`,
  )
  await query("DELETE FROM vocabulary_items WHERE slug LIKE 'venture-test-%'")
  await closePool()
})

/** A completed member (onboarding DONE), directly in canonical rows. */
async function member(done = true): Promise<{ accountId: string; profileId: string }> {
  const email = `ven-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'V', $2, now(), $3) RETURNING id::text`,
    [a!.id, done ? 'ACTIVE' : 'DRAFT', done ? new Date() : null],
  )
  return { accountId: a!.id, profileId: p!.id }
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status, fields: error.fields }
    throw error
  }
  throw new Error('expected a refusal')
}

async function archivedItem(type: 'REGION' | 'DOMAIN'): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO vocabulary_items (type_code, slug, label, status) VALUES ($1, $2, 'Archived', 'ARCHIVED') RETURNING id::text`,
    [
      type,
      `venture-test-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ],
  )
  return row!.id
}

describe('WF02-S05 create', () => {
  it('PROJECT and STARTUP: DRAFT, owner from the session, no owner member row', async () => {
    const m = await member()
    for (const type of ['PROJECT', 'STARTUP'] as const) {
      const v = await createVenture(m.accountId, { type, name: `  ${type} A  `, summary: 'S' })
      expect(v).toMatchObject({
        type,
        name: `${type} A`,
        status: 'DRAFT',
        relation: 'OWNER',
        can_edit: true,
        region: null,
        domains: [],
      })
      const [row] = await query<{ owner: string; slug: string; metadata: unknown }>(
        'SELECT owner_profile_id::text AS owner, slug, metadata FROM projects WHERE id = $1',
        [v.id],
      )
      expect(row!.owner).toBe(m.profileId)
      expect(row!.metadata).toEqual({})
      const members = await query('SELECT 1 FROM project_members WHERE project_id = $1', [v.id])
      expect(members).toHaveLength(0)
      const json = JSON.stringify(v)
      expect(json).not.toContain(row!.slug)
      expect(json).not.toMatch(/"(slug|metadata|owner_profile_id|profile_id|account_id)"/)
    }
  })

  it('with region and domains; client owner/status/slug ignored or refused', async () => {
    const m = await member()
    const other = await member()
    const v = await createVenture(m.accountId, {
      type: 'STARTUP',
      name: 'Both',
      region_id: REGION,
      domain_ids: [DOMAIN, DOMAIN],
    })
    expect(v.region?.id).toBe(REGION)
    expect(v.domains.map((d) => d.id)).toEqual([DOMAIN])
    for (const key of ['owner_profile_id', 'status', 'slug', 'metadata', 'profile_id']) {
      const r = await refusal(
        createVenture(m.accountId, { type: 'PROJECT', name: 'X', [key]: other.profileId }),
      )
      expect(r, key).toMatchObject({ code: 'PROFILE_VALIDATION_FAILED', status: 422 })
    }
  })

  it('validates type, name and taxonomy; a failure writes nothing', async () => {
    const m = await member()
    const archivedRegion = await archivedItem('REGION')
    const archivedDomain = await archivedItem('DOMAIN')
    const count = async () =>
      (
        await query<{ n: number }>(
          'SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1',
          [m.profileId],
        )
      )[0]!.n
    for (const [body, field, reason] of [
      [{ name: 'X' }, 'type', 'invalid'],
      [{ type: 'TEAM', name: 'X' }, 'type', 'invalid'],
      [{ type: 'PROJECT', name: '  ' }, 'name', 'required'],
      [
        { type: 'PROJECT', name: 'X', region_id: '00000000-0000-0000-0000-000000000000' },
        'region_id',
        'unknown',
      ],
      [{ type: 'PROJECT', name: 'X', region_id: DOMAIN }, 'region_id', 'wrong_type'],
      [{ type: 'PROJECT', name: 'X', domain_ids: [SKILL] }, 'domain_ids', 'wrong_type'],
      [{ type: 'PROJECT', name: 'X', domain_ids: ['not-a-uuid'] }, 'domain_ids', 'unknown'],
      [
        { type: 'PROJECT', name: 'X', region_id: REGION, domain_ids: [DOMAIN, REGION] },
        'domain_ids',
        'wrong_type',
      ],
    ] as const) {
      expect(await refusal(createVenture(m.accountId, body)), JSON.stringify(body)).toMatchObject({
        fields: { [field]: reason },
      })
    }
    expect(
      (
        await refusal(
          createVenture(m.accountId, { type: 'PROJECT', name: 'X', region_id: archivedRegion }),
        )
      ).code,
    ).toBe('VOCABULARY_ITEM_INACTIVE')
    expect(
      (
        await refusal(
          createVenture(m.accountId, { type: 'PROJECT', name: 'X', domain_ids: [archivedDomain] }),
        )
      ).code,
    ).toBe('VOCABULARY_ITEM_INACTIVE')
    expect(await count()).toBe(0)
  })

  it('G2: an account whose onboarding is not DONE cannot create', async () => {
    const m = await member(false)
    expect(await refusal(createVenture(m.accountId, { type: 'PROJECT', name: 'X' }))).toMatchObject(
      { code: 'SCOPE_FORBIDDEN', status: 403 },
    )
  })

  it('creating and editing ventures never changes profile completion or analytics', async () => {
    const m = await member()
    const before = await getProfileCompletion(m.accountId)
    const events = async () =>
      (
        await query<{ n: number }>(
          'SELECT count(*)::int AS n FROM analytics_events WHERE account_id = $1',
          [m.accountId],
        )
      )[0]!.n
    const e0 = await events()
    const v = await createVenture(m.accountId, {
      type: 'PROJECT',
      name: 'P',
      region_id: REGION,
      domain_ids: [DOMAIN],
    })
    await updateVenture(m.accountId, v.id, { summary: 'changed', region_id: null, domain_ids: [] })
    expect(await getProfileCompletion(m.accountId)).toEqual(before)
    expect(await events()).toBe(e0)
  })
})

describe('WF02-S05 update and read', () => {
  it('owner edits scalars, replaces and clears region/domains; type is immutable', async () => {
    const m = await member()
    const v = await createVenture(m.accountId, {
      type: 'STARTUP',
      name: 'Old',
      region_id: REGION,
      domain_ids: [DOMAIN],
    })
    const u = await updateVenture(m.accountId, v.id, {
      name: 'New',
      summary: 'Sum',
      region_id: REGION_2,
    })
    expect([u.name, u.summary, u.region?.id, u.domains.length]).toEqual(['New', 'Sum', REGION_2, 1])
    const cleared = await updateVenture(m.accountId, v.id, {
      region_id: null,
      domain_ids: [],
      summary: '  ',
    })
    expect([cleared.region, cleared.domains, cleared.summary]).toEqual([null, [], null])
    for (const key of ['type', 'status', 'owner_profile_id', 'created_at', 'metadata', 'slug']) {
      const r = await refusal(
        updateVenture(m.accountId, v.id, { [key]: key === 'type' ? 'PROJECT' : 'x' }),
      )
      expect(r, key).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        fields: { [key]: key === 'type' ? 'immutable' : 'not_accepted' },
      })
    }
    expect((await getVenture(m.accountId, v.id)).type).toBe('STARTUP')
  })

  it('atomic: a bad domain leaves name, summary, region and domains unchanged', async () => {
    const m = await member()
    const v = await createVenture(m.accountId, {
      type: 'PROJECT',
      name: 'Keep',
      summary: 'K',
      region_id: REGION,
      domain_ids: [DOMAIN],
    })
    const r = await refusal(
      updateVenture(m.accountId, v.id, {
        name: 'Changed',
        summary: 'C',
        region_id: REGION_2,
        domain_ids: [SKILL],
      }),
    )
    expect(r.status).toBe(422)
    const after = await getVenture(m.accountId, v.id)
    expect([after.name, after.summary, after.region?.id, after.domains.map((d) => d.id)]).toEqual([
      'Keep',
      'K',
      REGION,
      [DOMAIN],
    ])
  })

  it('ACTIVE editable; ARCHIVED read-only; archived vocabulary already linked is kept', async () => {
    const m = await member()
    const v = await createVenture(m.accountId, { type: 'PROJECT', name: 'L', domain_ids: [DOMAIN] })
    await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [v.id])
    expect((await updateVenture(m.accountId, v.id, { name: 'Active edit' })).name).toBe(
      'Active edit',
    )
    const archived = await archivedItem('DOMAIN')
    await query('INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)', [
      v.id,
      archived,
    ])
    const kept = await updateVenture(m.accountId, v.id, { domain_ids: [DOMAIN, archived] })
    expect(kept.domains.map((d) => d.status).sort()).toEqual(['ACTIVE', 'ARCHIVED'])
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    expect(await refusal(updateVenture(m.accountId, v.id, { name: 'No' }))).toMatchObject({
      code: 'PROFILE_DEACTIVATED',
      status: 409,
    })
    const read = await getVenture(m.accountId, v.id)
    expect([read.name, read.can_edit]).toEqual(['Active edit', false])
  })

  it('read: owner and ACTIVE member only; members cannot edit; role_label grants nothing', async () => {
    const owner = await member()
    const teammate = await member()
    const invited = await member()
    const stranger = await member()
    const v = await createVenture(owner.accountId, { type: 'STARTUP', name: 'Team' })
    // A pending invitation (DEC-WF02-S06-G1) carries the invitee's email, never a profile.
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state) VALUES ($1, $2, 'Owner', 'ACTIVE')`,
      [v.id, teammate.profileId],
    )
    await query(
      `INSERT INTO project_members (project_id, role_label, state, joined_at, invite_email_normalized, invited_by_profile_id, invited_at)
       SELECT $1, 'Co-founder', 'PENDING_CONFIRMATION', NULL, a.email_normalized, $2, now()
         FROM user_accounts a WHERE a.id = $3`,
      [v.id, owner.profileId, invited.accountId],
    )
    const seen = await getVenture(teammate.accountId, v.id)
    expect([seen.relation, seen.can_edit]).toEqual(['MEMBER', false])
    expect(
      await refusal(updateVenture(teammate.accountId, v.id, { name: 'Hijack' })),
    ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    for (const who of [invited, stranger]) {
      expect(await refusal(getVenture(who.accountId, v.id))).toMatchObject({ status: 404 })
      expect(await refusal(updateVenture(who.accountId, v.id, { name: 'x' }))).toMatchObject({
        status: 404,
      })
    }
    for (const id of ['00000000-0000-0000-0000-000000000000', 'nope']) {
      expect(await refusal(getVenture(owner.accountId, id))).toMatchObject({ status: 404 })
    }
  })

  it('the database refuses a duplicate domain relation', async () => {
    const m = await member()
    const v = await createVenture(m.accountId, { type: 'PROJECT', name: 'D', domain_ids: [DOMAIN] })
    await expect(
      query('INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)', [
        v.id,
        DOMAIN,
      ]),
    ).rejects.toMatchObject({ code: '23505' })
  })
})
