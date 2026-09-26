import { afterAll, describe, expect, it } from 'vitest'

import { consumeMagicLink, requestMagicLink } from '@/lib/auth/magic-link'
import { closePool, query } from '@/lib/db/client'

/**
 * GAP-ANALYTICS-REG — account_created (API 05 §10) against live PostgreSQL.
 * Written in the account-insert transaction by the single analytics writer:
 * once per new account, never for a returning user, a retry or a rollback.
 */

const run = `${Date.now()}${Math.random().toString(36).slice(2, 6)}`
const mail = (tag: string) => `reg-${tag}-${run}@example.test`

afterAll(async () => {
  await closePool()
})

async function signIn(email: string) {
  const { token } = await requestMagicLink(email, null)
  return { token, result: await consumeMagicLink(token) }
}

async function events(email: string) {
  return query<{ event_name: string; properties: Record<string, unknown> }>(
    `SELECT e.event_name, e.properties FROM analytics_events e
       JOIN user_accounts a ON a.id = e.account_id
      WHERE a.email_normalized = $1 AND e.event_name = 'account_created'`,
    [email],
  )
}

const accounts = async (email: string) =>
  (
    await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM user_accounts WHERE email_normalized = $1',
      [email],
    )
  )[0]!.n

describe('account_created', () => {
  it('is written once for the first sign-in, with the frozen common properties only', async () => {
    const email = mail('first')
    const { result } = await signIn(email)
    expect(result.response.account_created).toBe(true)
    const rows = await events(email)
    expect(rows).toHaveLength(1)
    const [{ id }] = (await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [email],
    )) as [{ id: string }]
    expect(rows[0]!.properties).toEqual({
      event_name: 'account_created',
      occurred_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
      account_id: id,
      profile_id: null,
      workflow: 'WF01',
      screen_id: 'WF01-S03',
    })
    expect(JSON.stringify(rows)).not.toContain('@')
  })

  it('a returning sign-in and a retried link add nothing', async () => {
    const email = mail('return')
    const { token } = await signIn(email)
    const again = await signIn(email)
    expect(again.result.response.account_created).toBe(false)
    await expect(consumeMagicLink(token)).rejects.toMatchObject({ code: 'AUTH_LINK_ALREADY_USED' })
    expect(await events(email)).toHaveLength(1)
    expect(await accounts(email)).toBe(1)
  })

  it('concurrent first sign-ins with two valid links make one account and one event', async () => {
    const email = mail('race')
    const tokens = [
      (await requestMagicLink(email, null)).token,
      (await requestMagicLink(email, null)).token,
    ]
    const results = await Promise.all(tokens.map((t) => consumeMagicLink(t)))
    expect(results.map((r) => r.response.account_created).sort()).toEqual([false, true])
    expect(await accounts(email)).toBe(1)
    expect(await events(email)).toHaveLength(1)
    const profiles = await query(
      `SELECT 1 FROM individual_profiles p JOIN user_accounts a ON a.id = p.account_id
        WHERE a.email_normalized = $1`,
      [email],
    )
    expect(profiles.length).toBeLessThanOrEqual(1)
  })

  it('if the event cannot be written, the account is not created either (one transaction)', async () => {
    const email = mail('fail')
    await query(`
      CREATE FUNCTION analytics_test_fail_${run}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.event_name = 'account_created' THEN RAISE EXCEPTION 'analytics down'; END IF; RETURN NEW; END $$`)
    await query(`CREATE TRIGGER analytics_test_fail_${run} BEFORE INSERT ON analytics_events
                 FOR EACH ROW EXECUTE FUNCTION analytics_test_fail_${run}()`)
    try {
      const { token } = await requestMagicLink(email, null)
      await expect(consumeMagicLink(token)).rejects.toThrow(/analytics down/)
    } finally {
      await query(`DROP TRIGGER IF EXISTS analytics_test_fail_${run} ON analytics_events`)
      await query(`DROP FUNCTION IF EXISTS analytics_test_fail_${run}()`)
    }
    expect(await accounts(email)).toBe(0)
    expect(await events(email)).toHaveLength(0)
    // A new link then creates the account normally, with its one event.
    await signIn(email)
    expect(await accounts(email)).toBe(1)
    expect(await events(email)).toHaveLength(1)
  })

  it('a launch-roster sign-up records the account once and carries no roster data', async () => {
    const email = mail('roster')
    const [org] = await query<{ id: string }>(
      `SELECT id::text FROM organizations WHERE slug = 'chapter-01'`,
    )
    await query(
      `INSERT INTO membership_bootstrap (email_normalized, organization_id, membership_state, leadership_role_label, source_batch)
       VALUES ($1, $2, 'ACTIVE', 'Chapter Leader', $3)`,
      [email, org!.id, `reg-${run}`],
    )
    await signIn(email)
    await signIn(email)
    const rows = await events(email)
    expect(rows).toHaveLength(1)
    expect(JSON.stringify(rows)).not.toMatch(/chapter|Leader|membership|organization/i)
    const memberships = await query(
      `SELECT 1 FROM community_memberships m JOIN individual_profiles p ON p.id = m.profile_id
         JOIN user_accounts a ON a.id = p.account_id WHERE a.email_normalized = $1 AND m.state = 'ACTIVE'`,
      [email],
    )
    expect(memberships).toHaveLength(1)
  })
})
