import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { resolveActor } from '@/lib/authz/actor'
import { deriveCapabilities } from '@/lib/authz/session-authz'
import { closePool, query, withTransaction } from '@/lib/db/client'
import { listPublicStartups } from '@/lib/library/canonical-source'

import { CATEGORY_POLICY } from './categories'
import { grantAccess } from './delegation'
import { nearestResponsibleUnit } from './hierarchy'
import { notify } from './notifications'
import { ADM_FX, ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from './testing'
import { coreSnapshot, loadVentureCore, reviewRequired } from './venture-review'
import { canHandleVerification, fileVerificationRequest } from './verification'

/**
 * ADMIN-PROD-02 — PD-1 routing and the data-integrity checks of the task (§21)
 * on live PostgreSQL: canonical ids, one request per declared position, review
 * rows on canonical ventures with the public version untouched, feedback and
 * account actions on canonical accounts, notifications, categories.
 */

const O = ADM_FX.org
const P = ADM_PEOPLE
const NOW = new Date('2026-10-04T05:00:00Z')
const V_PUBLIC = 'ad020000-0000-4000-8000-000000000c01'
const V_DRAFT = 'ad020000-0000-4000-8000-000000000c02'

async function file(who: keyof typeof P, body: Record<string, unknown>) {
  return withTransaction((exec) =>
    fileVerificationRequest(exec, {
      accountId: P[who].account,
      body,
      requestId: 'adm02-rvr',
      now: NOW,
    }),
  )
}

async function fields(promise: Promise<unknown>): Promise<Record<string, string> | number> {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error.fields ?? error.status
    throw error
  }
  throw new Error('accepted')
}

async function sqlError(sql: string, params: unknown[] = []): Promise<string> {
  try {
    await withTransaction(async (exec) => {
      await exec(sql, params)
      throw new Error('accepted')
    })
  } catch (error) {
    const e = error as { constraint?: string; code?: string; message: string }
    if (e.message === 'accepted') throw error
    return e.constraint ?? e.code ?? e.message
  }
  return 'unreachable'
}

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

afterAll(async () => {
  await clearAdminFixture()
  await closePool()
})

