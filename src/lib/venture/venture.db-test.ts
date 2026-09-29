import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities, deriveManagedScopes } from '@/lib/authz/session-authz'
import { closePool, query } from '@/lib/db/client'
import { fingerprintRequest, runIdempotent } from '@/lib/idempotency/store'
import { getProfileCompletion } from '@/lib/profile/completion'

import {
  createVenture,
  createVentureIn,
  getVenture,
  listOwnVentures,
  updateVenture,
} from './venture'

/**
 * WF02-S05 — canonical Project/Startup against live PostgreSQL
 * (DEC-WF02-H6/H7, DEC-WF02-S05-G1..G5, DEC-WF02-VENTURE-TAXONOMY-STORAGE;
 * DEC-L2R-D4..D7 and D9, migration 011).
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const REGION_2 = '20000000-0000-0000-0000-000000000001'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const DOMAIN_2 = '20000000-0000-0000-0000-000000000012'
const SKILL = '20000000-0000-0000-0000-000000000021'
const STAGE = '23000000-0000-0000-0000-000000000001'
const STAGE_2 = '23000000-0000-0000-0000-000000000003'

const RID = 'req-venture-test'

/** What DEC-L2R-D4 requires on create besides type and name. */
const REQUIRED = { summary: 'Mô tả một dòng', domain_ids: [DOMAIN], stage_id: STAGE }

afterAll(async () => {
  // Test vocabulary only: unlink it first (FK), then remove it.
  const items = `(SELECT id FROM vocabulary_items WHERE slug LIKE 'venture-test-%')`
  await query(`DELETE FROM project_domains WHERE vocabulary_item_id IN ${items}`)
  await query(`UPDATE projects SET stage_id = NULL WHERE stage_id IN ${items}`)
  await query("DELETE FROM vocabulary_items WHERE slug LIKE 'venture-test-%'")
  await query("DELETE FROM idempotency_keys WHERE idempotency_key LIKE 'venture-test-%'")
  await closePool()
})

type Member = { accountId: string; profileId: string; email: string }

/** A completed member (onboarding DONE), directly in canonical rows. */
async function member(done = true): Promise<Member> {
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
  return { accountId: a!.id, profileId: p!.id, email }
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

async function archivedItem(type: 'REGION' | 'DOMAIN' | 'VENTURE_STAGE'): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO vocabulary_items (type_code, slug, label, status) VALUES ($1, $2, 'Archived', 'ARCHIVED') RETURNING id::text`,
    [
      type,
      `venture-test-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    ],
  )
  return row!.id
}

/** What a member has written: the ventures it owns and the audit events of its account. */
async function written(who: Member) {
  const [row] = await query<{ ventures: number; audits: number }>(
    `SELECT (SELECT count(*)::int FROM projects WHERE owner_profile_id = $1) AS ventures,
            (SELECT count(*)::int FROM audit_events WHERE actor_account_id = $2) AS audits`,
    [who.profileId, who.accountId],
  )
  return row!
}

async function auditsFor(ventureId: string) {
  return query<{
    action: string
    actor: string
    before_data: unknown
    after_data: unknown
    request_id: string
  }>(
    `SELECT action, actor_account_id::text AS actor, before_data, after_data, request_id
       FROM audit_events
      WHERE resource_type = 'project' AND resource_id = $1 ORDER BY created_at, id`,
    [ventureId],
  )
}

/** A team row written directly; the invitation path is covered by team.db-test.ts. */
async function teamRow(
  ventureId: string,
  who: Member,
  permission: 'EDIT' | 'VIEW',
  roleLabel: string,
  state: 'ACTIVE' | 'REMOVED' = 'ACTIVE',
) {
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, permission, state, ended_at)
     VALUES ($1, $2, $3, $4, $5::team_membership_state, $6)`,
    [
      ventureId,
      who.profileId,
      roleLabel,
      permission,
      state,
      state === 'REMOVED' ? new Date() : null,
    ],
  )
}

/** A pending invitation (DEC-WF02-S06-G1) carries the invitee's email, never a profile. */
async function pendingRow(ventureId: string, owner: Member, invitee: Member) {
  await query(
    `INSERT INTO project_members (project_id, role_label, state, joined_at, invite_email_normalized, invited_by_profile_id, invited_at)
     VALUES ($1, 'Co-founder', 'PENDING_CONFIRMATION', NULL, $2, $3, now())`,
    [ventureId, invitee.email, owner.profileId],
  )
}

/** A venture as it was stored before DEC-L2R-D4: no summary, no field, no stage. */
async function olderVenture(owner: Member): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO projects (type, owner_profile_id, slug, name, status)
     VALUES ('PROJECT', $1, $2, 'Older', 'DRAFT') RETURNING id::text`,
    [owner.profileId, `venture-test-${Date.now()}-${Math.random().toString(36).slice(2)}`],
  )
  return row!.id
}

