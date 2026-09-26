import { afterAll, describe, expect, it } from 'vitest'

import { consumeMagicLink, requestMagicLink } from '@/lib/auth/magic-link'
import { closePool, query, withTransaction } from '@/lib/db/client'
import { acceptConsent, getCurrentDocuments } from '@/lib/legal/legal'
import { updateOwnProfile } from '@/lib/profile/profile'

import { completeOnboarding } from './complete'
import { getOnboardingState, routeFor, submitPurpose } from './state'

/**
 * DEFECT-RESUME (DEC-WF01-RESUME-D1) — the one onboarding resolver against
 * live PostgreSQL. States are prepared through the real services, never by
 * guessing from later data.
 */

const REGION = '20000000-0000-0000-0000-000000000002'
const DOMAIN = '20000000-0000-0000-0000-000000000011'

afterAll(async () => {
  await closePool()
})

async function newAccount(): Promise<string> {
  const email = `res-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

const step = async (accountId: string) => (await getOnboardingState(accountId)).current_step

async function s06(accountId: string) {
  await updateOwnProfile(accountId, {
    display_name: 'Resume',
    headline: 'QA',
    region_id: REGION,
    domain_ids: [DOMAIN],
  })
}

async function accept(accountId: string, only?: string) {
  for (const doc of await getCurrentDocuments()) {
    if (only && doc.type !== only) continue
    await withTransaction((exec) =>
      acceptConsent(exec, accountId, { consent_type: doc.type, policy_version: doc.version }, 'r'),
    )
  }
}

async function purposeRow(accountId: string) {
  const [row] = await query<{ intent: string | null; at: Date | null; profiles: number }>(
    `SELECT primary_intent AS intent, purpose_step_completed_at AS at,
            (SELECT count(*)::int FROM individual_profiles WHERE account_id = $1) AS profiles
       FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
  return row
}

describe('purpose step persistence', () => {
  it('1. a brand-new account resolves to PURPOSE', async () => {
    const id = await newAccount()
    const state = await getOnboardingState(id)
    expect(state).toEqual({ completed: false, current_step: 'PURPOSE', intent: null })
    expect(routeFor(state)).toBe('/onboarding/purpose')
  })

  it('2. saving an intent records the step → PROFILE', async () => {
    const id = await newAccount()
    const state = await submitPurpose(id, { action: 'SAVE', primary_intent: 'POST_CHALLENGE' })
    expect(state.current_step).toBe('PROFILE')
    const row = await purposeRow(id)
    expect(row).toMatchObject({ intent: 'POST_CHALLENGE', profiles: 1 })
    expect(row!.at).toBeInstanceOf(Date)
    // The frozen shape without an action still saves.
    expect((await submitPurpose(id, { primary_intent: 'EXPLORE_NETWORK' })).intent).toBe(
      'EXPLORE_NETWORK',
    )
  })

  it('3–5. skipping records the step without inventing an intent → PROFILE', async () => {
    const id = await newAccount()
    const state = await submitPurpose(id, { action: 'SKIP' })
    expect(state).toEqual({ completed: false, current_step: 'PROFILE', intent: null })
    const row = await purposeRow(id)
    expect(row).toMatchObject({ intent: null, profiles: 1 })
    expect(row!.at).toBeInstanceOf(Date)
  })

  it('11. repeated skips and later edits keep the first timestamp; skip keeps an intent', async () => {
    const id = await newAccount()
    await submitPurpose(id, { action: 'SAVE', primary_intent: 'SUBMIT_SOLUTION' })
    const first = (await purposeRow(id))!.at!.getTime()
    await submitPurpose(id, { action: 'SKIP' })
    await submitPurpose(id, { action: 'SKIP' })
    await submitPurpose(id, { action: 'SAVE', primary_intent: 'ORGANIZE_COMMUNITY' })
    const row = await purposeRow(id)
    expect(row!.at!.getTime()).toBe(first)
    expect(row).toMatchObject({ intent: 'ORGANIZE_COMMUNITY', profiles: 1 })
  })

  it('13. the client cannot set the timestamp or smuggle other fields', async () => {
    const id = await newAccount()
    for (const body of [
      { action: 'SKIP', purpose_step_completed_at: '2020-01-01T00:00:00Z' },
      { primary_intent: 'EXPLORE_NETWORK', purpose_step_completed_at: '2020-01-01T00:00:00Z' },
      { action: 'SKIP', primary_intent: 'EXPLORE_NETWORK' },
      { action: 'DONE' },
      { action: 'SKIP', current_step: 'COMPLETE' },
      { primary_intent: 'EXPLORE_NETWORK', completed: true },
      null,
    ]) {
      await expect(submitPurpose(id, body)).rejects.toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
      })
    }
    expect(await purposeRow(id)).toBeUndefined()
    expect(await step(id)).toBe('PURPOSE')
  })
})

