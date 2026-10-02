import { query, withTransaction } from '../db/client'
import { seedVenture } from '../venture/testing'
import { createApplication, saveApplicationAnswers, submitApplication } from './application'

/**
 * WF05-PROD-02 — deterministic WF05 fixtures for test suites (contract handoff
 * P2-3). Test support only: runtime code never imports this module and nothing
 * here is seeded into any environment. Everything is built through the
 * canonical tables and services (`projects`, `project_members`, `programmes`,
 * `programme_application_forms`, `applications`); no fixture-only table.
 *
 * Identities are fixed (e-mails, programme slugs, venture names), so every run
 * builds the same set; `buildWf05Fixture` first removes a previous run's rows.
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const RID = 'req-wf05-fixture'

export const WF05_FIXTURE_EMAILS = {
  owner: 'wf05-fx-owner@example.test',
  editor: 'wf05-fx-editor@example.test',
  viewer: 'wf05-fx-viewer@example.test',
  other: 'wf05-fx-other@example.test',
  secondOwner: 'wf05-fx-owner2@example.test',
} as const

const SLUGS = {
  open: 'wf05-fx-open',
  teamOnly: 'wf05-fx-team-only',
  startupOnly: 'wf05-fx-startup-only',
  noForm: 'wf05-fx-no-form',
  closed: 'wf05-fx-closed',
} as const

export const WF05_FIXTURE_QUESTIONS = [
  { id: 'q-problem', prompt: 'Dự án giải quyết vấn đề gì?', required: true, step: 1 },
  { id: 'q-support', prompt: 'Bạn cần hỗ trợ gì?', required: false, step: 4 },
] as const

export type Person = { accountId: string; profileId: string; email: string }

export type Wf05Fixture = {
  owner: Person
  editor: Person
  viewer: Person
  other: Person
  secondOwner: Person
  ventures: { project: string; startup: string; archived: string; secondOwner: string }
  programmes: {
    open: string
    teamOnly: string
    startupOnly: string
    noForm: string
    closed: string
  }
  applications: { draft: string; submitted: string; closedDraft: string; closedSubmitted: string }
}

/**
 * Test cleanup only. Migration 016 refuses to delete a SUBMITTED application in
 * any ordinary session; a superuser maintenance transaction with
 * `session_replication_role = replica` (ordinary triggers do not fire) is the
 * one way to remove the rows a suite created. Runtime code never does this.
 */
export async function deleteApplicationsForTest(where: string, params: unknown[]): Promise<void> {
  await withTransaction(async (exec) => {
    await exec('SET LOCAL session_replication_role = replica')
    await exec(`DELETE FROM applications WHERE ${where}`, params)
  })
}

async function person(email: string): Promise<Person> {
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, $2, 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id, `WF05 ${email.split('@')[0]}`],
  )
  return { accountId: a!.id, profileId: p!.id, email }
}