/** Everything that could carry authority on the platform for this member. */
async function authority(who: Member) {
  const [row] = await query<{ roles: number; leadership: number }>(
    `SELECT (SELECT count(*)::int FROM role_assignments
              WHERE individual_profile_id = $1 OR account_id = $2) AS roles,
            (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS leadership`,
    [who.profileId, who.accountId],
  )
  const actor = await resolveActor(who.accountId)
  return {
    ...row!,
    capabilities: deriveCapabilities(actor),
    scopes: deriveManagedScopes(actor),
  }
}

describe('WF02-S05 create', () => {
  it('PROJECT and STARTUP: DRAFT, owner from the session, stage and creator role stored, no owner member row', async () => {
    const m = await member()
    for (const type of ['PROJECT', 'STARTUP'] as const) {
      const v = await createVenture(
        m.accountId,
        {
          type,
          name: `  ${type} A  `,
          summary: '  Truy xuất nguồn gốc nông sản  ',
          domain_ids: [DOMAIN],
          stage_id: STAGE_2,
          owner_role_label: '  Founder ',
        },
        RID,
      )
      expect(v).toMatchObject({
        type,
        name: `${type} A`,
        summary: 'Truy xuất nguồn gốc nông sản',
        status: 'DRAFT',
        stage: { id: STAGE_2, label: 'Pilot', status: 'ACTIVE' },
        region: null,
        relation: 'OWNER',
        permission: 'OWNER',
        role_label: 'Founder',
        can_edit: true,
      })
      expect(v.domains.map((d) => d.id)).toEqual([DOMAIN])
      // Reloaded, the record is the one that was answered.
      expect(await getVenture(m.accountId, v.id)).toEqual(v)
      const [row] = await query<Record<string, unknown>>(
        `SELECT owner_profile_id::text AS owner, slug, metadata, stage_id::text AS stage_id,
                owner_role_label
           FROM projects WHERE id = $1`,
        [v.id],
      )
      expect(row).toMatchObject({
        owner: m.profileId,
        metadata: {},
        stage_id: STAGE_2,
        owner_role_label: 'Founder',
      })
      const members = await query('SELECT 1 FROM project_members WHERE project_id = $1', [v.id])
      expect(members).toHaveLength(0)
      const json = JSON.stringify(v)
      expect(json).not.toContain(row!.slug as string)
      expect(json).not.toMatch(/"(slug|metadata|owner_profile_id|profile_id|account_id)"/)
      expect((await auditsFor(v.id)).map((a) => a.action)).toEqual(['VENTURE_CREATED'])
    }
  })

  it('name, description, one field and the stage are required; a refusal writes nothing', async () => {
    const m = await member()
    const full = { type: 'PROJECT', name: 'X', ...REQUIRED }
    const without = (key: keyof typeof full) =>
      Object.fromEntries(Object.entries(full).filter(([k]) => k !== key))
    for (const [body, field] of [
      [without('name'), 'name'],
      [{ ...full, name: '  ' }, 'name'],
      [without('summary'), 'summary'],
      [{ ...full, summary: '  ' }, 'summary'],
      [{ ...full, summary: null }, 'summary'],
      [without('domain_ids'), 'domain_ids'],
      [{ ...full, domain_ids: [] }, 'domain_ids'],
      [without('stage_id'), 'stage_id'],
      [{ ...full, stage_id: null }, 'stage_id'],
      [{ ...full, stage_id: '' }, 'stage_id'],
    ] as const) {
      expect(
        await refusal(createVenture(m.accountId, body, RID)),
        JSON.stringify(body),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [field]: 'required' },
      })
    }
    expect(await written(m)).toEqual({ ventures: 0, audits: 0 })
  })

  it('with region and domains; client owner, status and permission keys are refused', async () => {
    const m = await member()
    const other = await member()
    const v = await createVenture(
      m.accountId,
      {
        type: 'STARTUP',
        name: 'Both',
        summary: 'S',
        region_id: REGION,
        domain_ids: [DOMAIN, DOMAIN, DOMAIN_2],
        stage_id: STAGE,
      },
      RID,
    )
    expect(v.region?.id).toBe(REGION)
    expect(v.domains.map((d) => d.id)).toEqual([DOMAIN, DOMAIN_2])
    for (const key of [
      'owner_profile_id',
      'profile_id',
      'account_id',
      'status',
      'permission',
      'relation',
      'can_edit',
      'slug',
      'metadata',
    ]) {
      const r = await refusal(
        createVenture(
          m.accountId,
          { type: 'PROJECT', name: 'X', ...REQUIRED, [key]: other.profileId },
          RID,
        ),
      )
      expect(r, key).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [key]: 'not_accepted' },
      })
    }
    expect(await written(m)).toEqual({ ventures: 1, audits: 1 })
    expect(await written(other)).toEqual({ ventures: 0, audits: 0 })
  })

  it('validates type, text and taxonomy; an archived item cannot be newly selected; a failure writes nothing', async () => {
    const m = await member()
    const archivedRegion = await archivedItem('REGION')
    const archivedDomain = await archivedItem('DOMAIN')
    const archivedStage = await archivedItem('VENTURE_STAGE')
    const ok = { type: 'PROJECT', name: 'X', ...REQUIRED }
    for (const [body, field, reason] of [
      [{ name: 'X', ...REQUIRED }, 'type', 'invalid'],
      [{ ...ok, type: 'TEAM' }, 'type', 'invalid'],
      [{ ...ok, name: 'x'.repeat(201) }, 'name', 'too_long'],
      [{ ...ok, summary: 'x'.repeat(2001) }, 'summary', 'too_long'],
      [{ ...ok, summary: 42 }, 'summary', 'invalid'],
      [{ ...ok, region_id: '00000000-0000-0000-0000-000000000000' }, 'region_id', 'unknown'],
      [{ ...ok, region_id: DOMAIN }, 'region_id', 'wrong_type'],
      [{ ...ok, domain_ids: [SKILL] }, 'domain_ids', 'wrong_type'],
      [{ ...ok, domain_ids: ['not-a-uuid'] }, 'domain_ids', 'unknown'],
      [{ ...ok, region_id: REGION, domain_ids: [DOMAIN, REGION] }, 'domain_ids', 'wrong_type'],
      [{ ...ok, domain_ids: DOMAIN }, 'domain_ids', 'invalid'],
      [
        { ...ok, domain_ids: Array.from({ length: 11 }, (_, i) => `d${i}`) },
        'domain_ids',
        'too_many',
      ],
      [{ ...ok, stage_id: DOMAIN }, 'stage_id', 'wrong_type'],
      [{ ...ok, stage_id: REGION }, 'stage_id', 'wrong_type'],
      [{ ...ok, stage_id: '00000000-0000-0000-0000-000000000000' }, 'stage_id', 'unknown'],
      [{ ...ok, stage_id: 'idea' }, 'stage_id', 'unknown'],
      [{ ...ok, stage_id: [STAGE] }, 'stage_id', 'invalid'],
    ] as const) {
      expect(
        await refusal(createVenture(m.accountId, body, RID)),
        JSON.stringify(body),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [field]: reason },
      })
    }
    for (const [extra, field] of [
      [{ region_id: archivedRegion }, 'region_id'],
      [{ domain_ids: [archivedDomain] }, 'domain_ids'],
      [{ stage_id: archivedStage }, 'stage_id'],
    ] as const) {
      expect(
        await refusal(createVenture(m.accountId, { ...ok, ...extra }, RID)),
        field,
      ).toMatchObject({
        code: 'VOCABULARY_ITEM_INACTIVE',
        status: 422,
        fields: { [field]: 'inactive' },
      })
    }
    expect(await written(m)).toEqual({ ventures: 0, audits: 0 })
  })

  it('DEC-L2R-D6: the creator role is optional display text, bounded, and grants nothing', async () => {
    const m = await member()
    const bare = await createVenture(
      m.accountId,
      { type: 'PROJECT', name: 'No role', summary: 'S', domain_ids: [DOMAIN], stage_id: STAGE },
      RID,
    )
    expect([bare.role_label, bare.permission]).toEqual([null, 'OWNER'])
    for (const [label, reason] of [
      ['x'.repeat(101), 'too_long'],
      [42, 'invalid'],
    ] as const) {
      expect(
        await refusal(
          createVenture(
            m.accountId,
            { type: 'PROJECT', name: 'X', ...REQUIRED, owner_role_label: label },
            RID,
          ),
        ),
      ).toMatchObject({ status: 422, fields: { owner_role_label: reason } })
    }
    for (const label of ['Founder', 'PLATFORM_ADMIN']) {
      const v = await createVenture(
        m.accountId,
        { type: 'STARTUP', name: label, ...REQUIRED, owner_role_label: label },
        RID,
      )
      expect([v.role_label, v.permission]).toEqual([label, 'OWNER'])
    }
    expect(await authority(m)).toEqual({ roles: 0, leadership: 0, capabilities: [], scopes: [] })
  })

  it('G2: an account whose onboarding is not DONE cannot create', async () => {
    const m = await member(false)
    expect(
      await refusal(createVenture(m.accountId, { type: 'PROJECT', name: 'X', ...REQUIRED }, RID)),
    ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    expect(await written(m)).toEqual({ ventures: 0, audits: 0 })
  })

  it('DEC-L2R-D9: a repeated request under one Idempotency-Key creates one venture', async () => {
    const m = await member()
    const submit = (key: string, body: unknown) =>
      runIdempotent({
        key,
        operation: 'venture.create',
        actorAccountId: m.accountId,
        fingerprint: fingerprintRequest({ body }),
        run: async (exec) => ({
          status: 201,
          body: await createVentureIn(exec, m.accountId, body, RID),
        }),
      })
    const key = `venture-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const body = { type: 'STARTUP', name: 'Once', ...REQUIRED }

    // A refused create rolls its claim back with it, so the key stays free.
    expect(await refusal(submit(key, { ...body, stage_id: null }))).toMatchObject({
      status: 422,
      fields: { stage_id: 'required' },
    })
    const first = await submit(key, body)
    expect(first).toMatchObject({
      status: 201,
      replayed: false,
      body: { name: 'Once', status: 'DRAFT', relation: 'OWNER' },
    })
    expect(await submit(key, body)).toEqual({ ...first, replayed: true })
    expect(await refusal(submit(key, { ...body, name: 'Twice' }))).toMatchObject({
      code: 'UNCONTRACTED_IDEMPOTENCY_CONFLICT',
      status: 409,
    })
    expect(await written(m)).toEqual({ ventures: 1, audits: 1 })

    // A double submit: both answers are the same venture.
    const double = await Promise.all([submit(`${key}-2`, body), submit(`${key}-2`, body)])
    expect(double.map((d) => d.replayed).sort()).toEqual([false, true])
    expect(double[0]!.body).toEqual(double[1]!.body)
    expect(await written(m)).toEqual({ ventures: 2, audits: 2 })
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
    const v = await createVenture(
      m.accountId,
      {
        type: 'PROJECT',
        name: 'P',
        summary: 'S',
        region_id: REGION,
        domain_ids: [DOMAIN],
        stage_id: STAGE,
      },
      RID,
    )
    await updateVenture(
      m.accountId,
      v.id,
      { summary: 'changed', region_id: null, domain_ids: [DOMAIN_2], stage_id: STAGE_2 },
      RID,
    )
    expect(await getProfileCompletion(m.accountId)).toEqual(before)
    expect(await events()).toBe(e0)
  })
})

describe('WF02-S05 update and read', () => {
  it('owner edits scalars, stage and creator role, replaces domains, clears region; type is immutable', async () => {
    const m = await member()
    const v = await createVenture(
      m.accountId,
      {
        type: 'STARTUP',
        name: 'Old',
        summary: 'S',
        region_id: REGION,
        domain_ids: [DOMAIN],
        stage_id: STAGE,
      },
      RID,
    )
    const u = await updateVenture(
      m.accountId,
      v.id,
      {
        name: 'New',
        summary: 'Sum',
        region_id: REGION_2,
        domain_ids: [DOMAIN_2],
        stage_id: STAGE_2,
        owner_role_label: 'Co-founder',
      },
      RID,
    )
    expect([u.name, u.summary, u.region?.id, u.stage?.id, u.role_label]).toEqual([
      'New',
      'Sum',
      REGION_2,
      STAGE_2,
      'Co-founder',
    ])
    expect(u.domains.map((d) => d.id)).toEqual([DOMAIN_2])
    // Region and the creator role are optional and may be cleared.
    const cleared = await updateVenture(
      m.accountId,
      v.id,
      { region_id: null, owner_role_label: '  ' },
      RID,
    )
    expect([cleared.region, cleared.role_label]).toEqual([null, null])
    const audits = (await auditsFor(v.id)).length
    for (const key of [
      'type',
      'status',
      'owner_profile_id',
      'profile_id',
      'permission',
      'relation',
      'can_edit',
      'created_at',
      'metadata',
      'slug',
    ]) {
      const r = await refusal(
        updateVenture(
          m.accountId,
          v.id,
          { name: 'Changed', [key]: key === 'type' ? 'PROJECT' : 'x' },
          RID,
        ),
      )
      expect(r, key).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [key]: key === 'type' ? 'immutable' : 'not_accepted' },
      })
    }
    expect(await getVenture(m.accountId, v.id)).toEqual(cleared)
    expect(cleared).toMatchObject({ type: 'STARTUP', status: 'DRAFT', permission: 'OWNER' })
    expect(await auditsFor(v.id)).toHaveLength(audits)
  })

  it('DEC-L2R-D4: a stored required value cannot be cleared; an older venture keeps what it has', async () => {
    const m = await member()
    const v = await createVenture(
      m.accountId,
      { type: 'STARTUP', name: 'Full', summary: 'S', domain_ids: [DOMAIN], stage_id: STAGE },
      RID,
    )
    const clearing: [Record<string, unknown>, string][] = [
      [{ name: '  ' }, 'name'],
      [{ summary: '  ' }, 'summary'],
      [{ summary: null }, 'summary'],
      [{ domain_ids: [] }, 'domain_ids'],
      [{ stage_id: null }, 'stage_id'],
      [{ stage_id: '' }, 'stage_id'],
    ]
    for (const [body, field] of clearing) {
      // A rename rides along, so a refusal is also shown to be atomic.
      expect(
        await refusal(updateVenture(m.accountId, v.id, { name: 'Changed', ...body }, RID)),
        JSON.stringify(body),
      ).toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
        fields: { [field]: 'required' },
      })
    }
    expect(await getVenture(m.accountId, v.id)).toEqual(v)

    const older = await olderVenture(m)
    const kept = await updateVenture(
      m.accountId,
      older,
      { name: 'Older renamed', summary: null, domain_ids: [], stage_id: null },
      RID,
    )
    expect(kept).toMatchObject({ name: 'Older renamed', summary: null, domains: [], stage: null })
    // Once it has a value, the value stays.
    await updateVenture(m.accountId, older, { summary: 'Now described', stage_id: STAGE }, RID)
    expect(await refusal(updateVenture(m.accountId, older, { summary: null }, RID))).toMatchObject({
      fields: { summary: 'required' },
    })
    expect(await refusal(updateVenture(m.accountId, older, { stage_id: null }, RID))).toMatchObject(
      { fields: { stage_id: 'required' } },
    )
  })

  it('atomic: a bad domain leaves name, summary, region, stage and domains unchanged', async () => {
    const m = await member()
    const v = await createVenture(
      m.accountId,
      {
        type: 'PROJECT',
        name: 'Keep',
        summary: 'K',
        region_id: REGION,
        domain_ids: [DOMAIN],
        stage_id: STAGE,
      },
      RID,
    )
    const r = await refusal(
      updateVenture(
        m.accountId,
        v.id,
        {
          name: 'Changed',
          summary: 'C',
          region_id: REGION_2,
          stage_id: STAGE_2,
          domain_ids: [SKILL],
        },
        RID,
      ),
    )
    expect(r.status).toBe(422)
    const after = await getVenture(m.accountId, v.id)
    expect([
      after.name,
      after.summary,
      after.region?.id,
      after.stage?.id,
      after.domains.map((d) => d.id),
    ]).toEqual(['Keep', 'K', REGION, STAGE, [DOMAIN]])
    expect((await auditsFor(v.id)).map((a) => a.action)).toEqual(['VENTURE_CREATED'])
  })

  it('DEC-L2R-D9: create and update are audited with type, status and field names, never the text', async () => {
    const m = await member()
    const v = await createVenture(
      m.accountId,
      {
        type: 'STARTUP',
        name: 'Tên kín đáo',
        summary: 'Mô tả kín đáo',
        domain_ids: [DOMAIN],
        stage_id: STAGE,
        owner_role_label: 'Vai trò kín đáo',
      },
      'req-venture-created',
    )
    await updateVenture(
      m.accountId,
      v.id,
      { summary: 'Mô tả mới kín đáo', name: 'Tên mới kín đáo', stage_id: STAGE_2 },
      'req-venture-updated',
    )
    const audits = await auditsFor(v.id)
    expect(audits).toEqual([
      {
        action: 'VENTURE_CREATED',
        actor: m.accountId,
        before_data: null,
        after_data: { type: 'STARTUP', status: 'DRAFT' },
        request_id: 'req-venture-created',
      },
      {
        action: 'VENTURE_UPDATED',
        actor: m.accountId,
        before_data: { status: 'DRAFT' },
        after_data: { status: 'DRAFT', fields: ['name', 'stage_id', 'summary'] },
        request_id: 'req-venture-updated',
      },
    ])
    expect(JSON.stringify(audits)).not.toMatch(/kín đáo/)
    // A PATCH that names nothing changes nothing and writes no event.
    const before = await query<{ updated_at: Date }>(
      'SELECT updated_at FROM projects WHERE id = $1',
      [v.id],
    )
    expect((await updateVenture(m.accountId, v.id, {}, 'req-venture-empty')).name).toBe(
      'Tên mới kín đáo',
    )
    expect(await auditsFor(v.id)).toHaveLength(2)
    expect(
      await query<{ updated_at: Date }>('SELECT updated_at FROM projects WHERE id = $1', [v.id]),
    ).toEqual(before)
  })

  it('ACTIVE editable; ARCHIVED read-only; archived vocabulary already linked is kept', async () => {
    const m = await member()
    const v = await createVenture(
      m.accountId,
      { type: 'PROJECT', name: 'L', summary: 'S', domain_ids: [DOMAIN], stage_id: STAGE },
      RID,
    )
    await query(`UPDATE projects SET status = 'ACTIVE' WHERE id = $1`, [v.id])
    expect((await updateVenture(m.accountId, v.id, { name: 'Active edit' }, RID)).name).toBe(
      'Active edit',
    )
    const archived = await archivedItem('DOMAIN')
    const archivedStage = await archivedItem('VENTURE_STAGE')
    await query('INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)', [
      v.id,
      archived,
    ])
    await query('UPDATE projects SET stage_id = $2 WHERE id = $1', [v.id, archivedStage])
    const kept = await updateVenture(
      m.accountId,
      v.id,
      { domain_ids: [DOMAIN, archived], stage_id: archivedStage },
      RID,
    )
    expect(kept.domains.map((d) => d.status).sort()).toEqual(['ACTIVE', 'ARCHIVED'])
    expect(kept.stage).toMatchObject({ id: archivedStage, status: 'ARCHIVED' })
    // Kept where it is linked; another venture cannot pick it.
    const w = await createVenture(
      m.accountId,
      { type: 'PROJECT', name: 'W', summary: 'S', domain_ids: [DOMAIN], stage_id: STAGE },
      RID,
    )
    expect(
      await refusal(updateVenture(m.accountId, w.id, { stage_id: archivedStage }, RID)),
    ).toMatchObject({ code: 'VOCABULARY_ITEM_INACTIVE', fields: { stage_id: 'inactive' } })
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    expect(await refusal(updateVenture(m.accountId, v.id, { name: 'No' }, RID))).toMatchObject({
      code: 'PROFILE_DEACTIVATED',
      status: 409,
    })
    const read = await getVenture(m.accountId, v.id)
    expect([read.name, read.permission, read.can_edit]).toEqual(['Active edit', 'OWNER', false])
  })

  it('DEC-L2R-D7: an EDIT member updates the venture; a VIEW member reads it; the creator role is the owner’s', async () => {
    const owner = await member()
    const editor = await member()
    const viewer = await member()
    const v = await createVenture(
      owner.accountId,
      {
        type: 'STARTUP',
        name: 'Levels',
        summary: 'S',
        domain_ids: [DOMAIN],
        stage_id: STAGE,
        owner_role_label: 'Founder',
      },
      RID,
    )
    await teamRow(v.id, editor, 'EDIT', 'Biên tập nội dung')
    // A label reading "Owner" is still a label: the level is VIEW.
    await teamRow(v.id, viewer, 'VIEW', 'Owner')

    expect(await getVenture(editor.accountId, v.id)).toMatchObject({
      relation: 'MEMBER',
      permission: 'EDIT',
      role_label: 'Biên tập nội dung',
      can_edit: true,
    })
    expect(await getVenture(viewer.accountId, v.id)).toMatchObject({
      relation: 'MEMBER',
      permission: 'VIEW',
      role_label: 'Owner',
      can_edit: false,
    })

    const edited = await updateVenture(
      editor.accountId,
      v.id,
      { name: 'Edited', summary: 'By the editor', stage_id: STAGE_2 },
      'req-venture-editor',
    )
    expect(edited).toMatchObject({
      name: 'Edited',
      summary: 'By the editor',
      stage: { id: STAGE_2 },
      relation: 'MEMBER',
      permission: 'EDIT',
    })
    expect((await auditsFor(v.id)).at(-1)).toMatchObject({
      action: 'VENTURE_UPDATED',
      actor: editor.accountId,
      request_id: 'req-venture-editor',
    })

    for (const body of [
      { owner_role_label: 'Co-founder' },
      { owner_role_label: null },
      { name: 'With the role', owner_role_label: 'Co-founder' },
    ]) {
      expect(
        await refusal(updateVenture(editor.accountId, v.id, body, RID)),
        JSON.stringify(body),
      ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    }
    for (const body of [{ name: 'Hijack' }, { stage_id: STAGE }, { owner_role_label: 'Owner' }]) {
      expect(
        await refusal(updateVenture(viewer.accountId, v.id, body, RID)),
        JSON.stringify(body),
      ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    }
    expect(await getVenture(owner.accountId, v.id)).toMatchObject({
      name: 'Edited',
      relation: 'OWNER',
      permission: 'OWNER',
      role_label: 'Founder',
    })
    expect((await auditsFor(v.id)).map((a) => a.action)).toEqual([
      'VENTURE_CREATED',
      'VENTURE_UPDATED',
    ])
    for (const who of [editor, viewer]) {
      expect(await authority(who)).toEqual({
        roles: 0,
        leadership: 0,
        capabilities: [],
        scopes: [],
      })
    }

    // ARCHIVED is read-only for every level.
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [v.id])
    expect((await getVenture(editor.accountId, v.id)).can_edit).toBe(false)
    expect(
      await refusal(updateVenture(editor.accountId, v.id, { name: 'Late' }, RID)),
    ).toMatchObject({ code: 'PROFILE_DEACTIVATED', status: 409 })
  })

  it('read: owner and ACTIVE member only; a row without a level is VIEW; anyone else gets 404', async () => {
    const owner = await member()
    const teammate = await member()
    const invited = await member()
    const removed = await member()
    const stranger = await member()
    const v = await createVenture(
      owner.accountId,
      { type: 'STARTUP', name: 'Team', summary: 'S', domain_ids: [DOMAIN], stage_id: STAGE },
      RID,
    )
    // The shape of a row written before migration 011: no level stated.
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state) VALUES ($1, $2, 'Owner', 'ACTIVE')`,
      [v.id, teammate.profileId],
    )
    await pendingRow(v.id, owner, invited)
    await teamRow(v.id, removed, 'EDIT', 'Former editor', 'REMOVED')
    const seen = await getVenture(teammate.accountId, v.id)
    expect([seen.relation, seen.permission, seen.can_edit]).toEqual(['MEMBER', 'VIEW', false])
    expect(
      await refusal(updateVenture(teammate.accountId, v.id, { name: 'Hijack' }, RID)),
    ).toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
    for (const who of [invited, removed, stranger]) {
      expect(await refusal(getVenture(who.accountId, v.id))).toMatchObject({ status: 404 })
      expect(await refusal(updateVenture(who.accountId, v.id, { name: 'x' }, RID))).toMatchObject({
        status: 404,
      })
    }
    for (const id of ['00000000-0000-0000-0000-000000000000', 'nope']) {
      expect(await refusal(getVenture(owner.accountId, id))).toMatchObject({ status: 404 })
      expect(await refusal(updateVenture(owner.accountId, id, { name: 'x' }, RID))).toMatchObject({
        status: 404,
      })
    }
    expect((await getVenture(owner.accountId, v.id)).name).toBe('Team')
  })

  it('the database refuses a duplicate domain relation', async () => {
    const m = await member()
    const v = await createVenture(
      m.accountId,
      { type: 'PROJECT', name: 'D', summary: 'S', domain_ids: [DOMAIN], stage_id: STAGE },
      RID,
    )
    await expect(
      query('INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)', [
        v.id,
        DOMAIN,
      ]),
    ).rejects.toMatchObject({ code: '23505' })
  })
})

