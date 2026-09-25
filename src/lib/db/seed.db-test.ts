import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, query } from './client'

/**
 * M0-T07 — deterministic seed system, asserted against live PostgreSQL.
 *
 * Proves the three properties the old seed lacked: deterministic identity,
 * deterministic time, and idempotency. Each is measured by actually re-running
 * the seed, not by reading the SQL.
 */
const ROOT = process.cwd()

function runSeed(): void {
  execFileSync('node', [join(ROOT, 'scripts', 'db.mjs'), 'seed'], { stdio: 'pipe' })
}

function runReset(): void {
  execFileSync('node', [join(ROOT, 'scripts', 'db.mjs'), 'reset'], { stdio: 'pipe' })
}

/** The frozen catalogue, Data SOT:316, restricted to the P0-active four (03:80-83). */
const P0_ACTIVE_ROLES = ['INDIVIDUAL_USER', 'HUB_MEMBER', 'HUB_COMMUNITY_LEADER', 'PLATFORM_ADMIN']

/** Every role code the Data SOT names, P0-active or not. */
const FROZEN_ROLE_CATALOGUE = [
  ...P0_ACTIVE_ROLES,
  'ORGANIZATION_REPRESENTATIVE',
  'STARTUP_MEMBER',
  'PROGRAMME_ORGANIZER',
  'CHALLENGE_OWNER_REPRESENTATIVE',
  'INVESTMENT_FUND_REPRESENTATIVE',
  'JUDGE',
  'MENTOR',
  'ADVISOR',
]

type CountRow = { table_name: string; n: number }

async function countsOf(tables: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  for (const table of tables) {
    const [row] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table}"`)
    out[table] = row!.n
  }
  return out
}

const FIXTURE_TABLES = [
  'user_accounts',
  'individual_profiles',
  'organizations',
  'community_memberships',
  'leadership_records',
  'role_assignments',
  'consent_records',
  'membership_bootstrap',
  'organization_relationships',
  'projects',
  'project_members',
  'events',
  'programmes',
  'profile_experience',
]

beforeAll(() => {
  // Start from a known state so a previous suite cannot mask a defect.
  runReset()
}, 60_000)

afterAll(async () => {
  await closePool()
})

describe('M0-T07 seed runs and covers P0', () => {
  it('seeds every table the P0 flows need', async () => {
    const counts = await countsOf(FIXTURE_TABLES)

    for (const [table, n] of Object.entries(counts)) {
      expect(n, `${table} is empty`).toBeGreaterThan(0)
    }
  })

  it('seeds the five personas WF01-WF03 need, including the two the old seed lacked', async () => {
    const rows = await query<{ email: string; status: string }>(
      `SELECT a.email, p.status::text AS status
       FROM user_accounts a JOIN individual_profiles p ON p.account_id = a.id
       ORDER BY a.email`,
    )

    expect(rows.map((r) => r.email)).toEqual([
      'leader@example.test',
      'member@example.test',
      'newcomer@example.test',
      'ops@example.test',
      'pending@example.test',
    ])

    // A DRAFT, pre-onboarding profile is what WF01-S05..S08 render against.
    expect(rows.find((r) => r.email === 'newcomer@example.test')!.status).toBe('DRAFT')
  })

  it('provides the PENDING_APPROVAL fallback the freeze requires to be renderable', async () => {
    // FREEZE:71 self-selection never auto-activates; FREEZE:76 the pending state
    // must be displayable. The old seed had no such row.
    const rows = await query<{ state: string; source: string }>(
      `SELECT state::text AS state, source FROM community_memberships
       WHERE state = 'PENDING_APPROVAL'`,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]!.source).toBe('SELF_DECLARED')
  })

  it('provides both consumed and unclaimed preseed rows for the D2 primary path', async () => {
    const rows = await query<{ consumed: boolean }>(
      'SELECT (consumed_at IS NOT NULL) AS consumed FROM membership_bootstrap',
    )

    expect(rows.filter((r) => r.consumed)).toHaveLength(2)
    expect(rows.filter((r) => !r.consumed)).toHaveLength(1)
  })
})

