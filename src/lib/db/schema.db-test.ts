import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, query } from './client'

/**
 * M0-T06A — schema compatibility, asserted against a live PostgreSQL.
 *
 * These assertions run on the real engine, not a doc reading and not SQLite, so
 * a claim about what the database can store is backed by the database itself.
 *
 * SCOPE: this test RECORDS the frozen schema's current capability. Where the
 * schema cannot hold a state the Data SOT or API contract requires, the test
 * asserts the gap exists rather than asserting the desired value. That is
 * deliberate: M0-T06A is forbidden from fixing lifecycle states, so a test
 * demanding the correct value would fail for a reason nobody is allowed to
 * resolve yet. When migration 002 lands, these expectations flip and the flip
 * is the proof the gap closed.
 */
const MIGRATION = readFileSync(
  join(process.cwd(), 'db', 'migrations', '001_p0_init.sql'),
  'utf8',
)

// Reset first so this suite is independent of run order. The auth suite creates
// accounts and sessions, which would otherwise break the exact-match fixture
// assertions below depending on which file ran first.
beforeAll(() => {
  execFileSync('node', [join(process.cwd(), 'scripts', 'db.mjs'), 'reset'], { stdio: 'pipe' })
}, 60_000)

afterAll(async () => {
  await closePool()
})

async function enumValues(typeName: string): Promise<string[]> {
  const rows = await query<{ label: string }>(
    `SELECT e.enumlabel AS label
     FROM pg_type t
     JOIN pg_enum e ON e.enumtypid = t.oid
     WHERE t.typname = $1
     ORDER BY e.enumsortorder`,
    [typeName],
  )
  return rows.map((r) => r.label)
}