describe('resolver', () => {
  it('6–9. PROFILE → PRIVACY → COMPLETE in order; stale legal does not count', async () => {
    const id = await newAccount()
    await submitPurpose(id, { action: 'SKIP' })
    await updateOwnProfile(id, { display_name: 'Resume', region_id: REGION })
    expect(await step(id)).toBe('PROFILE') // headline and expertise missing
    await s06(id)
    expect(await step(id)).toBe('PRIVACY')
    await accept(id, 'TERMS_ACCEPTANCE')
    expect(await step(id)).toBe('PRIVACY') // Privacy missing
    await accept(id, 'PRIVACY_DATA_PROCESSING')
    expect(await step(id)).toBe('COMPLETE')
    expect(routeFor(await getOnboardingState(id))).toBe('/onboarding/complete')

    // A new Terms version makes the old acceptance stale → back to PRIVACY.
    const version = `res-${Date.now()}`
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ('TERMS_ACCEPTANCE', $1, 'T', $2, now())`,
      [version, `/legal/terms/${version}`],
    )
    try {
      expect(await step(id)).toBe('PRIVACY')
    } finally {
      await query('UPDATE legal_documents SET retired_at = now() WHERE version = $1', [version])
    }
    expect(await step(id)).toBe('COMPLETE')
  })

  it('Privacy accepted but Terms missing → PRIVACY', async () => {
    const id = await newAccount()
    await submitPurpose(id, { action: 'SKIP' })
    await s06(id)
    await accept(id, 'PRIVACY_DATA_PROCESSING')
    expect(await step(id)).toBe('PRIVACY')
  })

  it('10. ACTIVE + completed → DONE (/me); an S08 timestamp alone is not DONE', async () => {
    const id = await newAccount()
    await submitPurpose(id, { action: 'SAVE', primary_intent: 'EXPLORE_NETWORK' })
    await s06(id)
    await accept(id)
    await completeOnboarding(id, 'r')
    const state = await getOnboardingState(id)
    expect(state).toEqual({ completed: true, current_step: null, intent: 'EXPLORE_NETWORK' })
    expect(routeFor(state)).toBe('/me')

    await query(`UPDATE individual_profiles SET status = 'DEACTIVATED' WHERE account_id = $1`, [id])
    expect((await getOnboardingState(id)).completed).toBe(false)
  })

  it('does not infer the Purpose step from later data (no historical guessing)', async () => {
    const id = await newAccount()
    await s06(id)
    await accept(id)
    expect(await step(id)).toBe('PURPOSE')
  })

  it('12/14. sign-in resumes at the resolver step; resolving mutates nothing', async () => {
    const email = `res-login-${Date.now()}@example.test`
    const { token } = await requestMagicLink(email, null)
    expect((await consumeMagicLink(token)).response.onboarding).toEqual({
      completed: false,
      next_step: 'PURPOSE',
    })
    const [{ id }] = (await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [email],
    )) as [{ id: string }]
    await submitPurpose(id, { action: 'SKIP' })
    await s06(id)
    const snapshot = async () =>
      query(
        `SELECT p.*, (SELECT count(*) FROM consent_records c WHERE c.account_id = p.account_id) AS consents
           FROM individual_profiles p WHERE p.account_id = $1`,
        [id],
      )
    const before = await snapshot()
    const next = (await requestMagicLink(email, null)).token
    expect((await consumeMagicLink(next)).response.onboarding).toEqual({
      completed: false,
      next_step: 'PRIVACY',
    })
    for (let i = 0; i < 3; i++) await getOnboardingState(id)
    expect(await snapshot()).toEqual(before)
  })
})
