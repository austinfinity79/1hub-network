import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { query } from '../../../src/lib/db/client'

/**
 * WF04-PROD-04 — shared fixtures of the WF04 specs. Programmes are created
 * through the real `/api/v1/programmes*` endpoints, as an operator would;
 * people, roles and organization states that have no API are prepared in SQL
 * and removed again by `cleanupProgrammes`.
 */

export const HUB = '10000000-0000-0000-0000-000000000001'
export const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
export const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
export const SEED_CHALLENGE = 'c0000000-0000-0000-0000-000000000001' // DRAFT, one linked event
export const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001' // PUBLISHED, form v1
export const SEED_EVENT = 'b0000000-0000-0000-0000-000000000002' // linked to SEED_CHALLENGE
export const SEED_VENTURE = '50000000-0000-0000-0000-000000000001' // STARTUP of the member

export const MEMBER = 'member@example.test'
export const LEADER = 'leader@example.test' // HUB_COMMUNITY_LEADER of Chapter 01
export const ADMIN = 'ops@example.test' // PLATFORM_ADMIN

export const API = '/api/v1/programmes'
export const routes = {
  list: '/demo/programmes',
  create: '/demo/programmes/new',
  detail: (id: string) => `/demo/programmes/${id}`,
  setup: (id: string, step: string) => `/demo/programmes/${id}/setup/${step}`,
}

const created = {
  programmes: [] as string[],
  people: [] as string[],
  accounts: [] as string[],
  orgs: [] as string[],
}

export async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** Console and hydration errors; expected 4xx resource refusals are not errors. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

export type Detail = {
  programme: { id: string; type: string; status: string; name: string; organization_id: string }
  actions: { edit: boolean; registration: boolean; publish: boolean; close: boolean }
  registration: {
    version: number
    questions: { id: string; prompt: string; required: boolean; step: number }[]
  } | null
}

/** Creates a programme through the API as the signed-in actor of `request`. */
export async function createProgramme(
  request: APIRequestContext,
  body: Record<string, unknown> = {},
): Promise<Detail> {
  const response = await request.post(API, {
    data: {
      type: 'PROGRAMME',
      organization_id: CHAPTER_01,
      name: `Chương trình ${Date.now()}`,
      ...body,
    },
  })
  expect(response.status(), await response.text()).toBe(201)
  const detail = (await response.json()) as Detail
  created.programmes.push(detail.programme.id)
  return detail
}

export async function call(
  request: APIRequestContext,
  method: 'patch' | 'put' | 'post',
  path: string,
  data?: unknown,
) {
  const response = await request[method](`${API}${path}`, data === undefined ? {} : { data })
  expect(response.status(), `${method} ${path}: ${await response.text()}`).toBe(200)
  return (await response.json()) as Detail
}

/** A completed person with one RoleAssignment (any code / scope); returns the e-mail. */
export async function person(role?: { code: string; scopeType: string; scopeId: string | null }) {
  const email = `wf04-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'WF04 QA', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  created.accounts.push(a!.id)
  created.people.push(p!.id)
  if (role)
    await query(
      `INSERT INTO role_assignments (individual_profile_id, role_code, scope_type, scope_id, state) VALUES ($1, $2, $3, $4, 'ACTIVE')`,
      [p!.id, role.code, role.scopeType, role.scopeId],
    )
  return email
}

/** A CLB with its own leader; `archive()` moves the CLB to ARCHIVED (no API exists for it). */
export async function clubWithLeader() {
  const [org] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ('CLB', $1, 'CLB kiểm thử WF04', 'PUBLISHED') RETURNING id::text`,
    [`wf04-clb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`],
  )
  created.orgs.push(org!.id)
  const leader = await person({
    code: 'HUB_COMMUNITY_LEADER',
    scopeType: 'ORGANIZATION',
    scopeId: org!.id,
  })
  return {
    id: org!.id,
    leader,
    archive: () => query(`UPDATE organizations SET status = 'ARCHIVED' WHERE id = $1`, [org!.id]),
  }
}

export async function programmeRow(id: string) {
  const [row] = await query<{
    status: string
    name: string
    summary: string | null
    starts_at: Date | null
    ends_at: Date | null
    metadata: Record<string, { stages?: unknown[]; problem_statements?: unknown[] }>
  }>(
    'SELECT status::text, name, summary, starts_at, ends_at, metadata FROM programmes WHERE id = $1',
    [id],
  )
  return row
}

export async function auditActions(id: string) {
  return (
    await query<{ action: string }>(
      'SELECT action FROM audit_events WHERE resource_id = $1 ORDER BY created_at, id',
      [id],
    )
  ).map((r) => r.action)
}

/** No horizontal page overflow at the current viewport. */
export async function expectNoOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )
  expect(overflow, `${label}: page overflow`).toBe(0)
}

export async function cleanupProgrammes() {
  const ids = [
    ...created.programmes,
    ...(
      await query<{ id: string }>(
        'SELECT id::text FROM programmes WHERE organization_id = ANY($1::uuid[])',
        [created.orgs],
      )
    ).map((r) => r.id),
  ]
  await query('DELETE FROM applications WHERE programme_id = ANY($1::uuid[])', [ids])
  await query('DELETE FROM programme_application_forms WHERE programme_id = ANY($1::uuid[])', [ids])
  await query('DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])', [ids])
  await query('DELETE FROM programmes WHERE id = ANY($1::uuid[])', [ids])
  await query(`DELETE FROM idempotency_keys WHERE operation LIKE 'programme.%'`)
  await query('DELETE FROM role_assignments WHERE individual_profile_id = ANY($1::uuid[])', [
    created.people,
  ])
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [created.people])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [created.accounts])
  await query('DELETE FROM organizations WHERE id = ANY($1::uuid[])', [created.orgs])
  for (const list of Object.values(created)) list.length = 0
}

/** Registers a programme created outside `createProgramme` (e.g. through the UI) for cleanup. */
export function track(id: string) {
  created.programmes.push(id)
}
