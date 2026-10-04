import { query } from '@/lib/db/client'

/**
 * ADMIN-PROD-02 — deterministic Admin foundation fixture, written directly in the
 * canonical tables and fully removable. Every id starts with `ad020000-`, every
 * slug with `adm02-fx-`, every e-mail with `adm02-fx-` at example.test. No real
 * organization, person or contact data.
 *
 *   HUB (HUB Tổng)
 *   ├── CH_A (Chapter) ── CLB_A1, CLB_A2, CLB_ARCHIVED (ARCHIVED)
 *   └── CH_B (Chapter) ── CLB_B1
 *
 * Whole-role HUB_COMMUNITY_LEADER assignments: hubLeader on HUB, chALeader on
 * CH_A, chBLeader on CH_B, clbA1Leader on CLB_A1; PLATFORM_ADMIN: admin. CLB_A2
 * and CLB_B1 have no handler (PD-1 fallback). The others are plain members; one
 * account is BLOCKED and one profile DEACTIVATED.
 */

const id = (n: number) => `ad020000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`

export const ADM_FX = {
  org: {
    HUB: id(0x01),
    CH_A: id(0x11),
    CH_B: id(0x12),
    CLB_A1: id(0x21),
    CLB_A2: id(0x22),
    CLB_ARCHIVED: id(0x29),
    CLB_B1: id(0x31),
  },
} as const

type PersonKey =
  | 'admin'
  | 'hubLeader'
  | 'chALeader'
  | 'chBLeader'
  | 'clbA1Leader'
  | 'memberA'
  | 'memberB'
  | 'memberC'
  | 'blocked'
  | 'deactivated'

const PEOPLE: Record<
  PersonKey,
  { n: number; account: 'ACTIVE' | 'BLOCKED'; profile: 'ACTIVE' | 'DEACTIVATED' }
> = {
  admin: { n: 1, account: 'ACTIVE', profile: 'ACTIVE' },
  hubLeader: { n: 2, account: 'ACTIVE', profile: 'ACTIVE' },
  chALeader: { n: 3, account: 'ACTIVE', profile: 'ACTIVE' },
  chBLeader: { n: 4, account: 'ACTIVE', profile: 'ACTIVE' },
  clbA1Leader: { n: 5, account: 'ACTIVE', profile: 'ACTIVE' },
  memberA: { n: 6, account: 'ACTIVE', profile: 'ACTIVE' },
  memberB: { n: 7, account: 'ACTIVE', profile: 'ACTIVE' },
  memberC: { n: 8, account: 'ACTIVE', profile: 'ACTIVE' },
  blocked: { n: 9, account: 'BLOCKED', profile: 'ACTIVE' },
  deactivated: { n: 10, account: 'ACTIVE', profile: 'DEACTIVATED' },
}

export const ADM_PEOPLE = Object.fromEntries(
  Object.entries(PEOPLE).map(([key, p]) => [
    key,
    { account: id(0xa00 + p.n), profile: id(0xb00 + p.n) },
  ]),
) as Record<PersonKey, { account: string; profile: string }>

const ORGS: Array<[string, 'HUB' | 'CHAPTER' | 'CLB', string, string | null, string]> = [
  [ADM_FX.org.HUB, 'HUB', 'hub', null, 'PUBLISHED'],
  [ADM_FX.org.CH_A, 'CHAPTER', 'chapter-a', ADM_FX.org.HUB, 'PUBLISHED'],
  [ADM_FX.org.CH_B, 'CHAPTER', 'chapter-b', ADM_FX.org.HUB, 'PUBLISHED'],
  [ADM_FX.org.CLB_A1, 'CLB', 'clb-a1', ADM_FX.org.CH_A, 'PUBLISHED'],
  [ADM_FX.org.CLB_A2, 'CLB', 'clb-a2', ADM_FX.org.CH_A, 'PUBLISHED'],
  [ADM_FX.org.CLB_ARCHIVED, 'CLB', 'clb-archived', ADM_FX.org.CH_A, 'ARCHIVED'],
  [ADM_FX.org.CLB_B1, 'CLB', 'clb-b1', ADM_FX.org.CH_B, 'PUBLISHED'],
]

