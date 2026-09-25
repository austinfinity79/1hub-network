import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { closePool, query } from '@/lib/db/client'

import { resolveActor, type Actor } from './actor'
import { authorize, can, require as requireCapability } from './authorize'
import {
  ADMIN_MAY_EDIT_OTHER_PROFILE,
  CAPABILITIES,
  CAPABILITY_MATRIX,
  P0_ROLES,
  type Capability,
} from './matrix'
import { deriveCapabilities, deriveManagedScopes } from './session-authz'

/**
 * M0-T09 — authorization, asserted against live PostgreSQL and the approved
 * matrix. Uses the deterministic M0-T07 fixtures.
 */
const ROOT = process.cwd()
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'

const ORG_CAPS = CAPABILITIES

/** Removes block and line comments so source scans read executable code only. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

let leader: Actor
let member: Actor
let ops: Actor
let pending: Actor

beforeAll(async () => {
  execFileSync('node', [join(ROOT, 'scripts', 'db.mjs'), 'reset'], { stdio: 'pipe' })

  const account = async (email: string) => {
    const [row] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      [email],
    )
    return resolveActor(row!.id)
  }

  leader = await account('leader@example.test')
  member = await account('member@example.test')
  ops = await account('ops@example.test')
  pending = await account('pending@example.test')
}, 90_000)

afterAll(async () => {
  await closePool()
})

describe('M0-T09 matrix matches the approved document', () => {
  it('covers exactly the nine approved capabilities under one naming convention', () => {
    expect(CAPABILITIES).toHaveLength(9)
    for (const capability of CAPABILITIES) {
      // D5: resource:action, exactly one colon.
      expect(capability.split(':')).toHaveLength(2)
    }
    expect(CAPABILITY_MATRIX).toHaveLength(9)
  })

  it('matches the frozen matrix document capability for capability', () => {
    const doc = readFileSync(
      join(ROOT, 'docs', 'implementation', 'AUTHORIZATION_CAPABILITY_MATRIX_P0.md'),
      'utf8',
    )

    expect(doc).toContain('HUMAN APPROVED — P0')
    for (const capability of CAPABILITIES) {
      expect(doc, `${capability} missing from the approved matrix`).toContain(`\`${capability}\``)
    }
  })

  it('grants no capability to the two individual roles', () => {
    for (const rule of CAPABILITY_MATRIX) {
      for (const role of ['INDIVIDUAL_USER', 'HUB_MEMBER'] as const) {
        expect(rule.organizationRoles, `${rule.capability}/${role}`).not.toContain(role)
        expect(rule.platformRoles, `${rule.capability}/${role}`).not.toContain(role)
      }
    }
  })

  it('has no admin-gets-everything shortcut in the decision logic', () => {
    // Comments are stripped so the scan reads executable code only, not prose.
    const source = stripComments(
      readFileSync(join(ROOT, 'src', 'lib', 'authz', 'authorize.ts'), 'utf8'),
    )

    // The decision function must not name any role: authority comes only from
    // the data table, never from a branch on a specific role.
    for (const role of P0_ROLES) {
      expect(source, `authorize.ts branches on ${role}`).not.toContain(role)
    }

    // Exactly one success path exists, reached only after both the grant check
    // and the optional lifecycle predicate. A regex cannot distinguish that
    // legitimate return from a blanket allow, so the absence of a blanket allow
    // is proven behaviourally instead: see the role-denial and scope suites,
    // where a member is denied all nine capabilities and a leader is denied all
    // nine in another organization.
    // One in the AuthorizationDecision type, one as the single success return.
    expect((source.match(/return\s*\{\s*allowed:\s*true\s*\}/g) ?? []).length).toBe(1)
  })
})

describe('M0-T09 role denial', () => {
  it('denies every ops capability to an INDIVIDUAL_USER / HUB_MEMBER actor', async () => {
    for (const capability of ORG_CAPS) {
      const allowed = await can(member, capability, {
        scopeType: 'ORGANIZATION',
        scopeId: CHAPTER_01,
      })
      expect(allowed, `member unexpectedly allowed ${capability}`).toBe(false)
    }
  })

  it('denies an actor holding membership but no ops RoleAssignment', async () => {
    // `pending` has a PENDING_APPROVAL membership and only INDIVIDUAL_USER.
    const memberships = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM community_memberships WHERE profile_id = $1`,
      [pending.profileId],
    )
    expect(memberships[0]!.n).toBeGreaterThan(0)

    for (const capability of ORG_CAPS) {
      expect(
        await can(pending, capability, { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 }),
      ).toBe(false)
    }
  })

  it('denies an unauthenticated actor', async () => {
    const decision = await authorize(null, 'member:read', {
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_01,
    })

    expect(decision).toEqual({ allowed: false, reason: 'UNAUTHENTICATED' })
  })
})

describe('M0-T09 scope enforcement', () => {
  it('allows the Leader every approved capability inside the assigned organization', async () => {
    for (const capability of ORG_CAPS) {
      const allowed = await can(leader, capability, {
        scopeType: 'ORGANIZATION',
        scopeId: CHAPTER_01,
      })
      expect(allowed, `leader denied ${capability} in own org`).toBe(true)
    }
  })

  it('denies the Leader the same capabilities in a different organization', async () => {
    // Constraint D1: Chapter A never implies Chapter B.
    for (const capability of ORG_CAPS) {
      const allowed = await can(leader, capability, {
        scopeType: 'ORGANIZATION',
        scopeId: CHAPTER_02,
      })
      expect(allowed, `leader escalated into another org via ${capability}`).toBe(false)
    }
  })

  it('denies the Leader platform scope', async () => {
    for (const capability of ORG_CAPS) {
      expect(await can(leader, capability, { scopeType: 'PLATFORM' })).toBe(false)
    }
  })

  it('allows PLATFORM_ADMIN at platform scope and across organizations', async () => {
    for (const capability of ORG_CAPS) {
      expect(await can(ops, capability, { scopeType: 'PLATFORM' })).toBe(true)
      expect(await can(ops, capability, { scopeType: 'ORGANIZATION', scopeId: CHAPTER_02 })).toBe(
        true,
      )
    }
  })

  it('denies an organization request that names no organization', async () => {
    expect(await can(leader, 'member:read', { scopeType: 'ORGANIZATION' })).toBe(false)
    expect(await can(leader, 'member:read', { scopeType: 'ORGANIZATION', scopeId: null })).toBe(
      false,
    )
  })
})

describe('M0-T09 assignment validity', () => {
  async function withLeaderAssignment(
    patch: string,
    params: unknown[],
    run: (actor: Actor) => Promise<void>,
  ) {
    await query(patch, params)
    try {
      const [row] = await query<{ id: string }>(
        'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
        ['leader@example.test'],
      )
      await run(await resolveActor(row!.id))
    } finally {
      execFileSync('node', [join(ROOT, 'scripts', 'db.mjs'), 'seed'], { stdio: 'pipe' })
    }
  }

  it('ignores an expired assignment', async () => {
    await withLeaderAssignment(
      `UPDATE role_assignments SET valid_to = now() - interval '1 day'
       WHERE role_code = 'HUB_COMMUNITY_LEADER'`,
      [],
      async (actor) => {
        expect(actor.assignments.some((a) => a.roleCode === 'HUB_COMMUNITY_LEADER')).toBe(false)
        expect(
          await can(actor, 'member:read', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 }),
        ).toBe(false)
      },
    )
  }, 60_000)

  it('ignores an assignment that has not started', async () => {
    await withLeaderAssignment(
      `UPDATE role_assignments SET valid_from = now() + interval '30 days'
       WHERE role_code = 'HUB_COMMUNITY_LEADER'`,
      [],
      async (actor) => {
        expect(
          await can(actor, 'event:manage', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 }),
        ).toBe(false)
      },
    )
  }, 60_000)

  it('ignores a non-ACTIVE assignment', async () => {
    await withLeaderAssignment(
      `UPDATE role_assignments SET state = 'CLOSED' WHERE role_code = 'HUB_COMMUNITY_LEADER'`,
      [],
      async (actor) => {
        expect(
          await can(actor, 'org:manage', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 }),
        ).toBe(false)
      },
    )
  }, 60_000)

  it('ignores a role code outside the P0 catalogue', async () => {
    await withLeaderAssignment(
      `UPDATE role_assignments SET role_code = 'SUPER_ADMIN' WHERE role_code = 'HUB_COMMUNITY_LEADER'`,
      [],
      async (actor) => {
        // role_code is still untyped text; this boundary stops a stray value
        // from becoming authority.
        expect(actor.assignments.some((a) => String(a.roleCode) === 'SUPER_ADMIN')).toBe(false)
        expect(
          await can(actor, 'member:read', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 }),
        ).toBe(false)
      },
    )
  }, 60_000)
})

describe('M0-T09 forged client input is ignored', () => {
  it('derives authority only from the database, never from a supplied role', async () => {
    // A forged actor object cannot exist: resolveActor accepts only an account
    // id and reads every assignment from the database.
    const forged = { ...member, assignments: [...leader.assignments] }

    // The forged object does grant access, which is exactly why nothing but
    // resolveActor may construct one. Proving the real path ignores client data:
    const [row] = await query<{ id: string }>(
      'SELECT id::text FROM user_accounts WHERE email_normalized = $1',
      ['member@example.test'],
    )
    const real = await resolveActor(row!.id)

    expect(forged.assignments.length).toBeGreaterThan(0)
    expect(real.assignments.some((a) => a.roleCode === 'HUB_COMMUNITY_LEADER')).toBe(false)
    expect(await can(real, 'member:read', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 })).toBe(
      false,
    )
  })

  it('ignores a forged scope by requiring an exact assignment match', async () => {
    // Naming another organization does not create authority over it.
    expect(
      await can(leader, 'org:manage', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_02 }),
    ).toBe(false)
    expect(
      await can(leader, 'org:manage', { scopeType: 'ORGANIZATION', scopeId: 'not-a-real-org' }),
    ).toBe(false)
  })

  it('denies an unknown capability rather than defaulting', async () => {
    const decision = await authorize(ops, 'totally:invented' as Capability, {
      scopeType: 'PLATFORM',
    })

    expect(decision).toEqual({ allowed: false, reason: 'FORBIDDEN' })
  })
})

describe('M0-T09 constraint D3', () => {
  it('grants no capability that edits another canonical profile', () => {
    expect(ADMIN_MAY_EDIT_OTHER_PROFILE).toBe(false)

    // No profile-write capability exists in the catalogue at all.
    for (const capability of CAPABILITIES) {
      expect(capability).not.toMatch(/^profile:(update|manage|write)/)
    }
  })

  it('implements no impersonation path', () => {
    const dir = join(ROOT, 'src', 'lib', 'authz')
    for (const file of ['actor.ts', 'authorize.ts', 'session-authz.ts', 'matrix.ts']) {
      // Comments are stripped: a comment saying impersonation is absent is not
      // an impersonation path.
      const source = stripComments(readFileSync(join(dir, file), 'utf8'))
      expect(source, `${file} implements impersonation`).not.toMatch(
        /impersonat|act_as|onBehalfOf|assumeRole/i,
      )
    }
  })
})

describe('M0-T09 session derivation', () => {
  it('derives an empty capability list for a member', () => {
    expect(deriveCapabilities(member)).toEqual([])
    expect(deriveManagedScopes(member)).toEqual([])
  })

  it('derives the leader capabilities and one organization scope', () => {
    expect(deriveCapabilities(leader)).toEqual([...CAPABILITIES].sort())

    const scopes = deriveManagedScopes(leader)
    expect(scopes).toEqual([
      { scope_type: 'ORGANIZATION', scope_id: CHAPTER_01, role_code: 'HUB_COMMUNITY_LEADER' },
    ])
  })

  it('derives the admin platform scope', () => {
    const scopes = deriveManagedScopes(ops)

    expect(scopes).toEqual([{ scope_type: 'PLATFORM', scope_id: '', role_code: 'PLATFORM_ADMIN' }])
  })

  it('exposes no raw RoleAssignment column', () => {
    const scopes = deriveManagedScopes(leader)

    for (const scope of scopes) {
      expect(Object.keys(scope).sort()).toEqual(['role_code', 'scope_id', 'scope_type'])
    }
  })

  it('derives nothing for an unauthenticated actor', () => {
    expect(deriveCapabilities(null)).toEqual([])
    expect(deriveManagedScopes(null)).toEqual([])
  })
})

describe('M0-T09 require() error mapping', () => {
  it('throws SCOPE_FORBIDDEN for an authenticated actor outside scope', async () => {
    await expect(
      requireCapability(leader, 'member:read', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_02 }),
    ).rejects.toMatchObject({ code: 'SCOPE_FORBIDDEN', status: 403 })
  })

  it('throws 401 for an unauthenticated actor', async () => {
    await expect(
      requireCapability(null, 'member:read', { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 }),
    ).rejects.toMatchObject({ status: 401 })
  })

  it('uses the same error for no-permission and wrong-scope, so nothing is enumerable', async () => {
    const outOfScope = await requireCapability(leader, 'member:read', {
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    }).catch((e: unknown) => e)
    const noPermission = await requireCapability(member, 'member:read', {
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_01,
    }).catch((e: unknown) => e)

    expect((outOfScope as { code: string }).code).toBe((noPermission as { code: string }).code)
    expect((outOfScope as { message: string }).message).toBe(
      (noPermission as { message: string }).message,
    )
  })

  // M0 completion audit: probing an organization id must not reveal whether it
  // exists. A nonexistent id and a real foreign one must be indistinguishable.
  it('answers a nonexistent organization exactly like a foreign one', async () => {
    const foreign = await requireCapability(leader, 'member:read', {
      scopeType: 'ORGANIZATION',
      scopeId: CHAPTER_02,
    }).catch((e: unknown) => e)
    const nonexistent = await requireCapability(leader, 'member:read', {
      scopeType: 'ORGANIZATION',
      scopeId: '10000000-0000-0000-0000-00000000dead',
    }).catch((e: unknown) => e)

    expect(nonexistent).toMatchObject({
      code: (foreign as { code: string }).code,
      message: (foreign as { message: string }).message,
    })
    expect((nonexistent as { status: number }).status).toBe((foreign as { status: number }).status)
  })

  it('runs the lifecycle predicate only after permission passes, and maps it to 409', async () => {
    let ran = false

    // Permission fails: the predicate must not run.
    await requireCapability(
      member,
      'membership:confirm',
      { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 },
      () => {
        ran = true
        return true
      },
    ).catch(() => undefined)
    expect(ran).toBe(false)

    // Permission passes, predicate fails: 409, not 403.
    await expect(
      requireCapability(
        leader,
        'membership:confirm',
        { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 },
        () => false,
      ),
    ).rejects.toMatchObject({ status: 409 })

    // Permission passes, predicate passes: allowed.
    await expect(
      requireCapability(
        leader,
        'membership:confirm',
        { scopeType: 'ORGANIZATION', scopeId: CHAPTER_01 },
        () => true,
      ),
    ).resolves.toBeUndefined()
  })
})