describe('M0-T06B RoleAssignment alignment', () => {
  it('anchors on individual_profile_id, not the account', async () => {
    const cols = await query<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_assignments'`,
    )
    const byName = Object.fromEntries(cols.map((c) => [c.column_name, c.is_nullable]))

    // Data SOT :297 and 03_AUTH_RBAC:53 both require this anchor.
    expect(byName['individual_profile_id']).toBe('NO')
    // account_id survives only so the frozen seed still applies; it is demoted.
    expect(byName['account_id']).toBe('YES')
  })

  it('carries the validity columns the authorization rule needs', async () => {
    const cols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_assignments'`,
    )
    const names = cols.map((c) => c.column_name)

    for (const required of ['valid_from', 'valid_to', 'assigned_by']) {
      expect(names, `${required} missing`).toContain(required)
    }
    // ended_at was renamed to valid_to rather than duplicated.
    expect(names).not.toContain('ended_at')
  })

  it('resolves the anchor for every seeded assignment', async () => {
    const rows = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM role_assignments WHERE individual_profile_id IS NULL',
    )

    expect(rows[0]!.n).toBe(0)
  })

  it('indexes the scope the authorization check actually filters on', async () => {
    const rows = await query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE tablename = 'role_assignments' AND indexname = 'idx_role_profile_scope'`,
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]!.indexdef).toContain('scope_type')
    expect(rows[0]!.indexdef).toContain('scope_id')
  })
})

describe('M0-T06A PostgreSQL foundation', () => {
  it('runs PostgreSQL, the engine the architecture freezes', async () => {
    const [row] = await query<{ server_version: string }>('SHOW server_version')

    expect(Number.parseInt(row!.server_version, 10)).toBeGreaterThanOrEqual(16)
  })

  it('applies every table the frozen migration declares', async () => {
    const declared = [...MIGRATION.matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]!)
    const live = (
      await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
      )
    ).map((r) => r.table_name)

    expect(declared).toHaveLength(27)
    for (const table of declared) {
      expect(live, `${table} missing from the live schema`).toContain(table)
    }
    // Plus the runner's own ledger.
    expect(live).toContain('schema_migrations')
  })

  it('records every applied migration with checksums', async () => {
    const rows = await query<{ filename: string; sha256: string }>(
      'SELECT filename, sha256 FROM schema_migrations ORDER BY filename',
    )

    expect(rows.map((r) => r.filename)).toEqual([
      '001_p0_init.sql',
      '002_p0_schema_alignment.sql',
      '003_p0_idempotency_store.sql',
      // WF01-REMEDIATION-01 (GAP-ROSTER): leadership uniqueness + roster reconcile routine.
      '004_p0_roster_bootstrap.sql',
      // WF01-REMEDIATION-03A (DEC-WF01-RESUME-D1): purpose_step_completed_at.
      '005_p0_purpose_step_completion.sql',
      // WF02-S07 (DEC-WF02-S07-G1): P13 account-deletion request storage.
      '006_p0_account_deletion_request.sql',
      // WF02-S05 (DEC-WF02-VENTURE-TAXONOMY-STORAGE): projects.region_id + project_domains.
      '007_p0_venture_taxonomy.sql',
      // WF02-S06 (DEC-WF02-S06-G1, P12): team lifecycle + pending email invitations.
      '008_p0_venture_team.sql',
      // WF03-S08 (DEC-WF03-S08-RELATIONSHIP-CONTRACT): one ACTIVE PARENT per child.
      '009_p0_one_active_parent.sql',
      // TASK 22-L1-L2-SOT-REALIGN (DEC-L1R-D4 / D5): four-stage onboarding data.
      '010_p0_onboarding_four_stage.sql',
      // TASK 22-L1-L2-SOT-REALIGN (DEC-L2R-D5 / D6 / D7): venture stage, creator role, member level.
      '011_p0_venture_lifecycle.sql',
      // TASK 22-L1-L2-PO-DECISION-FREEZE (DEC-PDF-D1 / D5 / D6B): visibility, stages, declarations.
      '012_p0_alpha_decision_freeze.sql',
      '013_p0_applications.sql',
      // DEC-LEGAL-V1: legal documents v1.0 (new version rows, effective 2026-10-01).
      '014_p0_legal_v1_0.sql',
      // WF04-PROD-02 (DEC-W4P-D11): programme_status with CLOSED, owner NOT NULL, content checks.
      '015_p0_programme_production.sql',
      // WF05-PROD-02 (DEC-W5P-D06): submitted applications kept, identity fixed, snapshot shape.
      '016_p0_application_integrity.sql',
      '017_p0_admin_foundation.sql',
    ])
    for (const row of rows) {
      expect(row.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})

describe('M0-T06B lifecycle gaps CLOSED by migration 002', () => {
  // These expectations are the inverse of the ones M0-T06A recorded. The flip
  // is the proof the gap closed, exactly as that report said it would be.

  it('stores the full event lifecycle the SOT defines', async () => {
    // Data SOT :213 DRAFT -> PUBLISHED -> LIVE -> ENDED | CANCELLED -> ARCHIVED.
    const values = await enumValues('event_status')

    expect(values).toEqual(['DRAFT', 'PUBLISHED', 'LIVE', 'ENDED', 'CANCELLED', 'ARCHIVED'])
  })

  it('stores the membership terminal states the SOT transitions to', async () => {
    // Data SOT :190 PENDING_APPROVAL -> ACTIVE | REJECTED | WITHDRAWN -> SUSPENDED / ALUMNI.
    const values = await enumValues('membership_state')

    expect(values).toEqual([
      'PENDING_APPROVAL',
      'ACTIVE',
      'REJECTED',
      'WITHDRAWN',
      'SUSPENDED',
      'ALUMNI',
    ])
  })

  it('stores the leadership states the SOT defines', async () => {
    // Data SOT :193 ACTIVE -> ALUMNI | REVOKED.
    expect(await enumValues('leadership_state')).toEqual(['ACTIVE', 'ALUMNI', 'REVOKED'])
  })

  it('names the deactivated profile state as the SOT does', async () => {
    // Data SOT :182 and API 05:337 say DEACTIVATED. 002 renamed INACTIVE.
    const values = await enumValues('profile_status')

    expect(values).toEqual(['DRAFT', 'ACTIVE', 'DEACTIVATED'])
    expect(values).not.toContain('INACTIVE')
  })

  it('stores the team membership states the SOT defines (008)', async () => {
    // Data SOT :204 PENDING_CONFIRMATION -> ACTIVE -> LEFT | REMOVED | REJECTED.
    expect(await enumValues('team_membership_state')).toEqual([
      'PENDING_CONFIRMATION',
      'ACTIVE',
      'LEFT',
      'REMOVED',
      'REJECTED',
    ])
    const [column] = await query<{ udt_name: string }>(
      `SELECT udt_name FROM information_schema.columns
        WHERE table_name = 'project_members' AND column_name = 'state'`,
    )
    expect(column!.udt_name).toBe('team_membership_state')
  })

  it('leaves the shared enums unpolluted', async () => {
    // Adding LIVE to publication_status would let an Organization be LIVE, and
    // ALUMNI in record_state would let a project member be ALUMNI. Per-entity
    // domains exist precisely so the shared ones stay correct.
    expect(await enumValues('publication_status')).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    expect(await enumValues('record_state')).toEqual([
      'PENDING_APPROVAL',
      'ACTIVE',
      'REJECTED',
      'CLOSED',
    ])
  })

  it('has no table for event registration', async () => {
    // Data SOT 216 and API 05:923 require it; the migration ships none.
    const rows = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE '%registration%'`,
    )

    expect(rows).toHaveLength(0)
  })

  it('still has no store for file assets or outbox, but now has one for idempotency keys', async () => {
    const live = (
      await query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      )
    ).map((r) => r.table_name)

    // FLIPPED BY M0-T10. This assertion used to record idempotency_keys as a
    // missing structure, alongside the others 002 deferred. Migration 003 closed
    // exactly that one gap, so the inversion here IS the evidence that the gap
    // closed, rather than the test being quietly relaxed.
    expect(live, 'migration 003 must create the idempotency store').toContain('idempotency_keys')

    // The other deferred structures remain absent and still need their own
    // decisions; M0-T10 was authorised for the idempotency store only.
    for (const absent of ['file_assets', 'outbox_events']) {
      expect(live, `${absent} unexpectedly present`).not.toContain(absent)
    }
  })

  it('still leaves role_code and scope_type untyped at the column level', async () => {
    const rows = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'role_assignments'
         AND column_name IN ('role_code', 'scope_type')
       ORDER BY column_name`,
    )

    // Unchanged by 002 and 007: constraining these needs a catalogue decision.
    expect(rows.map((r) => r.data_type)).toEqual(['text', 'text'])

    // The column is still permissive, but M0-T07 removed the invented codes, so
    // nothing invalid is actually stored any more. Detailed role assertions live
    // in seed.db-test.ts.
    const seeded = await query<{ role_code: string }>(
      'SELECT DISTINCT role_code FROM role_assignments ORDER BY role_code',
    )
    expect(seeded.map((r) => r.role_code)).not.toContain('ORG_ADMIN')
    expect(seeded.map((r) => r.role_code)).not.toContain('PLATFORM_OPS')
  })
})

describe('M0-T07 seed fixture quality', () => {
  it('seeds the personas the QA fixtures depend on', async () => {
    const accounts = await query<{ email: string }>(
      'SELECT email FROM user_accounts ORDER BY email',
    )

    // M0-T07 added newcomer (DRAFT, pre-onboarding) and pending
    // (PENDING_APPROVAL membership); the old seed had neither scenario.
    expect(accounts.map((a) => a.email)).toEqual([
      'leader@example.test',
      'member@example.test',
      'newcomer@example.test',
      'ops@example.test',
      'pending@example.test',
    ])
  })

  it('gives profiles fixed ids, as SEED_README promises', async () => {
    const rows = await query<{ id: string }>('SELECT id::text FROM individual_profiles ORDER BY id')

    expect(rows[0]!.id).toBe('40000000-0000-0000-0000-000000000001')
  })

  it('leaves only intentionally-empty tables unseeded', async () => {
    const empty: string[] = []
    const tables = await query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'schema_migrations'
       ORDER BY table_name`,
    )

    for (const { table_name } of tables) {
      const [count] = await query<{ n: number }>(`SELECT count(*)::int AS n FROM "${table_name}"`)
      if (count!.n === 0) empty.push(table_name)
    }

    // Down from eleven. Every remaining one is INTENTIONALLY_EMPTY_IN_M0:
    // analytics and audit are written at runtime, magic-link requests and
    // sessions belong to M0-T08 auth, feedback has no frozen pixel screen
    // (API:671), and education/links are not profile-completion groups.
    expect(empty).toEqual([
      // Migration 017 (ADMIN-PROD-02): Admin Portal runtime stores, written by
      // reviews, decisions and user submissions (no P0 path files escalations,
      // DEC-ADM-D04).
      'account_action_requests',
      // WF02-S07 P13: a runtime request store; a seeded request would be a false one.
      'account_deletion_requests',
      'analytics_events',
      // Migration 013 (DEC-L5): a founder creates an application at runtime.
      'applications',
      'audit_events',
      'auth_magic_link_requests',
      'feedback_submissions',
      // M0-T10: a runtime concurrency store. Seeding it would be meaningless,
      // and a seeded key would suppress a real request.
      'idempotency_keys',
      'notifications',
      // Migration 010: self-declared roles are written in onboarding stage 3.
      'profile_declared_roles',
      'profile_education',
      'profile_links',
      // Migration 010: specialisations are picked in onboarding stage 2.
      'profile_specializations',
      // WF02-S05: venture domains are written at runtime; the seeded startup has none.
      'project_domains',
      'role_verification_requests',
      'user_sessions',
      'venture_reviews',
    ])
  })

  it('keeps the retired seed on disk as evidence of why it was replaced', async () => {
    const before = await query<{ n: number }>('SELECT count(*)::int AS n FROM leadership_records')
    // seed_dev.sql is no longer applied. It stays byte-identical so the defects
    // that retired it remain inspectable.
    const seed = readFileSync(join(process.cwd(), 'db', 'seed', 'seed_dev.sql'), 'utf8')

    // leadership_records and role_assignments carry no ON CONFLICT clause and
    // no unique constraint, unlike every other insert in the file.
    expect(seed).toMatch(/INSERT INTO leadership_records[\s\S]*?;/)
    const leadershipInsert = seed.match(/INSERT INTO leadership_records[\s\S]*?;/)![0]
    expect(leadershipInsert).not.toMatch(/ON CONFLICT/)

    expect(before[0]!.n).toBeGreaterThan(0)
  })

  // M0 completion audit: the retired seed must not be reachable as the normal
  // entrypoint through the runner or any package script.
  it('makes the deterministic seed the only seed entrypoint', () => {
    const runner = readFileSync(join(process.cwd(), 'scripts', 'db.mjs'), 'utf8')
    const seedFileLines = runner.split('\n').filter((line) => /SEED_FILE\s*=/.test(line))
    expect(seedFileLines).toHaveLength(1)
    expect(seedFileLines[0]).toMatch(/'seed_p0_deterministic\.sql'/)
    // seed_dev.sql may appear only in comments, never as a path the runner reads.
    const code = runner.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
    expect(code).not.toMatch(/seed_dev/)

    const scripts = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'))
      .scripts as Record<string, string>
    expect(scripts['db:seed']).toBe('node scripts/db.mjs seed')
    expect(Object.values(scripts).join('\n')).not.toMatch(/seed_dev/)
  })
})

