import { afterAll, describe, expect, it } from 'vitest'

import { consumeMagicLink, requestMagicLink } from '@/lib/auth/magic-link'
import { closePool, query } from '@/lib/db/client'
import { updateOwnProfile } from '@/lib/profile/profile'

import { completeOnboarding } from './complete'
import { getOnboardingState, passStage, routeFor, submitPurpose } from './state'
import { REF, acceptBoth, fillBasic, newAccount, passStages } from './testing'

/**
 * The one onboarding resolver against live PostgreSQL, four-stage flow
 * (DEC-L1R-D3). States are prepared through the real services, never by
 * guessing from later data.
 */

afterAll(async () => {
  await closePool()
})

const step = async (accountId: string) => (await getOnboardingState(accountId)).current_step

async function markers(accountId: string) {
  const [row] = await query<{ capability: Date | null; role: Date | null; profiles: number }>(
    `SELECT capability_step_completed_at AS capability, role_step_completed_at AS role,
            (SELECT count(*)::int FROM individual_profiles WHERE account_id = $1) AS profiles
       FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
  return row
}

describe('resolver', () => {
  it('a brand-new account resolves to INTRO', async () => {
    const id = await newAccount('res')
    const state = await getOnboardingState(id)
    expect(state).toEqual({ completed: false, current_step: 'INTRO', intent: null })
    expect(routeFor(state)).toBe('/onboarding')
  })

  it('stage 1 is complete only with full name, display name, country and province', async () => {
    const id = await newAccount('res')
    await updateOwnProfile(id, { full_name: 'Resume Full' })
    expect(await step(id)).toBe('BASIC')
    expect(routeFor(await getOnboardingState(id))).toBe('/onboarding/profile')
    await updateOwnProfile(id, { display_name: 'Resume', region_id: REF.region })
    expect(await step(id)).toBe('BASIC') // country missing
    await updateOwnProfile(id, { country_id: REF.country })
    expect(await step(id)).toBe('CAPABILITY')
    expect(routeFor(await getOnboardingState(id))).toBe('/onboarding/capability')
    // Clearing a required field moves the account back.
    await updateOwnProfile(id, { full_name: '  ' })
    expect(await step(id)).toBe('BASIC')
  })

  it('CAPABILITY → ROLE → REVIEW in order; optional data does not pass a stage', async () => {
    const id = await newAccount('res')
    await fillBasic(id)
    await updateOwnProfile(id, { domain_ids: [REF.domain], skill_ids: [REF.skill] })
    expect(await step(id)).toBe('CAPABILITY')
    expect((await passStage(id, { completed: 'CAPABILITY' })).current_step).toBe('ROLE')
    expect(routeFor(await getOnboardingState(id))).toBe('/onboarding/purpose')
    expect((await passStage(id, { completed: 'ROLE' })).current_step).toBe('REVIEW')
    expect(routeFor(await getOnboardingState(id))).toBe('/onboarding/privacy')
  })

  it('acceptance does not move the step; REVIEW stays until completion', async () => {
    const id = await newAccount('res')
    await fillBasic(id)
    await passStages(id)
    await acceptBoth(id)
    expect(await step(id)).toBe('REVIEW')
  })

  it('ACTIVE + completed → DONE (/me); a deactivated profile is not DONE', async () => {
    const id = await newAccount('res')
    await fillBasic(id)
    await passStages(id)
    await acceptBoth(id)
    await completeOnboarding(id, 'r')
    const state = await getOnboardingState(id)
    expect(state).toEqual({ completed: true, current_step: null, intent: null })
    expect(routeFor(state)).toBe('/me')

    await query(`UPDATE individual_profiles SET status = 'DEACTIVATED' WHERE account_id = $1`, [id])
    expect((await getOnboardingState(id)).completed).toBe(false)
  })

  it('a draft of the older flow starts at INTRO and keeps what it stored', async () => {
    const id = await newAccount('res')
    await submitPurpose(id, { action: 'SAVE', primary_intent: 'EXPLORE_NETWORK' })
    await updateOwnProfile(id, {
      display_name: 'Older',
      headline: 'QA',
      region_id: REF.region,
      domain_ids: [REF.domain],
    })
    await acceptBoth(id)
    expect(await getOnboardingState(id)).toEqual({
      completed: false,
      current_step: 'INTRO',
      intent: 'EXPLORE_NETWORK',
    })
    const [row] = await query<{ display_name: string; region: string }>(
      `SELECT display_name, region_vocab_id::text AS region FROM individual_profiles
        WHERE account_id = $1`,
      [id],
    )
    expect(row).toEqual({ display_name: 'Older', region: REF.region })
  })

  it('sign-in resumes at the resolver step; resolving mutates nothing', async () => {
    const email = `res-login-${Date.now()}@example.test`
    const { token } = await requestMagicLink(email, null)
    expect((await consumeMagicLink(token)).response.onboarding).toEqual({
      completed: false,
      next_step: 'INTRO',
    })
    const [{ id }] = (await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [email],
    )) as [{ id: string }]
    await fillBasic(id)
    await passStage(id, { completed: 'CAPABILITY' })
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
      next_step: 'ROLE',
    })
    for (let i = 0; i < 3; i++) await getOnboardingState(id)
    expect(await snapshot()).toEqual(before)
    expect((await markers(id))!.profiles).toBe(1)
  })
})

describe('stage markers', () => {
  it('a stage cannot be passed before the stages in front of it', async () => {
    const id = await newAccount('res')
    await expect(passStage(id, { completed: 'CAPABILITY' })).rejects.toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
      status: 422,
      fields: { basic_stage: 'missing' },
    })
    expect(await markers(id)).toBeUndefined()

    await fillBasic(id)
    await expect(passStage(id, { completed: 'ROLE' })).rejects.toMatchObject({
      code: 'ONBOARDING_REQUIREMENTS_MISSING',
      fields: { capability_stage: 'missing' },
    })
    expect(await markers(id)).toMatchObject({ capability: null, role: null })
    expect(await step(id)).toBe('CAPABILITY')
  })

  it('repeats keep the first timestamp', async () => {
    const id = await newAccount('res')
    await fillBasic(id)
    await passStages(id)
    const first = await markers(id)
    await passStage(id, { completed: 'CAPABILITY' })
    await passStage(id, { completed: 'ROLE' })
    const again = await markers(id)
    expect(again!.capability!.getTime()).toBe(first!.capability!.getTime())
    expect(again!.role!.getTime()).toBe(first!.role!.getTime())
  })

  it('the client cannot set a timestamp, name another step or smuggle fields', async () => {
    const id = await newAccount('res')
    await fillBasic(id)
    for (const body of [
      { completed: 'CAPABILITY', capability_step_completed_at: '2020-01-01T00:00:00Z' },
      { completed: 'CAPABILITY', current_step: 'REVIEW' },
      { completed: 'REVIEW' },
      { completed: 'BASIC' },
      { completed: 'DONE' },
      { completed: true },
      {},
      [],
      null,
    ]) {
      await expect(passStage(id, body)).rejects.toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
      })
    }
    expect(await markers(id)).toMatchObject({ capability: null, role: null })
    expect(await step(id)).toBe('CAPABILITY')
  })

  it('after completion the call changes nothing', async () => {
    const id = await newAccount('res')
    await fillBasic(id)
    await passStages(id)
    await acceptBoth(id)
    await completeOnboarding(id, 'r')
    const before = await markers(id)
    expect(await passStage(id, { completed: 'ROLE' })).toMatchObject({ completed: true })
    expect(await markers(id)).toEqual(before)
  })
})

describe('the older purpose endpoint', () => {
  it('still stores an intent, and no longer moves the resolver', async () => {
    const id = await newAccount('res')
    const state = await submitPurpose(id, { action: 'SAVE', primary_intent: 'POST_CHALLENGE' })
    expect(state).toEqual({ completed: false, current_step: 'INTRO', intent: 'POST_CHALLENGE' })
    expect((await submitPurpose(id, { action: 'SKIP' })).intent).toBe('POST_CHALLENGE')
    expect((await markers(id))!.profiles).toBe(1)
  })

  it('refuses a client timestamp and unknown fields', async () => {
    const id = await newAccount('res')
    for (const body of [
      { action: 'SKIP', purpose_step_completed_at: '2020-01-01T00:00:00Z' },
      { action: 'SKIP', primary_intent: 'EXPLORE_NETWORK' },
      { action: 'DONE' },
      { primary_intent: 'EXPLORE_NETWORK', completed: true },
      null,
    ]) {
      await expect(submitPurpose(id, body)).rejects.toMatchObject({
        code: 'PROFILE_VALIDATION_FAILED',
        status: 422,
      })
    }
    expect(await markers(id)).toBeUndefined()
  })
})
