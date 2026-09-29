import { afterAll, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'
import { DEMO_PROGRAMMES } from '@/lib/programme-demo/fixtures'
import { seedVenture } from '@/lib/venture/testing'

import {
  getDemoVenture,
  listDemoVentures,
  listOpenProgrammes,
  projectDemoActorKey,
} from './read-model'

/**
 * WF05-T00 — the Project / Startup demo read model (DEC-WF05-G2..G5,
 * DEC-WF05-T00-D2): canonical WF02 ventures under the WF02 relation rule, the
 * PUBLISHED WF04 programmes, eligibility, safe DTOs and no writes.
 */

const PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const LEADER = '30000000-0000-0000-0000-000000000002'
const ADMIN = '30000000-0000-0000-0000-000000000003'
const NEWCOMER = '30000000-0000-0000-0000-000000000004'

const accounts: string[] = []

afterAll(async () => {
  await query(
    `DELETE FROM project_members WHERE project_id IN
       (SELECT p.id FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
         WHERE i.account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await query(
    `DELETE FROM projects WHERE owner_profile_id IN
       (SELECT id FROM individual_profiles WHERE account_id = ANY($1::uuid[]))`,
    [accounts],
  )
  await closePool()
})

async function member(): Promise<{ accountId: string; profileId: string; email: string }> {
  const email = `wf05-t00-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF05 T00', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  accounts.push(a!.id)
  return { accountId: a!.id, profileId: p!.id, email }
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { code: error.code, status: error.status }
    throw error
  }
  throw new Error('expected a refusal')
}

async function fingerprint() {
  const table = (name: string) =>
    `(SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t::text), '')) FROM ${name} t)`
  const [row] = await query<Record<string, string>>(
    `SELECT ${table('projects')} AS projects, ${table('project_members')} AS members,
            ${table('project_domains')} AS domains, ${table('programmes')} AS programmes,
            ${table('events')} AS events, ${table('role_assignments')} AS roles,
            ${table('audit_events')} AS audit, ${table('schema_migrations')} AS ledger,
            to_regclass('public.applications')::text AS applications`,
  )
  return row!
}

async function world() {
  const owner = await member()
  const teammate = await member()
  const invitee = await member()
  const stranger = await member()
  const startup = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'WF05 Startup' })
  const project = await seedVenture(owner.accountId, { type: 'PROJECT', name: 'WF05 Project' })
  const archived = await seedVenture(owner.accountId, { type: 'STARTUP', name: 'WF05 Archived' })
  await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [archived.id])
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at)
     VALUES ($1, $2, 'Kỹ thuật', 'ACTIVE', now())`,
    [startup.id, teammate.profileId],
  )
  await query(
    `INSERT INTO project_members (project_id, invite_email_normalized, role_label, state, invited_at, invited_by_profile_id, joined_at)
     VALUES ($1, $2, 'Cố vấn', 'PENDING_CONFIRMATION', now(), $3, NULL)`,
    [startup.id, invitee.email, owner.profileId],
  )
  return { owner, teammate, invitee, stranger, startup, project, archived }
}

describe('WF05-T00 demo read model', () => {
  it('open programmes: the PUBLISHED WF04 fixture only, without counts, team or drafts', async () => {
    const open = await listOpenProgrammes()
    expect(open.map((p) => p.id)).toEqual([PROGRAMME])
    const fixture = DEMO_PROGRAMMES.find((d) => d.programme.id === PROGRAMME)!
    expect(open[0]).toEqual({
      id: PROGRAMME,
      status: 'PUBLISHED',
      type: 'PROGRAMME',
      name: fixture.programme.name,
      summary: fixture.programme.summary,
      starts_at: fixture.programme.starts_at,
      ends_at: fixture.programme.ends_at,
      organization: { name: 'Chapter 01' },
      applicant_types: ['TEAM', 'STARTUP'],
      questions: [...fixture.registration.questions],
    })
    expect(JSON.stringify(open)).not.toMatch(/application_counts|SUBMITTED|Người vận hành|stages/)
    expect(open.map((p) => p.id)).not.toContain(CHALLENGE)
  })

  it('owner: own ventures with the derived applicant type; detail with team and eligibility', async () => {
    const before = await fingerprint()
    const w = await world()
    const mid = await fingerprint()
    const list = await listDemoVentures(w.owner.accountId)
    expect(list.ventures.map((v) => [v.name, v.relation, v.type, v.applicant_type])).toEqual([
      ['WF05 Archived', 'OWNER', 'STARTUP', 'STARTUP'],
      ['WF05 Project', 'OWNER', 'PROJECT', 'TEAM'],
      ['WF05 Startup', 'OWNER', 'STARTUP', 'STARTUP'],
    ])
    expect(list.programmes.map((p) => p.id)).toEqual([PROGRAMME])

    const detail = await getDemoVenture(w.owner.accountId, w.startup.id)
    expect(detail.venture).toMatchObject({
      id: w.startup.id,
      type: 'STARTUP',
      name: 'WF05 Startup',
      status: 'DRAFT',
      relation: 'OWNER',
      applicant_type: 'STARTUP',
    })
    // Owner + ACTIVE member; never the pending invitation or its email.
    expect(detail.team).toEqual({
      members: 2,
      rows: [
        { relation: 'OWNER', display_name: 'WF05 T00', role_label: null },
        { relation: 'MEMBER', display_name: 'WF05 T00', role_label: 'Kỹ thuật' },
      ],
    })
    expect(detail.programmes.map((p) => p.eligibility)).toEqual([{ eligible: true }])
    // Archived: readable, not eligible. PROJECT → TEAM, accepted by P1.
    expect(
      (await getDemoVenture(w.owner.accountId, w.archived.id)).programmes[0]!.eligibility,
    ).toEqual({ eligible: false, reason: 'ARCHIVED' })
    const project = await getDemoVenture(w.owner.accountId, w.project.id)
    expect(project.venture.applicant_type).toBe('TEAM')
    expect(project.programmes[0]!.eligibility).toEqual({ eligible: true })

    // Nothing personal or internal in any DTO.
    const json = JSON.stringify([list, detail, project])
    expect(json).not.toMatch(
      /@|email|slug|metadata|owner_profile_id|profile_id|account|token|cookie/i,
    )
    expect(json).not.toContain(w.owner.profileId)
    // Reading wrote nothing.
    expect(await fingerprint()).toEqual(mid)
    expect(before.ledger).toBe(mid.ledger)
    expect(mid.applications).toBeNull()
  })

  it('an ACTIVE team member reads the venture but is not eligible to apply', async () => {
    const w = await world()
    const list = await listDemoVentures(w.teammate.accountId)
    expect(list.ventures).toEqual([
      {
        id: w.startup.id,
        type: 'STARTUP',
        name: 'WF05 Startup',
        status: 'DRAFT',
        relation: 'MEMBER',
        role_label: 'Kỹ thuật',
        applicant_type: 'STARTUP',
      },
    ])
    const detail = await getDemoVenture(w.teammate.accountId, w.startup.id)
    expect(detail.venture.relation).toBe('MEMBER')
    expect(detail.programmes[0]!.eligibility).toEqual({ eligible: false, reason: 'NOT_OWNER' })
    expect(await refusal(getDemoVenture(w.teammate.accountId, w.project.id))).toEqual({
      code: 'UNCONTRACTED_NOT_FOUND',
      status: 404,
    })
  })

  it('unrelated member, pending invitee, PLATFORM_ADMIN and HUB leader: the same 404; nothing listed', async () => {
    const w = await world()
    for (const accountId of [w.stranger.accountId, w.invitee.accountId, ADMIN, LEADER]) {
      expect(await refusal(getDemoVenture(accountId, w.startup.id))).toEqual({
        code: 'UNCONTRACTED_NOT_FOUND',
        status: 404,
      })
      const listed = (await listDemoVentures(accountId)).ventures.map((v) => v.id)
      expect(listed).not.toContain(w.startup.id)
    }
    for (const id of ['abc', '00000000-0000-0000-0000-000000000000', `${w.startup.id}x`, ''])
      expect(await refusal(getDemoVenture(w.owner.accountId, id))).toEqual({
        code: 'UNCONTRACTED_NOT_FOUND',
        status: 404,
      })
  })

  it('onboarding not done → 403 SCOPE_FORBIDDEN on both reads', async () => {
    expect(await refusal(listDemoVentures(NEWCOMER))).toEqual({
      code: 'SCOPE_FORBIDDEN',
      status: 403,
    })
    expect(await refusal(getDemoVenture(NEWCOMER, '50000000-0000-0000-0000-000000000001'))).toEqual(
      { code: 'SCOPE_FORBIDDEN', status: 403 },
    )
  })

  it('the store key is per actor, opaque and stable', () => {
    const key = projectDemoActorKey(LEADER)
    expect(key).toMatch(/^[0-9a-f]{16}$/)
    expect(projectDemoActorKey(LEADER)).toBe(key)
    expect(projectDemoActorKey(ADMIN)).not.toBe(key)
    expect(key).not.toContain(LEADER.slice(0, 8))
  })
})