describe('TASK 22-L1-L2 venture lifecycle (migration 011)', () => {
  it('adds the stage and the creator role to projects and the level to project_members', async () => {
    const cols = await query<{
      table_name: string
      column_name: string
      data_type: string
      is_nullable: string
      column_default: string | null
    }>(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND (table_name, column_name) IN
              (('projects', 'stage_id'), ('projects', 'owner_role_label'),
               ('project_members', 'permission'))
        ORDER BY table_name, column_name`,
    )
    expect(cols).toEqual([
      {
        table_name: 'project_members',
        column_name: 'permission',
        data_type: 'text',
        is_nullable: 'NO',
        column_default: "'VIEW'::text",
      },
      {
        table_name: 'projects',
        column_name: 'owner_role_label',
        data_type: 'text',
        is_nullable: 'YES',
        column_default: null,
      },
      {
        table_name: 'projects',
        column_name: 'stage_id',
        data_type: 'uuid',
        is_nullable: 'YES',
        column_default: null,
      },
    ])
    // The stage is one controlled item, enforced by the engine.
    const fks = await query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid = 'projects'::regclass AND contype = 'f'
          AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (stage_id)%'`,
    )
    expect(fks.map((r) => r.def)).toEqual([
      'FOREIGN KEY (stage_id) REFERENCES vocabulary_items(id)',
    ])
  })

  it('ck_pm_permission admits EDIT and VIEW only; rows that existed are VIEW', async () => {
    const [check] = await query<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'ck_pm_permission' AND conrelid = 'project_members'::regclass`,
    )
    expect(check!.def).toBe("CHECK ((permission = ANY (ARRAY['EDIT'::text, 'VIEW'::text])))")
    // OWNER is ownership, never a row: the engine refuses it and writes nothing.
    // The row is a valid pending invitation in every other respect (008).
    const [project] = await query<{ id: string; owner: string }>(
      'SELECT id::text, owner_profile_id::text AS owner FROM projects LIMIT 1',
    )
    await expect(
      query(
        `INSERT INTO project_members
           (project_id, profile_id, role_label, permission, state, joined_at,
            invite_email_normalized, invited_by_profile_id, invited_at)
         VALUES ($1, NULL, 'x', 'OWNER', 'PENDING_CONFIRMATION', NULL, 'ck@example.test', $2, now())`,
        [project!.id, project!.owner],
      ),
    ).rejects.toMatchObject({ code: '23514', constraint: 'ck_pm_permission' })
    // Migration 011 backfills nothing: every seeded row carries the default.
    const [other] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM project_members WHERE permission <> 'VIEW'`,
    )
    expect(other!.n).toBe(0)
  })

  it('VENTURE_STAGE is the frozen Alpha list: stable codes, ids of 011, in order (DEC-PDF-D5)', async () => {
    const [type] = await query<{ label: string }>(
      `SELECT label FROM vocabulary_types WHERE code = 'VENTURE_STAGE'`,
    )
    expect(type).toEqual({ label: 'Giai đoạn' })
    const items = await query<{ id: string; slug: string; label: string; status: string }>(
      `SELECT id::text, slug, label, status::text AS status FROM vocabulary_items
        WHERE type_code = 'VENTURE_STAGE' ORDER BY sort_order, label`,
    )
    const stage = (n: number, slug: string, label: string) => ({
      id: `23000000-0000-0000-0000-00000000000${n}`,
      slug,
      label,
      status: 'ACTIVE',
    })
    expect(items).toEqual([
      stage(1, 'IDEA', 'Ý tưởng'),
      stage(2, 'MVP', 'MVP'),
      stage(3, 'PILOT', 'Pilot / Thử nghiệm'),
      stage(4, 'SELLING', 'Đang bán'),
      stage(5, 'GROWTH', 'Tăng trưởng'),
    ])
  })

  it('SPECIALIZATION is the frozen Alpha list of eight controlled items (DEC-PDF-D6A)', async () => {
    const items = await query<{ id: string; label: string }>(
      `SELECT id::text, label FROM vocabulary_items
        WHERE type_code = 'SPECIALIZATION' AND status = 'ACTIVE'
          AND id::text LIKE '22000000-%' ORDER BY sort_order`,
    )
    expect(items.map((i) => i.label)).toEqual([
      'Vận hành',
      'Công nghệ',
      'Tài chính',
      'Luật',
      'Design',
      'Marketing',
      'Product',
      'Business Development',
    ])
    expect(items.map((i) => i.id)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `22000000-0000-0000-0000-00000000000${n}`),
    )
  })

  it('a venture is PRIVATE by default and a DRAFT can never be PUBLIC (DEC-PDF-D1)', async () => {
    const [column] = await query<{ column_default: string; is_nullable: string }>(
      `SELECT column_default, is_nullable FROM information_schema.columns
        WHERE table_name = 'projects' AND column_name = 'visibility'`,
    )
    expect(column).toEqual({
      column_default: "'PRIVATE'::visibility_level",
      is_nullable: 'NO',
    })
    const [owner] = await query<{ id: string }>('SELECT id::text FROM individual_profiles LIMIT 1')
    await expect(
      query(
        `INSERT INTO projects (owner_profile_id, slug, name, status, visibility)
         VALUES ($1, $2, 'x', 'DRAFT', 'PUBLIC')`,
        [owner!.id, `schema-draft-public-${Date.now()}`],
      ),
    ).rejects.toThrow(/ck_projects_draft_private/)
    await expect(
      query(
        `INSERT INTO projects (owner_profile_id, slug, name, status, visibility)
         VALUES ($1, $2, 'x', 'ACTIVE', 'NETWORK_ONLY')`,
        [owner!.id, `schema-network-${Date.now()}`],
      ),
    ).rejects.toThrow(/ck_projects_visibility/)
  })

  it('a membership is not a HUB declaration unless onboarding filed it so (DEC-PDF-D6B)', async () => {
    const [column] = await query<{ column_default: string; is_nullable: string }>(
      `SELECT column_default, is_nullable FROM information_schema.columns
        WHERE table_name = 'community_memberships' AND column_name = 'hub_declaration'`,
    )
    expect(column).toEqual({ column_default: 'false', is_nullable: 'NO' })
  })
})