describe('PD-1 routing with fallback, recorded at submission', () => {
  beforeEach(async () => {
    await query(`DELETE FROM audit_events WHERE actor_account_id::text LIKE 'ad020000-%'`)
    await query(
      `DELETE FROM role_verification_requests WHERE requester_profile_id::text LIKE 'ad020000-%'`,
    )
    await query(
      `DELETE FROM role_assignments WHERE individual_profile_id::text LIKE 'ad020000-%' AND capability IS NOT NULL`,
    )
    await query(
      `UPDATE role_assignments SET state = 'ACTIVE', valid_to = NULL WHERE individual_profile_id::text LIKE 'ad020000-%'`,
    )
  })

  it.each([
    ['HUB Tổng position → HUB Tổng', O.HUB, O.HUB, false],
    ['Chapter position → that Chapter', O.CH_A, O.CH_A, false],
    ['CLB with a handler → that CLB', O.CLB_A1, O.CLB_A1, false],
    ['CLB without a handler → its Chapter', O.CLB_A2, O.CH_A, true],
    ['CLB of another branch → its own Chapter', O.CLB_B1, O.CH_B, true],
  ])('%s', async (_case, unit, routed, fallback) => {
    const request = await file('memberA', {
      organization_id: unit,
      position_title: 'Chủ tịch',
      period_from: '2024-01',
    })
    expect(request).toMatchObject({
      organization_id: unit,
      routed_to_org_id: routed,
      status: 'PENDING',
    })
    const [audit] = await query<{ after_data: Record<string, unknown> }>(
      `SELECT after_data FROM audit_events WHERE resource_id = $1`,
      [request.id],
    )
    expect(audit!.after_data).toEqual({
      status: 'PENDING',
      position_organization_id: unit,
      fallback,
      handler_found: true,
      organization_id: routed,
    })
  })

  it('routes to a delegated CLB handler once one exists, not by the requester’s role', async () => {
    await grantAccess(
      P.chALeader.account,
      {
        organizationId: O.CLB_A2,
        granteeProfileId: P.memberB.profile,
        capability: 'verification:review',
      },
      'adm02-rvr',
    )
    // The requester is a Chapter leader: irrelevant, the position's unit decides.
    const request = await file('chALeader', {
      organization_id: O.CLB_A2,
      position_title: 'Phó Chủ tịch',
      period_from: '2023-09',
      period_to: '2024-08',
    })
    expect(request.routed_to_org_id).toBe(O.CLB_A2)
    expect(
      canHandleVerification(await resolveActor(P.memberB.account), {
        routedToOrgId: O.CLB_A2,
        requesterProfileId: P.chALeader.profile,
      }),
    ).toBe(true)
    expect(
      canHandleVerification(await resolveActor(P.chALeader.account), {
        routedToOrgId: O.CLB_A2,
        requesterProfileId: P.chALeader.profile,
      }),
    ).toBe(false)
  })

  it('skips a blocked or closed handler; with none left it rests at HUB Tổng for the admin', async () => {
    await query(
      `UPDATE role_assignments SET state = 'CLOSED', valid_to = now()
        WHERE individual_profile_id = ANY($1::uuid[])`,
      [[P.chBLeader.profile, P.hubLeader.profile]],
    )
    await query(
      `INSERT INTO role_assignments (account_id, individual_profile_id, role_code, scope_type, scope_id)
       VALUES ($1, $2, 'HUB_COMMUNITY_LEADER', 'ORGANIZATION', $3)`,
      [P.blocked.account, P.blocked.profile, O.CLB_B1],
    )
    expect(await nearestResponsibleUnit(query, O.CLB_B1)).toEqual({
      routedTo: O.HUB,
      chain: [O.CLB_B1, O.CH_B, O.HUB],
      fallback: true,
      handlerFound: false,
    })
    const request = await file('memberA', {
      organization_id: O.CLB_B1,
      position_title: 'Thành viên',
      period_from: '2025-02',
    })
    expect(request.routed_to_org_id).toBe(O.HUB)
    expect(
      canHandleVerification(await resolveActor(P.admin.account), {
        routedToOrgId: O.HUB,
        requesterProfileId: P.memberA.profile,
      }),
    ).toBe(true)
    await query(`DELETE FROM role_assignments WHERE individual_profile_id = $1`, [
      P.blocked.profile,
    ])
  })

  it('routes a handler’s own position past them: nobody verifies themselves', async () => {
    // CLB_A1's only handler declares a CLB_A1 position: it goes to Chapter A.
    const own = await file('clbA1Leader', {
      organization_id: O.CLB_A1,
      position_title: 'Chủ nhiệm',
      period_from: '2024-09',
    })
    expect(own.routed_to_org_id).toBe(O.CH_A)
    // A member's position at the same unit still goes to that handler.
    const other = await file('memberA', {
      organization_id: O.CLB_A1,
      position_title: 'Chủ nhiệm',
      period_from: '2024-09',
    })
    expect(other.routed_to_org_id).toBe(O.CLB_A1)
  })

  it('keeps one request per declared position; a withdrawn one frees it', async () => {
    const body = {
      organization_id: O.CLB_A1,
      position_title: 'Trưởng Ban Sự kiện',
      period_from: '2024-03',
    }
    const first = await file('memberC', body)
    expect(
      await fields(file('memberC', { ...body, position_title: 'trưởng ban sự kiện' })),
    ).toEqual({
      position_title: 'duplicate',
    })
    // A different term of the same title is a different position.
    await file('memberC', { ...body, period_from: '2021-03', period_to: '2022-02' })
    await query(
      `UPDATE role_verification_requests SET status = 'REJECTED', handled_at = now(),
                   handled_by_account_id = $2 WHERE id = $1`,
      [first.id, P.clbA1Leader.account],
    )
    expect(await fields(file('memberC', body))).toEqual({ position_title: 'duplicate' })
    await query(
      `UPDATE role_verification_requests SET status = 'WITHDRAWN', handled_at = NULL,
                   handled_by_account_id = NULL WHERE id = $1`,
      [first.id],
    )
    expect((await file('memberC', body)).status).toBe('PENDING')
    const [n] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM role_verification_requests WHERE requester_profile_id = $1`,
      [P.memberC.profile],
    )
    expect(n!.n).toBe(3)
  })

  it('refuses unavailable units and a deactivated requester; a pending request grants nothing', async () => {
    const base = { position_title: 'Chủ tịch', period_from: '2024-01' }
    expect(await fields(file('memberA', { ...base, organization_id: O.CLB_ARCHIVED }))).toEqual({
      organization_id: 'organization_not_available',
    })
    expect(await fields(file('deactivated', { ...base, organization_id: O.CLB_A1 }))).toBe(409)

    await file('memberB', { ...base, organization_id: O.CH_B })
    const [counts] = await query<{ m: number; l: number; r: number }>(
      `SELECT (SELECT count(*)::int FROM community_memberships WHERE profile_id = $1) AS m,
              (SELECT count(*)::int FROM leadership_records WHERE profile_id = $1) AS l,
              (SELECT count(*)::int FROM role_assignments WHERE individual_profile_id = $1) AS r`,
      [P.memberB.profile],
    )
    expect(counts).toEqual({ m: 0, l: 0, r: 0 })
    expect(deriveCapabilities(await resolveActor(P.memberB.account))).toEqual([])
  })

  it('stores canonical ids only and never the position text in the audit', async () => {
    const request = await file('memberA', {
      organization_id: O.CLB_A2,
      position_title: 'Ghi rõ: Điều phối viên',
      period_from: '2025-01',
    })
    const [row] = await query<{ org: string; routed: string; requester: string }>(
      `SELECT o.id::text AS org, r.id::text AS routed, p.id::text AS requester
         FROM role_verification_requests v
         JOIN organizations o ON o.id = v.organization_id
         JOIN organizations r ON r.id = v.routed_to_org_id
         JOIN individual_profiles p ON p.id = v.requester_profile_id
        WHERE v.id = $1`,
      [request.id],
    )
    expect(row).toEqual({ org: O.CLB_A2, routed: O.CH_A, requester: P.memberA.profile })
    const [audit] = await query<{ t: string }>(
      `SELECT coalesce(before_data::text, '') || after_data::text AS t FROM audit_events WHERE resource_id = $1`,
      [request.id],
    )
    expect(audit!.t).toContain('PENDING')
    expect(audit!.t).not.toContain('Điều phối')
  })

  it('enforces the lifecycle shape in the table', async () => {
    const request = await file('memberA', {
      organization_id: O.HUB,
      position_title: 'Thành viên',
      period_from: '2024-06',
    })
    const set = (sql: string) =>
      sqlError(`UPDATE role_verification_requests SET ${sql} WHERE id = '${request.id}'`)
    expect(await set(`status = 'APPROVED'`)).toBe('ck_rvr_handled')
    expect(await set(`reject_reason = 'x'`)).toBe('ck_rvr_reject_reason')
    expect(await set(`period_from = '2024-06-15'`)).toBe('ck_rvr_period_month')
    expect(await set(`period_to = '2024-01-01'`)).toBe('ck_rvr_period_order')
    expect(await set(`position_title = ' x'`)).toBe('ck_rvr_position_title')
    expect(await set(`routed_to_org_id = '00000000-0000-4000-8000-000000000000'`)).toBe(
      'role_verification_requests_routed_to_org_id_fkey',
    )
  })
})

describe('venture review on the canonical venture (PD-2, PD-3)', () => {
  beforeAll(async () => {
    await query(
      `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, status, visibility, website)
       VALUES ($1, 'STARTUP', $3, 'adm02-fx-public', 'ADM02 Approved', 'Approved line', 'ACTIVE', 'PUBLIC',
               'https://approved.example'),
              ($2, 'STARTUP', $3, 'adm02-fx-draft', 'ADM02 Draft', 'Draft line', 'DRAFT', 'PRIVATE', NULL)`,
      [V_PUBLIC, V_DRAFT, P.memberA.profile],
    )
  })

  it('keeps the approved public version live while a core change waits', async () => {
    const live = (await loadVentureCore(query, V_PUBLIC))!
    const proposed = { ...live, name: 'ADM02 Renamed', website: 'https://renamed.example' }
    expect(reviewRequired(live, live, proposed)).toEqual({
      required: true,
      fields: ['name', 'website'],
    })
    await query(
      `INSERT INTO venture_reviews (venture_id, kind, proposed, submitted_by_account_id)
       VALUES ($1, 'CORE_CHANGE', $2, $3)`,
      [V_PUBLIC, JSON.stringify(coreSnapshot(proposed)), P.memberA.account],
    )
    const listed = (await listPublicStartups()).filter((s) => s.ventureId === V_PUBLIC)
    expect(listed.map((s) => s.name)).toEqual(['ADM02 Approved'])
    expect((await loadVentureCore(query, V_PUBLIC))!.website).toBe('https://approved.example')
    expect(JSON.stringify(await listPublicStartups())).not.toContain('Renamed')
  })

  it('maps every review to one canonical venture, one pending at a time', async () => {
    const insert = (venture: string) =>
      sqlError(
        `INSERT INTO venture_reviews (venture_id, kind, proposed, submitted_by_account_id)
         VALUES ($1, 'CORE_CHANGE', '{"schema_version":1}', $2)`,
        [venture, P.memberA.account],
      )
    expect(await insert(V_PUBLIC)).toBe('uq_venture_reviews_pending')
    expect(await insert('00000000-0000-4000-8000-000000000000')).toBe(
      'venture_reviews_venture_id_fkey',
    )
    expect(
      await sqlError(
        `INSERT INTO venture_reviews (venture_id, kind, proposed, submitted_by_account_id)
         VALUES ($1, 'FIRST_PUBLISH', '[]', $2)`,
        [V_DRAFT, P.memberA.account],
      ),
    ).toBe('ck_venture_reviews_proposed')
    const [dup] = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM projects WHERE slug LIKE 'adm02-fx-%'`,
    )
    expect(dup!.n).toBe(2)
  })

  it('stores website and logo on the venture, no tax code', async () => {
    const set = (sql: string) => sqlError(`UPDATE projects SET ${sql} WHERE id = '${V_DRAFT}'`)
    expect(await set(`website = 'javascript:alert(1)'`)).toBe('ck_projects_website')
    expect(await set(`logo_asset_id = 'https://cdn.example/logo.png'`)).toBe(
      'ck_projects_logo_asset',
    )
    await query(
      `UPDATE projects SET website = 'https://draft.example', logo_asset_id = $2 WHERE id = $1`,
      [V_DRAFT, `asset_${'0'.repeat(32)}`],
    )
    const columns = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'projects'`,
    )
    expect(columns.map((c) => c.column_name)).toEqual(
      expect.arrayContaining(['website', 'logo_asset_id']),
    )
    expect(columns.some((c) => /tax|registration|business_code/i.test(c.column_name))).toBe(false)
  })

  it('no public read path touches the pending reviews', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|tsx)$/.test(name) && readFileSync(path, 'utf8').includes('venture_reviews'))
          offenders.push(path)
      }
    }
    for (const dir of [
      'src/app',
      'src/components',
      'src/lib/library',
      'src/lib/public',
      'src/lib/venture',
    ])
      walk(join(process.cwd(), dir))
    expect(offenders).toEqual([])
  })
})

describe('feedback, account actions, notifications and categories on canonical rows', () => {
  it('links feedback to the canonical account, or to nobody for a guest', async () => {
    await query(
      `INSERT INTO feedback_submissions (account_id, profile_id, body, type, context)
       VALUES ($1, $2, 'Nút Lưu không phản hồi', 'BUG', '{"route":"/me","screen":"WF02-S01"}')`,
      [P.memberA.account, P.memberA.profile],
    )
    await query(
      `INSERT INTO feedback_submissions (body, type, guest_email, screenshot_asset_id)
       VALUES ('Khách góp ý', 'UX', 'guest@example.test', $1)`,
      [`asset_${'1'.repeat(32)}`],
    )
    const insert = (columns: string, values: string) =>
      sqlError(`INSERT INTO feedback_submissions (${columns}) VALUES (${values})`)
    expect(
      await insert(
        `account_id, body, type, guest_email`,
        `'${P.memberA.account}', 'x', 'BUG', 'a@b.c'`,
      ),
    ).toBe('ck_feedback_guest_email')
    expect(await insert(`body, type`, `'${'x'.repeat(2001)}', 'BUG'`)).toBe('ck_feedback_body')
    expect(await insert(`body, type`, `'   ', 'BUG'`)).toBe('ck_feedback_body')
    expect(await insert(`body, type, screenshot_asset_id`, `'x', 'BUG', '../etc/passwd'`)).toBe(
      'ck_feedback_screenshot_asset',
    )
    expect(
      await insert(
        `body, type, screenshot_asset_id, screenshot_deleted_at`,
        `'x', 'BUG', 'asset_${'2'.repeat(32)}', now()`,
      ),
    ).toBe('ck_feedback_screenshot_deleted')
    expect(await insert(`body, type, status`, `'x', 'BUG', 'CLOSED'`)).toBe('22P02')
    expect(
      await insert(`account_id, body, type`, `'00000000-0000-4000-8000-000000000000', 'x', 'BUG'`),
    ).toBe('feedback_submissions_account_id_fkey')
    await query(`DELETE FROM feedback_submissions WHERE guest_email = 'guest@example.test'`)
  })

  it('targets canonical accounts with account actions; one pending per account and action', async () => {
    await query(
      `INSERT INTO account_action_requests (target_account_id, organization_id, requested_by_account_id, action)
       VALUES ($1, $2, $3, 'LOCK')`,
      [P.memberB.account, O.CH_A, P.chALeader.account],
    )
    const insert = (target: string, action: string) =>
      sqlError(
        `INSERT INTO account_action_requests (target_account_id, organization_id, requested_by_account_id, action)
         VALUES ($1, $2, $3, $4)`,
        [target, O.CH_A, P.chALeader.account, action],
      )
    expect(await insert(P.memberB.account, 'LOCK')).toBe('uq_account_action_pending')
    expect(await insert('00000000-0000-4000-8000-000000000000', 'LOCK')).toBe(
      'account_action_requests_target_account_id_fkey',
    )
    expect(await insert(P.memberB.account, 'HARD_DELETE')).toBe('22P02')
    expect(
      await sqlError(
        `UPDATE account_action_requests SET status = 'PROCESSED' WHERE target_account_id = $1`,
        [P.memberB.account],
      ),
    ).toBe('ck_account_action_handled')
    await query(`INSERT INTO account_deletion_requests (account_id) VALUES ($1)`, [
      P.memberC.account,
    ])
    const [deletion] = await query<{ status: string }>(
      `SELECT status::text AS status FROM account_deletion_requests WHERE account_id = $1`,
      [P.memberC.account],
    )
    expect(deletion!.status).toBe('PENDING')
  })

  it('writes notifications on the decided resource only', async () => {
    const id = await withTransaction((exec) =>
      notify(exec, {
        recipientAccountId: P.memberA.account,
        type: 'VERIFICATION_APPROVED',
        resourceId: O.HUB,
      }),
    )
    const [row] = await query<{ resource_type: string; read_at: Date | null }>(
      `SELECT resource_type, read_at FROM notifications WHERE id = $1`,
      [id],
    )
    expect(row).toEqual({ resource_type: 'role_verification_request', read_at: null })
    expect(
      await sqlError(
        `INSERT INTO notifications (recipient_account_id, type, resource_type, resource_id)
         VALUES ($1, 'VENTURE_REVIEW_APPROVED', 'role_verification_request', $2)`,
        [P.memberA.account, O.HUB],
      ),
    ).toBe('ck_notifications_resource')
  })

  it('covers exactly the existing vocabulary types, creating none', async () => {
    const types = await query<{ code: string }>(`SELECT code FROM vocabulary_types ORDER BY code`)
    expect(types.map((t) => t.code)).toEqual(Object.keys(CATEGORY_POLICY).sort())
  })
})