const LEADERS: Array<[PersonKey, string]> = [
  ['hubLeader', ADM_FX.org.HUB],
  ['chALeader', ADM_FX.org.CH_A],
  ['chBLeader', ADM_FX.org.CH_B],
  ['clbA1Leader', ADM_FX.org.CLB_A1],
]

const FX_LIKE = 'ad020000-%'

export async function clearAdminFixture(): Promise<void> {
  await query(`DELETE FROM notifications WHERE recipient_account_id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM audit_events WHERE actor_account_id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM role_verification_requests WHERE requester_profile_id::text LIKE $1`, [
    FX_LIKE,
  ])
  await query(
    `DELETE FROM venture_reviews WHERE venture_id IN
       (SELECT id FROM projects WHERE owner_profile_id::text LIKE $1)`,
    [FX_LIKE],
  )
  await query(`DELETE FROM projects WHERE owner_profile_id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM account_action_requests WHERE target_account_id::text LIKE $1`, [
    FX_LIKE,
  ])
  await query(`DELETE FROM account_deletion_requests WHERE account_id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM feedback_submissions WHERE account_id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM role_assignments WHERE individual_profile_id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM community_memberships WHERE profile_id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM leadership_records WHERE profile_id::text LIKE $1`, [FX_LIKE])
  await query(
    `DELETE FROM organization_relationships
      WHERE source_org_id::text LIKE $1 OR target_org_id::text LIKE $1`,
    [FX_LIKE],
  )
  await query(`DELETE FROM organizations WHERE id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM individual_profiles WHERE id::text LIKE $1`, [FX_LIKE])
  await query(`DELETE FROM user_accounts WHERE id::text LIKE $1`, [FX_LIKE])
}

export async function seedAdminFixture(): Promise<void> {
  await clearAdminFixture()
  for (const [orgId, type, slug, , status] of ORGS) {
    await query(
      `INSERT INTO organizations (id, type, slug, name, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [orgId, type, `adm02-fx-${slug}`, `ADM02 ${slug}`, status],
    )
  }
  for (const [orgId, , , parent] of ORGS) {
    if (!parent) continue
    await query(
      `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type)
       VALUES ($1, $2, 'PARENT')`,
      [parent, orgId],
    )
  }
  for (const [key, person] of Object.entries(PEOPLE) as Array<
    [PersonKey, (typeof PEOPLE)[PersonKey]]
  >) {
    const ids = ADM_PEOPLE[key]
    const email = `adm02-fx-${key.toLowerCase()}@example.test`
    await query(
      `INSERT INTO user_accounts (id, email, email_normalized, status) VALUES ($1, $2, $2, $3)`,
      [ids.account, email, person.account],
    )
    await query(
      `INSERT INTO individual_profiles (id, account_id, status, display_name, onboarding_completed_at)
       VALUES ($1, $2, $3, $4, now())`,
      [ids.profile, ids.account, person.profile, `ADM02 ${key}`],
    )
  }
  await query(
    `INSERT INTO role_assignments (account_id, individual_profile_id, role_code, scope_type)
     VALUES ($1, $2, 'PLATFORM_ADMIN', 'PLATFORM')`,
    [ADM_PEOPLE.admin.account, ADM_PEOPLE.admin.profile],
  )
  for (const [key, orgId] of LEADERS) {
    await query(
      `INSERT INTO role_assignments (account_id, individual_profile_id, role_code, scope_type, scope_id)
       VALUES ($1, $2, 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', $3)`,
      [ADM_PEOPLE[key].account, ADM_PEOPLE[key].profile, orgId],
    )
  }
}

/** A capability-only (or whole-role) grant written directly, for scope tests. */
export async function insertGrant(
  person: PersonKey,
  orgId: string,
  capability: string | null,
  options: { state?: 'ACTIVE' | 'CLOSED'; validTo?: string | null; assignedBy?: PersonKey } = {},
): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO role_assignments
       (account_id, individual_profile_id, role_code, scope_type, scope_id, capability, state,
        valid_to, assigned_by)
     VALUES ($1, $2, 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', $3, $4, $5, $6, $7)
     RETURNING id::text`,
    [
      ADM_PEOPLE[person].account,
      ADM_PEOPLE[person].profile,
      orgId,
      capability,
      options.state ?? 'ACTIVE',
      options.validTo ?? null,
      options.assignedBy ? ADM_PEOPLE[options.assignedBy].profile : null,
    ],
  )
  return row!.id
}