describe('M0-T07 role codes come from the frozen catalogue', () => {
  it('uses only P0-active catalogue codes', async () => {
    const rows = await query<{ role_code: string }>(
      'SELECT DISTINCT role_code FROM role_assignments ORDER BY role_code',
    )
    const codes = rows.map((r) => r.role_code)

    for (const code of codes) {
      expect(FROZEN_ROLE_CATALOGUE, `${code} is not in the Data SOT catalogue`).toContain(code)
      expect(P0_ACTIVE_ROLES, `${code} is not P0-active`).toContain(code)
    }
  })

  it('retains no trace of the invented codes', async () => {
    const rows = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_assignments
       WHERE role_code IN ('ORG_ADMIN', 'PLATFORM_OPS')`,
    )

    expect(rows[0]!.n).toBe(0)

    // Also absent from the seed source, so they cannot come back on a reseed.
    const seed = readFileSync(join(ROOT, 'db', 'seed', 'seed_p0_deterministic.sql'), 'utf8')
    expect(seed).not.toMatch(/'ORG_ADMIN'/)
    expect(seed).not.toMatch(/'PLATFORM_OPS'/)
  })

  it('anchors every assignment on the profile, per migration 002', async () => {
    const rows = await query<{ anchored: number; by_account: number }>(
      `SELECT
         count(*) FILTER (WHERE individual_profile_id IS NOT NULL)::int AS anchored,
         count(*) FILTER (WHERE account_id IS NOT NULL)::int AS by_account
       FROM role_assignments`,
    )

    expect(rows[0]!.anchored).toBeGreaterThan(0)
    // The seed writes no account_id at all, which shows the transitional column
    // and trigger kept by 002 are no longer needed by fixtures.
    expect(rows[0]!.by_account).toBe(0)
  })

  it('gives the chapter leader an authorization path for WF03 ops screens', async () => {
    const rows = await query<{ role_code: string; scope_id: string }>(
      `SELECT ra.role_code, ra.scope_id::text
       FROM role_assignments ra
       JOIN individual_profiles p ON p.id = ra.individual_profile_id
       WHERE p.display_name = 'Demo Leader' AND ra.role_code = 'HUB_COMMUNITY_LEADER'`,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]!.scope_id).toBe('10000000-0000-0000-0000-000000000101')
  })
})

describe('M0-T07 determinism', () => {
  it('uses no non-deterministic call anywhere in the seed source', async () => {
    const seed = readFileSync(join(ROOT, 'db', 'seed', 'seed_p0_deterministic.sql'), 'utf8')
    const body = seed.replace(/--[^\n]*/g, '')

    expect(body).not.toMatch(/\bnow\(\)/i)
    expect(body).not.toMatch(/gen_random_uuid\(\)/i)
    expect(body).not.toMatch(/\brandom\(\)/i)
    expect(body).not.toMatch(/current_timestamp/i)
  })

  it('reproduces identical ids and timestamps across a full reset', async () => {
    const snapshot = async () =>
      query<Record<string, unknown>>(
        `SELECT id::text AS id, state::text AS state, started_at::text AS started_at
         FROM community_memberships ORDER BY id`,
      )

    const before = await snapshot()
    runReset()
    const after = await snapshot()

    expect(after).toEqual(before)
    expect(before.length).toBeGreaterThan(0)
  }, 60_000)

  it('keeps event timestamps fixed, so screenshots cannot drift', async () => {
    const rows = await query<{ slug: string; starts_at: string }>(
      'SELECT slug, starts_at::text AS starts_at FROM events ORDER BY slug',
    )

    // The old seed used now() + interval '7 days', which moved every run.
    expect(rows.map((r) => r.starts_at)).toEqual([
      '2026-12-05 09:00:00+00',
      '2026-11-15 09:00:00+00',
    ])
  })
})

describe('M0-T07 idempotency', () => {
  it('does not duplicate anything on a second run', async () => {
    const before = await countsOf(FIXTURE_TABLES)
    runSeed()
    const after = await countsOf(FIXTURE_TABLES)

    expect(after).toEqual(before)
  }, 60_000)

  it('specifically does not duplicate the two tables the old seed did', async () => {
    // Measured in M0-T06A: leadership_records 1 -> 2 and role_assignments 2 -> 4.
    const before = await countsOf(['leadership_records', 'role_assignments'])
    runSeed()
    runSeed()
    const after = await countsOf(['leadership_records', 'role_assignments'])

    expect(after).toEqual(before)
  }, 90_000)
})

describe('M0-T07 fixture integrity', () => {
  it('respects membership lifecycle rules', async () => {
    const rows = await query<{ state: string; source: string; started_at: string | null }>(
      'SELECT state::text AS state, source, started_at::text AS started_at FROM community_memberships',
    )

    for (const row of rows) {
      // Self-selected membership must never be ACTIVE (FREEZE:71).
      if (row.source === 'SELF_DECLARED') {
        expect(row.state, 'self-selection must not be ACTIVE').not.toBe('ACTIVE')
      }
      // An active membership must record when it started.
      if (row.state === 'ACTIVE') {
        expect(row.started_at, 'ACTIVE membership needs started_at').not.toBeNull()
      }
    }
  })

  it('models profile completion on the frozen ten groups, never on membership', async () => {
    // Group 3 is "Current role/headline" per DECISION-P0-01, so headline must be
    // populated on completed profiles. NETWORK_CONTEXT is not a group, so no
    // membership join is involved in completion at all.
    const [member] = await query<{ groups: number }>(
      `SELECT (
         (display_name IS NOT NULL)::int + (avatar_asset_id IS NOT NULL)::int +
         (headline IS NOT NULL)::int + (region_vocab_id IS NOT NULL)::int +
         (bio IS NOT NULL)::int + (development_goal IS NOT NULL)::int +
         (current_need IS NOT NULL)::int
       )::int AS groups
       FROM individual_profiles WHERE display_name = 'Demo Member'`,
    )

    // Seven of the ten groups live directly on the row; domain, skills and
    // experience are relations, asserted below.
    expect(member!.groups).toBe(7)

    const [rel] = await query<{ domains: number; skills: number; experience: number }>(
      `SELECT
         (SELECT count(*) FROM profile_domains WHERE profile_id = p.id)::int AS domains,
         (SELECT count(*) FROM profile_skills WHERE profile_id = p.id)::int AS skills,
         (SELECT count(*) FROM profile_experience WHERE profile_id = p.id)::int AS experience
       FROM individual_profiles p WHERE p.display_name = 'Demo Member'`,
    )

    expect(rel!.domains).toBeGreaterThan(0)
    expect(rel!.skills).toBeGreaterThan(0)
    expect(rel!.experience).toBeGreaterThan(0)
  })

  it('includes a profile below the 80 percent KPI so both sides are testable', async () => {
    const [pending] = await query<{ display_name: string; avatar: string | null; bio: string | null }>(
      `SELECT display_name, avatar_asset_id AS avatar, bio
       FROM individual_profiles WHERE display_name = 'Demo Pending'`,
    )

    expect(pending!.avatar).toBeNull()
    expect(pending!.bio).toBeNull()
  })

  it('keeps every foreign key resolvable', async () => {
    const orphans = await query<{ label: string; n: number }>(
      `SELECT 'membership_profile' AS label, count(*)::int AS n FROM community_memberships m
         LEFT JOIN individual_profiles p ON p.id = m.profile_id WHERE p.id IS NULL
       UNION ALL SELECT 'role_profile', count(*)::int FROM role_assignments r
         LEFT JOIN individual_profiles p ON p.id = r.individual_profile_id WHERE p.id IS NULL
       UNION ALL SELECT 'consent_document', count(*)::int FROM consent_records c
         LEFT JOIN legal_documents l ON l.id = c.legal_document_id WHERE l.id IS NULL`,
    )

    for (const row of orphans) {
      expect(row.n, `${row.label} has orphans`).toBe(0)
    }
  })

  it('leaves migration 001 and the frozen seed untouched on disk', async () => {
    const frozen = readFileSync(join(ROOT, 'db', 'seed', 'seed_dev.sql'), 'utf8')

    // The superseded file is kept as evidence and must still contain the defects
    // it was retired for, proving it was retired rather than edited.
    expect(frozen).toMatch(/now\(\)/)
    expect(frozen).toMatch(/ORG_ADMIN/)

    const migration = readFileSync(join(ROOT, 'db', 'migrations', '001_p0_init.sql'), 'utf8')
    expect(migration).toMatch(/CREATE TYPE profile_status AS ENUM \('DRAFT','ACTIVE','INACTIVE'\)/)
  })
})