async function member(ventureId: string, who: Person, permission: 'EDIT' | 'VIEW') {
  await query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at, permission, updated_at)
     VALUES ($1, $2, 'Thành viên', 'ACTIVE', now(), $3, now())`,
    [ventureId, who.profileId, permission],
  )
}

async function programme(slug: string, types: string[] | null): Promise<string> {
  const [p] = await query<{ id: string }>(
    `INSERT INTO programmes (organization_id, programme_type, slug, name, status, metadata)
     VALUES ($1, 'PROGRAMME', $2, $3, 'PUBLISHED', '{}') RETURNING id::text`,
    [CHAPTER_01, slug, `WF05 fixture ${slug}`],
  )
  if (types)
    await query(
      `INSERT INTO programme_application_forms (programme_id, applicant_types, questions, version)
       VALUES ($1, $2::applicant_type[], $3::jsonb, 1)`,
      [p!.id, types, JSON.stringify(WF05_FIXTURE_QUESTIONS)],
    )
  return p!.id
}

async function draft(owner: Person, ventureId: string, programmeId: string): Promise<string> {
  const created = await createApplication(
    owner.accountId,
    { venture_id: ventureId, programme_id: programmeId },
    RID,
  )
  await saveApplicationAnswers(owner.accountId, created.id, {
    answers: [{ question_id: 'q-problem', value: 'Giảm thời gian giao hàng chặng cuối.' }],
  })
  return created.id
}

async function submitted(owner: Person, ventureId: string, programmeId: string): Promise<string> {
  const id = await draft(owner, ventureId, programmeId)
  await submitApplication(owner.accountId, id, RID)
  return id
}

/** Removes every row a previous fixture build created (by its fixed identities). */
export async function removeWf05Fixture(): Promise<void> {
  const accounts = (
    await query<{ id: string }>('SELECT id::text FROM user_accounts WHERE email = ANY($1)', [
      Object.values(WF05_FIXTURE_EMAILS),
    ])
  ).map((r) => r.id)
  const programmes = (
    await query<{ id: string }>('SELECT id::text FROM programmes WHERE slug = ANY($1)', [
      Object.values(SLUGS),
    ])
  ).map((r) => r.id)
  const ventures = (
    await query<{ id: string }>(
      `SELECT p.id::text FROM projects p JOIN individual_profiles i ON i.id = p.owner_profile_id
        WHERE i.account_id = ANY($1::uuid[])`,
      [accounts],
    )
  ).map((r) => r.id)
  await deleteApplicationsForTest(
    'venture_id = ANY($1::uuid[]) OR programme_id = ANY($2::uuid[])',
    [ventures, programmes],
  )
  await query(
    `DELETE FROM audit_events WHERE actor_account_id = ANY($1::uuid[])
        OR resource_id = ANY($2::uuid[]) OR resource_id = ANY($3::uuid[])`,
    [accounts, ventures, programmes],
  )
  await query('DELETE FROM analytics_events WHERE account_id = ANY($1::uuid[])', [accounts])
  await query(
    `DELETE FROM project_members WHERE project_id = ANY($1::uuid[])
        OR profile_id IN (SELECT id FROM individual_profiles WHERE account_id = ANY($2::uuid[]))`,
    [ventures, accounts],
  )
  await query('DELETE FROM projects WHERE id = ANY($1::uuid[])', [ventures])
  await query('DELETE FROM programme_application_forms WHERE programme_id = ANY($1::uuid[])', [
    programmes,
  ])
  await query('DELETE FROM programmes WHERE id = ANY($1::uuid[])', [programmes])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
}

/**
 * The frozen contract's fixture set (WF05-PROD-01 handoff P2-3): owner, ACTIVE
 * EDIT / VIEW members, a non-owner and a second owner; PROJECT, STARTUP and
 * ARCHIVED ventures; PUBLISHED programmes with a TEAM + STARTUP, a TEAM-only and
 * a STARTUP-only form, one without a form and a CLOSED one holding a DRAFT and a
 * SUBMITTED application; a DRAFT and a SUBMITTED application on the open one.
 */
export async function buildWf05Fixture(): Promise<Wf05Fixture> {
  await removeWf05Fixture()
  const owner = await person(WF05_FIXTURE_EMAILS.owner)
  const editor = await person(WF05_FIXTURE_EMAILS.editor)
  const viewer = await person(WF05_FIXTURE_EMAILS.viewer)
  const other = await person(WF05_FIXTURE_EMAILS.other)
  const secondOwner = await person(WF05_FIXTURE_EMAILS.secondOwner)

  const project = (
    await seedVenture(owner.accountId, { type: 'PROJECT', name: 'WF05 Fixture Project' })
  ).id
  const startup = (
    await seedVenture(owner.accountId, { type: 'STARTUP', name: 'WF05 Fixture Startup' })
  ).id
  const archived = (
    await seedVenture(owner.accountId, { type: 'STARTUP', name: 'WF05 Fixture Archived' })
  ).id
  const second = (
    await seedVenture(secondOwner.accountId, { type: 'STARTUP', name: 'WF05 Fixture Second Owner' })
  ).id
  await member(project, editor, 'EDIT')
  await member(project, viewer, 'VIEW')

  const programmes = {
    open: await programme(SLUGS.open, ['TEAM', 'STARTUP']),
    teamOnly: await programme(SLUGS.teamOnly, ['TEAM']),
    startupOnly: await programme(SLUGS.startupOnly, ['STARTUP']),
    noForm: await programme(SLUGS.noForm, null),
    closed: await programme(SLUGS.closed, ['TEAM', 'STARTUP']),
  }

  const applications = {
    draft: await draft(owner, project, programmes.open),
    submitted: await submitted(owner, startup, programmes.open),
    closedDraft: await draft(owner, project, programmes.closed),
    closedSubmitted: await submitted(owner, startup, programmes.closed),
  }
  await query(`UPDATE programmes SET status = 'CLOSED' WHERE id = $1`, [programmes.closed])
  await query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [archived])

  return {
    owner,
    editor,
    viewer,
    other,
    secondOwner,
    ventures: { project, startup, archived, secondOwner: second },
    programmes,
    applications,
  }
}
