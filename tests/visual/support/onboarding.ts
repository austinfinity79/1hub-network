import { readFileSync } from 'node:fs'
import path from 'node:path'

import { expect, type APIRequestContext, type Page } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { REPO_ROOT } from '../pixel-qa/paths'

/**
 * The four-stage onboarding (DEC-L1R) as the specs drive it: through the real
 * APIs when a test only needs a member, and through the screens when the
 * journey itself is under test. Ids are the deterministic seed's, the
 * reference rows of migration 010 and the ACC-07 QA vocabulary fixture.
 */

export const IDS = {
  country: '21000000-0000-0000-0000-000000000001',
  hanoi: '20000000-0000-0000-0000-000000000001',
  danang: '20000000-0000-0000-0000-000000000002',
  chapter01: '10000000-0000-0000-0000-000000000101',
  chapter02: '10000000-0000-0000-0000-000000000102',
} as const

const qa = (n: number) => `e7000000-0000-0000-0000-${String(n).padStart(12, '0')}`

/** ACC-07 QA vocabulary fixture (tests/visual/fixtures/wf01-acc07-qa-vocabulary.sql). */
export const QA = {
  domain: { logistics: qa(1), agritech: qa(2), climate: qa(3), ai: qa(5), archived: qa(99) },
  skill: { data: qa(51), b2b: qa(52), pitching: qa(53), research: qa(54) },
  specialization: {
    operations: '22000000-0000-0000-0000-000000000001',
    technology: '22000000-0000-0000-0000-000000000002',
    finance: '22000000-0000-0000-0000-000000000003',
    legal: '22000000-0000-0000-0000-000000000004',
    design: '22000000-0000-0000-0000-000000000005',
    marketing: '22000000-0000-0000-0000-000000000006',
  },
} as const

const FIXTURE = path.join(REPO_ROOT, 'tests/visual/fixtures/wf01-acc07-qa-vocabulary.sql')

/** Applies the QA-only vocabulary; idempotent. */
export async function applyVocabularyFixture(): Promise<void> {
  await query(readFileSync(FIXTURE, 'utf8'))
}

export type Account = { email: string; accountId: string }

/** A new account, signed in through the real magic-link flow (dev login). */
export async function signInFresh(request: APIRequestContext, label: string): Promise<Account> {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
    [email],
  )
  return { email, accountId: row!.id }
}

/** Stage 1 with the fields ACC-06 marks required, plus whatever the test adds. */
export const BASIC = {
  full_name: 'Đặng Kim Chi',
  display_name: 'Kim Chi Đặng',
  country_id: IDS.country,
  region_id: IDS.danang,
} as const

export async function saveProfile(
  request: APIRequestContext,
  data: Record<string, unknown>,
): Promise<void> {
  const response = await request.patch('/api/v1/me/profile', { data })
  expect(response.status(), await response.text()).toBe(200)
}

export async function passStage(
  request: APIRequestContext,
  completed: 'CAPABILITY' | 'ROLE',
): Promise<void> {
  const response = await request.put('/api/v1/me/onboarding/stage', { data: { completed } })
  expect(response.status(), await response.text()).toBe(200)
}

export async function acceptLegal(request: APIRequestContext): Promise<void> {
  const { documents } = await (await request.get('/api/v1/legal/current')).json()
  for (const doc of documents) {
    const r = await request.post('/api/v1/me/consents/accept', {
      data: { consent_type: doc.type, policy_version: doc.version },
    })
    expect(r.ok()).toBe(true)
  }
}

/** Where the signed-in account should stand before a screen is opened. */
export type Reach = 'BASIC' | 'CAPABILITY' | 'ROLE' | 'REVIEW' | 'DONE'

/**
 * Brings the signed-in account to `reach` through the real APIs: stage 1 data,
 * then the stages passed, then both acceptances and completion.
 */
export async function reach(
  request: APIRequestContext,
  target: Reach,
  profile: Record<string, unknown> = {},
): Promise<void> {
  if (target === 'BASIC') return
  await saveProfile(request, { ...BASIC, ...profile })
  if (target === 'CAPABILITY') return
  await passStage(request, 'CAPABILITY')
  if (target === 'ROLE') return
  await passStage(request, 'ROLE')
  if (target === 'REVIEW') return
  await acceptLegal(request)
  const done = await request.post('/api/v1/me/onboarding/complete')
  expect(done.status(), await done.text()).toBe(200)
}

