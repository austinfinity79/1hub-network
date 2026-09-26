import { afterAll, describe, expect, it } from 'vitest'

import { closePool, query } from '@/lib/db/client'

import { isPrimaryIntent, PRIMARY_INTENTS } from './intent'
import { getOnboardingState, setPrimaryIntent } from './state'

/**
 * WF01-S05 — onboarding intent against live PostgreSQL.
 * DEC-WF01-S05-D1 (allowlist), D3 (skip leaves NULL), D6 (revisit edits).
 */

afterAll(async () => {
  await closePool()
})

async function newAccount(): Promise<string> {
  const email = `onb-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

describe('DEC-WF01-S05-D1 allowlist', () => {
  it('is exactly the four approved P0 codes, without INVESTOR', () => {
    expect([...PRIMARY_INTENTS]).toEqual([
      'SUBMIT_SOLUTION',
      'POST_CHALLENGE',
      'ORGANIZE_COMMUNITY',
      'EXPLORE_NETWORK',
    ])
  })

  it.each([
    'INVESTOR',
    'UNKNOWN',
    '',
    ' EXPLORE_NETWORK',
    'explore_network',
    null,
    undefined,
    1,
    {},
  ])('rejects %j without coercion', async (value) => {
    expect(isPrimaryIntent(value)).toBe(false)
    const accountId = await newAccount()
    await expect(setPrimaryIntent(accountId, value)).rejects.toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      status: 422,
    })
    // Rejection writes nothing, not even a profile.
    const rows = await query('SELECT 1 FROM individual_profiles WHERE account_id = $1', [accountId])
    expect(rows).toHaveLength(0)
  })
})

describe('onboarding state', () => {
  it('a brand-new account starts at PURPOSE with no intent and no profile', async () => {
    const accountId = await newAccount()
    expect(await getOnboardingState(accountId)).toEqual({
      completed: false,
      current_step: 'PURPOSE',
      intent: null,
    })
  })

  it('the first intent write creates exactly one DRAFT profile holding only the intent', async () => {
    const accountId = await newAccount()
    const state = await setPrimaryIntent(accountId, 'SUBMIT_SOLUTION')
    expect(state).toEqual({ completed: false, current_step: 'PROFILE', intent: 'SUBMIT_SOLUTION' })
    const rows = await query<{
      status: string
      primary_intent: string
      display_name: string | null
    }>(
      'SELECT status::text, primary_intent, display_name FROM individual_profiles WHERE account_id = $1',
      [accountId],
    )
    expect(rows).toEqual([
      { status: 'DRAFT', primary_intent: 'SUBMIT_SOLUTION', display_name: null },
    ])
  })

  it('a revisit before completion changes the intent in place (D6)', async () => {
    const accountId = await newAccount()
    await setPrimaryIntent(accountId, 'SUBMIT_SOLUTION')
    await setPrimaryIntent(accountId, 'ORGANIZE_COMMUNITY')
    const rows = await query(
      'SELECT primary_intent FROM individual_profiles WHERE account_id = $1',
      [accountId],
    )
    expect(rows).toEqual([{ primary_intent: 'ORGANIZE_COMMUNITY' }])
  })

  it('a stored value outside the allowlist is not surfaced as a selection', async () => {
    const accountId = await newAccount()
    await query(
      `INSERT INTO individual_profiles (account_id, primary_intent) VALUES ($1, 'INVESTOR')`,
      [accountId],
    )
    expect((await getOnboardingState(accountId)).intent).toBeNull()
  })

  it('completed onboarding reports no current step', async () => {
    const accountId = await newAccount()
    await query(
      `INSERT INTO individual_profiles (account_id, primary_intent, onboarding_completed_at)
       VALUES ($1, 'EXPLORE_NETWORK', now())`,
      [accountId],
    )
    expect(await getOnboardingState(accountId)).toEqual({
      completed: true,
      current_step: null,
      intent: 'EXPLORE_NETWORK',
    })
  })
})
