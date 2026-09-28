import { query, withTransaction } from '@/lib/db/client'
import { acceptConsent, getCurrentDocuments } from '@/lib/legal/legal'
import { updateOwnProfile } from '@/lib/profile/profile'

import { passStage } from './state'

/**
 * Shared steps for the `*.db-test.ts` suites of the four-stage onboarding.
 * Every state is prepared through the real services, never by writing the
 * columns the resolver reads. Ids are the deterministic seed's and the
 * reference rows of migration 010.
 */
export const REF = {
  country: '21000000-0000-0000-0000-000000000001',
  region: '20000000-0000-0000-0000-000000000002',
  domain: '20000000-0000-0000-0000-000000000011',
  skill: '20000000-0000-0000-0000-000000000021',
  specialization: '22000000-0000-0000-0000-000000000001',
} as const

export async function newAccount(prefix: string): Promise<string> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

/** Stage 1 with exactly the fields ACC-06 marks required. */
export async function fillBasic(accountId: string, name = 'Minimal'): Promise<void> {
  await updateOwnProfile(accountId, {
    full_name: `${name} Full`,
    display_name: name,
    country_id: REF.country,
    region_id: REF.region,
  })
}

/** Stages 2 and 3 passed with nothing selected, as "Tiếp tục" does. */
export async function passStages(accountId: string): Promise<void> {
  await passStage(accountId, { completed: 'CAPABILITY' })
  await passStage(accountId, { completed: 'ROLE' })
}

export async function acceptBoth(accountId: string, only?: string): Promise<void> {
  for (const doc of await getCurrentDocuments()) {
    if (only && doc.type !== only) continue
    await withTransaction((exec) =>
      acceptConsent(exec, accountId, { consent_type: doc.type, policy_version: doc.version }, 'r'),
    )
  }
}

/** The activation minimum and nothing else: stage 1, stages passed, both acceptances. */
export async function readyAccount(prefix: string): Promise<string> {
  const accountId = await newAccount(prefix)
  await fillBasic(accountId)
  await passStages(accountId)
  await acceptBoth(accountId)
  return accountId
}
