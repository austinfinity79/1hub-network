import { query, withTransaction } from '@/lib/db/client'
import { acceptConsent, getCurrentDocuments } from '@/lib/legal/legal'
import { updateOwnProfile } from '@/lib/profile/profile'

import { saveDeclaredRoles } from './roles'
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

/**
 * Stage 2's minimum (FB-09, S1-UAT-05): one domain and one specialisation,
 * the seed's canonical ones, added only when the profile has none.
 */
export async function ensureCapabilityMinimum(accountId: string): Promise<void> {
  const [counts] = await query<{ domains: number; specializations: number }>(
    `SELECT (SELECT count(*)::int FROM profile_domains d WHERE d.profile_id = p.id) AS domains,
            (SELECT count(*)::int FROM profile_specializations s WHERE s.profile_id = p.id)
              AS specializations
       FROM individual_profiles p WHERE p.account_id = $1`,
    [accountId],
  )
  await updateOwnProfile(accountId, {
    ...(counts?.domains ? {} : { domain_ids: [REF.domain] }),
    ...(counts?.specializations ? {} : { specialization_ids: [REF.specialization] }),
  })
}

/**
 * Stage 3's minimum (US-01.10, S1-UAT-03): one declared role, added only when
 * the profile has none (with no role there can be no HUB position to keep).
 */
export async function ensureRoleMinimum(accountId: string): Promise<void> {
  const [row] = await query<{ roles: number }>(
    `SELECT count(r.*)::int AS roles FROM individual_profiles p
       LEFT JOIN profile_declared_roles r ON r.profile_id = p.id
      WHERE p.account_id = $1`,
    [accountId],
  )
  if (!row?.roles) {
    await saveDeclaredRoles(accountId, { roles: ['INNOVATION_ENTHUSIAST'], hub_claims: [] })
  }
}

/** Stages 2 and 3 passed as "Tiếp tục" does, with each stage's minimum in place. */
export async function passStages(accountId: string): Promise<void> {
  await ensureCapabilityMinimum(accountId)
  await passStage(accountId, { completed: 'CAPABILITY' })
  await ensureRoleMinimum(accountId)
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
