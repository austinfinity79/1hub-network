import { afterAll, describe, expect, it } from 'vitest'

import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities } from '@/lib/authz/session-authz'
import { closePool, query, withTransaction } from '@/lib/db/client'

import { importRoster, validateShape } from '../../../scripts/roster-lib.mjs'

import { reconcileRoster } from './reconcile'

/**
 * GAP-ROSTER (Data Freeze D2) against live PostgreSQL: import, match,
 * attach, idempotency, concurrency, conflicts, atomicity, RBAC safety.
 * Emails are generated per run so the suite can be re-run on one database;
 * organisations are seed placeholders. No real roster data.
 */

const HEADER = 'email,organization_slug,membership_state,leadership_role_label,source_batch'
const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const batch = `t-${run}`
const mail = (tag: string) => `r-${tag}-${run}@example.test`
const exec = (sql: string, params: unknown[] = []) => query(sql, params)
const csv = (...rows: string[]) => [HEADER, ...rows].join('\n')

afterAll(async () => {
  await closePool()
})

async function account(email: string): Promise<string> {
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

async function relations(accountId: string) {
  const memberships = await query<{
    slug: string
    state: string
    source: string
    started: boolean
  }>(
    `SELECT o.slug, m.state::text AS state, m.source, m.started_at IS NOT NULL AS started
       FROM community_memberships m JOIN organizations o ON o.id = m.organization_id
       JOIN individual_profiles p ON p.id = m.profile_id
      WHERE p.account_id = $1 ORDER BY o.slug`,
    [accountId],
  )
  const leadership = await query<{ slug: string; role_label: string; state: string }>(
    `SELECT o.slug, l.role_label, l.state::text AS state
       FROM leadership_records l JOIN organizations o ON o.id = l.organization_id
       JOIN individual_profiles p ON p.id = l.profile_id
      WHERE p.account_id = $1 ORDER BY o.slug`,
    [accountId],
  )
  const [{ profiles }] = (await query<{ profiles: number }>(
    'SELECT count(*)::int AS profiles FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )) as [{ profiles: number }]
  return { memberships, leadership, profiles }
}

describe('import validation', () => {
  it('rejects a wrong header and every malformed row, writing nothing', async () => {
    expect(validateShape('a,b,c\nx,y,z').errors[0]!.reason).toMatch(/header must be exactly/)
    const report = await importRoster(
      exec,
      csv(
        `not-an-email,chapter-01,ACTIVE,,${batch}`,
        `${mail('x1')},no-such-org,ACTIVE,,${batch}`,
        `${mail('x2')},chapter-01,PENDING_APPROVAL,,${batch}`,
        `${mail('x3')},chapter-01,ACTIVE,,bad batch!`,
        `${mail('x4')},chapter-01,ACTIVE`,
      ),
    )
    expect(report.errors.map((e) => e.line)).toEqual([2, 4, 5, 6, 3])
    expect(report.rows_valid).toBe(0)
    // Row errors identify rows without printing addresses.
    expect(JSON.stringify(report.errors)).not.toContain(`${run}@example.test`)
    const rows = await query('SELECT 1 FROM membership_bootstrap WHERE source_batch = $1', [batch])
    expect(rows).toEqual([])
  })

  it('a row conflicting with its own duplicate in the file is an error', () => {
    const shape = validateShape(
      csv(
        `${mail('d')},chapter-01,ACTIVE,,${batch}`,
        `${mail('d')},chapter-01,ACTIVE,Lead,${batch}`,
      ),
    )
    expect(shape.errors).toHaveLength(1)
  })
})

describe('import, match and attach', () => {
  it('new accounts: members get ACTIVE membership, leaders also leadership; imports are idempotent', async () => {
    const member = mail('member')
    const leader = mail('leader')
    const clb = mail('clb')
    const text = csv(
      `${member},chapter-01,ACTIVE,,${batch}`,
      `  ${member.toUpperCase()} ,chapter-01,ACTIVE,,${batch}`, // duplicate, normalized
      `${member},chapter-02,ACTIVE,,${batch}`, // same person, second organisation
      `${leader},chapter-01,ACTIVE,Chapter Leader,${batch}`,
      `${clb},club-01,ACTIVE,CLB Leader,${batch}`,
    )
    const dry = await importRoster(exec, text, { dryRun: true })
    expect(dry).toMatchObject({
      rows_valid: 4,
      duplicate_rows_in_file: 1,
      bootstrap_new: 4,
      errors: [],
    })
    expect(
      await query('SELECT 1 FROM membership_bootstrap WHERE source_batch = $1', [batch]),
    ).toEqual([])

    const first = await withTransaction((tx) => importRoster(tx, text))
    expect(first).toMatchObject({ bootstrap_new: 4, accounts_matched: 0, attached: 0 })
    const again = await withTransaction((tx) => importRoster(tx, text))
    expect(again).toMatchObject({ bootstrap_new: 0, bootstrap_existing: 4 })
    const [{ n }] = (await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM membership_bootstrap WHERE source_batch = $1',
      [batch],
    )) as [{ n: number }]
    expect(n).toBe(4)

    // First sign-in: the account is created, then reconciled.
    const memberId = await account(member)
    expect((await reconcileRoster(memberId)).map((o) => o.outcome)).toEqual([
      'ATTACHED',
      'ATTACHED',
    ])
    expect(await relations(memberId)).toEqual({
      memberships: [
        { slug: 'chapter-01', state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED', started: true },
        { slug: 'chapter-02', state: 'ACTIVE', source: 'ORGANIZATION_VERIFIED', started: true },
      ],
      leadership: [],
      profiles: 1,
    })
    const leaderId = await account(leader)
    await reconcileRoster(leaderId)
    expect(await relations(leaderId)).toMatchObject({
      memberships: [{ slug: 'chapter-01', state: 'ACTIVE' }],
      leadership: [{ slug: 'chapter-01', role_label: 'Chapter Leader', state: 'ACTIVE' }],
      profiles: 1,
    })
    const clbId = await account(clb)
    await reconcileRoster(clbId)
    expect((await relations(clbId)).leadership).toEqual([
      { slug: 'club-01', role_label: 'CLB Leader', state: 'ACTIVE' },
    ])

    // Repeated sign-in: nothing new.
    expect(await reconcileRoster(leaderId)).toEqual([])
    expect((await relations(leaderId)).leadership).toHaveLength(1)
  })

  it('an unmatched account gets nothing — not even a profile', async () => {
    const id = await account(mail('unknown'))
    expect(await reconcileRoster(id)).toEqual([])
    expect(await relations(id)).toEqual({ memberships: [], leadership: [], profiles: 0 })
  })

  it('an account that existed before the import is attached by the import itself', async () => {
    const email = mail('late')
    const id = await account(email)
    await query(`INSERT INTO individual_profiles (account_id, display_name) VALUES ($1, 'Late')`, [
      id,
    ])
    const report = await withTransaction((tx) =>
      importRoster(tx, csv(`${email},chapter-01,ACTIVE,Chapter Leader,${batch}`)),
    )
    expect(report).toMatchObject({ accounts_matched: 1, attached: 1, conflicts: [] })
    expect(await relations(id)).toMatchObject({
      memberships: [{ slug: 'chapter-01', state: 'ACTIVE' }],
      leadership: [{ role_label: 'Chapter Leader' }],
      profiles: 1,
    })
  })

  it('an existing ACTIVE membership is reused; a PENDING or SUSPENDED one is never overwritten', async () => {
    const email = mail('existing')
    const id = await account(email)
    const [{ pid }] = (await query<{ pid: string }>(
      `INSERT INTO individual_profiles (account_id) VALUES ($1) RETURNING id::text AS pid`,
      [id],
    )) as [{ pid: string }]
    const org = async (slug: string) =>
      (
        await query<{ id: string }>('SELECT id::text FROM organizations WHERE slug = $1', [slug])
      )[0]!.id
    await query(
      `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at)
       VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED', now()),
              ($1, $3, 'PENDING_APPROVAL', 'SELF_DECLARED', NULL),
              ($1, $4, 'SUSPENDED', 'ORGANIZATION_VERIFIED', now())`,
      [pid, await org('chapter-01'), await org('chapter-02'), await org('club-01')],
    )
    await withTransaction((tx) =>
      importRoster(
        tx,
        csv(
          `${email},chapter-01,ACTIVE,,${batch}`,
          `${email},chapter-02,ACTIVE,,${batch}`,
          `${email},club-01,ACTIVE,,${batch}`,
        ),
      ),
    )
    expect((await relations(id)).memberships.map((m) => [m.slug, m.state])).toEqual([
      ['chapter-01', 'ACTIVE'],
      ['chapter-02', 'PENDING_APPROVAL'],
      ['club-01', 'SUSPENDED'],
    ])
    const pending = await query<{ consumed: boolean }>(
      `SELECT consumed_at IS NOT NULL AS consumed FROM membership_bootstrap b
         JOIN organizations o ON o.id = b.organization_id
        WHERE b.email_normalized = $1 ORDER BY o.slug`,
      [email],
    )
    // chapter-01 consumed (already ACTIVE); the two conflicts stay open for an operator.
    expect(pending.map((p) => p.consumed)).toEqual([true, false, false])
  })

  it('concurrent first sign-ins attach exactly once', async () => {
    const email = mail('race')
    await withTransaction((tx) =>
      importRoster(tx, csv(`${email},chapter-01,ACTIVE,Chapter Leader,${batch}`)),
    )
    const id = await account(email)
    const results = await Promise.all(Array.from({ length: 6 }, () => reconcileRoster(id)))
    expect(results.flat().map((o) => o.outcome)).toEqual(['ATTACHED'])
    expect(await relations(id)).toMatchObject({
      memberships: [{ state: 'ACTIVE' }],
      leadership: [{ state: 'ACTIVE' }],
      profiles: 1,
    })
  })

  it('is atomic: a failing leadership write leaves no membership and an unconsumed row', async () => {
    const email = mail('atomic')
    await withTransaction((tx) =>
      importRoster(tx, csv(`${email},chapter-01,ACTIVE,Boom Label ${run},${batch}`)),
    )
    const id = await account(email)
    // A test-only trigger that fails the leadership insert for this label.
    await query(`
      CREATE FUNCTION roster_test_boom_${run}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.role_label LIKE 'Boom Label%' THEN RAISE EXCEPTION 'boom'; END IF; RETURN NEW; END $$`)
    await query(`CREATE TRIGGER roster_test_boom_${run} BEFORE INSERT ON leadership_records
                 FOR EACH ROW EXECUTE FUNCTION roster_test_boom_${run}()`)
    try {
      await expect(reconcileRoster(id)).rejects.toThrow(/boom/)
    } finally {
      await query(`DROP TRIGGER IF EXISTS roster_test_boom_${run} ON leadership_records`)
      await query(`DROP FUNCTION IF EXISTS roster_test_boom_${run}()`)
    }
    expect(await relations(id)).toEqual({ memberships: [], leadership: [], profiles: 0 })
    const [row] = await query<{ consumed: boolean }>(
      'SELECT consumed_at IS NOT NULL AS consumed FROM membership_bootstrap WHERE email_normalized = $1',
      [email],
    )
    expect(row!.consumed).toBe(false)
  })

  it('grants no RoleAssignment and no capability: membership and leadership are not RBAC', async () => {
    const email = mail('rbac')
    await withTransaction((tx) =>
      importRoster(tx, csv(`${email},chapter-01,ACTIVE,Chapter Leader,${batch}`)),
    )
    const id = await account(email)
    await reconcileRoster(id)
    const roles = await query(
      `SELECT 1 FROM role_assignments r JOIN individual_profiles p ON p.id = r.individual_profile_id
        WHERE p.account_id = $1
       UNION ALL SELECT 1 FROM role_assignments WHERE account_id = $1`,
      [id],
    )
    expect(roles).toEqual([])
    expect(deriveCapabilities(await resolveActor(id))).toEqual([])
  })
})