/** A member who finished onboarding through the real APIs. */
export async function completedAccount(
  request: APIRequestContext,
  label: string,
  profile: Record<string, unknown> = {},
): Promise<Account & { profileId: string }> {
  const account = await signInFresh(request, label)
  await reach(request, 'DONE', profile)
  const [row] = await query<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [account.accountId],
  )
  return { ...account, profileId: row!.id }
}

/** ACC-05 → ACC-10 → /me through the screens, with the required fields only. */
export async function onboardThroughUi(page: Page, name: string): Promise<void> {
  await expect(page).toHaveURL('/onboarding')
  await page.getByRole('link', { name: 'Bắt đầu' }).click()
  await expect(page).toHaveURL('/onboarding/profile')
  await page.getByLabel('Họ và tên').fill(name)
  await page.getByLabel('Quốc gia/Khu vực').selectOption(IDS.country)
  await page.getByLabel('Tỉnh/Thành phố').selectOption(IDS.danang)
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/capability')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/purpose')
  await page.getByRole('button', { name: 'Tiếp tục' }).click()
  await expect(page).toHaveURL('/onboarding/privacy')
  await page.getByRole('checkbox', { name: /Tôi đồng ý/ }).check({ force: true })
  await page.getByRole('button', { name: 'Hoàn tất hồ sơ' }).click()
  await expect(page).toHaveURL('/onboarding/complete')
  await page.getByRole('link', { name: 'Vào Tài khoản của tôi' }).click()
  await expect(page).toHaveURL('/me')
}

export type Stored = {
  status: string
  full_name: string | null
  display_name: string | null
  headline: string | null
  bio: string | null
  phone: string | null
  country: string | null
  region: string | null
  avatar: string | null
  capability_at: Date | null
  role_at: Date | null
  completed: Date | null
  claims: unknown[]
  domains: string[]
  specializations: string[]
  skills: string[]
  roles: string[]
  profiles: number
}

/** The account's profile as stored; undefined while no profile row exists. */
export async function stored(accountId: string): Promise<Stored | undefined> {
  const [row] = await query<Stored>(
    `SELECT p.status::text, p.full_name, p.display_name, p.headline, p.bio, p.phone,
            p.country_vocab_id::text AS country, p.region_vocab_id::text AS region,
            p.avatar_asset_id AS avatar, p.capability_step_completed_at AS capability_at,
            p.role_step_completed_at AS role_at, p.onboarding_completed_at AS completed,
            p.onboarding_hub_claims AS claims,
            ARRAY(SELECT vocab_id::text FROM profile_domains WHERE profile_id = p.id ORDER BY 1) AS domains,
            ARRAY(SELECT vocab_id::text FROM profile_specializations WHERE profile_id = p.id ORDER BY 1) AS specializations,
            ARRAY(SELECT vocab_id::text FROM profile_skills WHERE profile_id = p.id ORDER BY 1) AS skills,
            ARRAY(SELECT role_code FROM profile_declared_roles WHERE profile_id = p.id ORDER BY 1) AS roles,
            (SELECT count(*)::int FROM individual_profiles WHERE account_id = p.account_id) AS profiles
       FROM individual_profiles p WHERE p.account_id = $1`,
    [accountId],
  )
  return row
}

export type Membership = {
  organization_id: string
  state: string
  source: string
  claimed_position: string | null
  claimed_period: string | null
}

export async function memberships(accountId: string): Promise<Membership[]> {
  return query<Membership>(
    `SELECT m.organization_id::text, m.state::text AS state, m.source, m.claimed_position,
            m.claimed_period
       FROM community_memberships m JOIN individual_profiles p ON p.id = m.profile_id
      WHERE p.account_id = $1 ORDER BY m.organization_id`,
    [accountId],
  )
}

/** Browser console errors of a test; simulated 4xx / 5xx answers are not errors. */
export function watchConsole(page: Page, errors: string[]): void {
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d|500)/.test(m.text())) errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))
}