describe('WF02-S08 own ventures (GET /me/ventures)', () => {
  it('owned first, then by name; ACTIVE memberships only; the pending count is the owner’s to know', async () => {
    const me = await member()
    const other = await member()
    const mate = await member()
    const make = (owner: Member, name: string, extra: Record<string, unknown> = {}) =>
      createVenture(
        owner.accountId,
        { type: 'STARTUP', name, summary: 'S', domain_ids: [DOMAIN], stage_id: STAGE, ...extra },
        RID,
      )
    const beta = await make(me, 'Beta', { owner_role_label: 'Founder' })
    const alpha = await make(me, 'Alpha')
    const joined = await make(other, 'Aardvark')
    const viewed = await make(other, 'Zeta')
    const invitedTo = await make(other, 'Invited')
    const left = await make(other, 'Left')
    await make(other, 'Unrelated')
    await teamRow(alpha.id, mate, 'VIEW', 'Dev')
    await pendingRow(alpha.id, me, other)
    // A legacy owner row is neither a member nor a second listing.
    await teamRow(beta.id, me, 'VIEW', 'Owner row')
    await teamRow(joined.id, me, 'EDIT', 'CTO')
    await teamRow(viewed.id, me, 'VIEW', 'Advisor')
    await pendingRow(viewed.id, other, mate)
    await pendingRow(invitedTo.id, other, me)
    await teamRow(left.id, me, 'EDIT', 'Former', 'REMOVED')

    const list = await listOwnVentures(me.accountId)
    expect(
      list.map((v) => [
        v.name,
        v.relation,
        v.permission,
        v.role_label,
        v.can_edit,
        v.members,
        v.pending_invitations,
      ]),
    ).toEqual([
      ['Alpha', 'OWNER', 'OWNER', null, true, 2, 1],
      ['Beta', 'OWNER', 'OWNER', 'Founder', true, 1, 0],
      ['Aardvark', 'MEMBER', 'EDIT', 'CTO', true, 2, null],
      ['Zeta', 'MEMBER', 'VIEW', 'Advisor', false, 2, null],
    ])
    expect(list[0]).toMatchObject({
      id: alpha.id,
      type: 'STARTUP',
      status: 'DRAFT',
      stage: { id: STAGE },
      domains: [{ id: DOMAIN }],
    })
    const json = JSON.stringify(list)
    for (const secret of [me.email, other.email, mate.email, me.profileId, other.profileId]) {
      expect(json).not.toContain(secret)
    }
    expect(json).not.toMatch(/"(slug|metadata|owner_profile_id|profile_id|account_id|email)"/)

    // Archived ventures stay listed, read-only.
    await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [joined.id])
    const after = await listOwnVentures(me.accountId)
    expect(after.find((v) => v.id === joined.id)).toMatchObject({
      status: 'ARCHIVED',
      permission: 'EDIT',
      can_edit: false,
    })
  })

  it('an account without a profile or without ventures gets an empty list', async () => {
    const [account] = await query<{ id: string }>(
      `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
      [`ven-noprof-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`],
    )
    expect(await listOwnVentures(account!.id)).toEqual([])
    expect(await listOwnVentures((await member()).accountId)).toEqual([])
  })
})
