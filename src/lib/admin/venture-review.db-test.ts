import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { isApiError } from '@/lib/api/errors'
import { closePool, query, withTransaction, type Executor } from '@/lib/db/client'
import { listPublicStartups } from '@/lib/library/canonical-source'
import { LIBRARY_FX } from '@/lib/library/testing'
import { removeAsset, saveAvatarAsset } from '@/lib/media/avatar-storage'

import { ADM_PEOPLE, clearAdminFixture, seedAdminFixture } from './testing'
import {
  approveVentureReview,
  getVentureReview,
  listVentureReviews,
  rejectVentureReview,
  reviewerMayFetchLogo,
} from './venture-review-queue'
import { parseCoreChanges, saveVentureCore, submitVentureForReview } from './venture-submission'

/**
 * ADMIN-PROD-04 — venture review on live PostgreSQL: the owner-side writers
 * shared with S1-UAT-06 and PLATFORM_ADMIN's processing of the same rows.
 */

const P = ADM_PEOPLE
type Person = keyof typeof P
const D = LIBRARY_FX.domain
const S = LIBRARY_FX.stage
const R = LIBRARY_FX.region
const V = (n: number) => `ad020000-0000-4000-8000-000000000d${n.toString(16).padStart(2, '0')}`
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])
const assets: string[] = []

async function venture(
  n: number,
  owner: Person,
  state: 'DRAFT' | 'PUBLIC',
  extra: { name?: string; complete?: boolean } = {},
): Promise<string> {
  const id = V(n)
  const complete = extra.complete !== false
  await query(
    `INSERT INTO projects (id, type, owner_profile_id, slug, name, summary, stage_id, region_id,
                           owner_role_label, status, visibility, website)
     VALUES ($1, 'STARTUP', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'https://live.example')`,
    [
      id,
      P[owner].profile,
      `adm04-fx-${n}`,
      extra.name ?? `ADM04 Venture ${n}`,
      complete ? 'Một dòng mô tả' : null,
      complete ? S.MVP : null,
      R.hanoi,
      complete ? 'Founder' : null,
      state === 'PUBLIC' ? 'ACTIVE' : 'DRAFT',
      state === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
    ],
  )
  if (complete)
    await query(`INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`, [
      id,
      D.govtech,
    ])
  return id
}

const tx = <T>(work: (exec: Executor) => Promise<T>) => withTransaction(work)
const submit = (who: Person, ventureId: string) =>
  tx((exec) =>
    submitVentureForReview(exec, { accountId: P[who].account, ventureId, requestId: 'adm04' }),
  )
const save = (who: Person, ventureId: string, body: unknown) =>
  tx((exec) =>
    saveVentureCore(exec, { accountId: P[who].account, ventureId, body, requestId: 'adm04' }),
  )
const approve = (who: Person, id: string, body: unknown = { version: 1 }) =>
  approveVentureReview(P[who].account, id, body, 'adm04')
const reject = (who: Person, id: string, body: unknown = { version: 1 }) =>
  rejectVentureReview(P[who].account, id, body, 'adm04')

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return { status: error.status, code: error.code, fields: error.fields }
    throw error
  }
  throw new Error('accepted')
}

async function live(id: string) {
  const [row] = await query<{
    name: string
    website: string | null
    status: string
    visibility: string
  }>(
    `SELECT name, website, status::text AS status, visibility::text AS visibility FROM projects WHERE id = $1`,
    [id],
  )
  return row!
}

beforeAll(async () => {
  await seedAdminFixture()
}, 60_000)

beforeEach(async () => {
  await query(`DELETE FROM notifications WHERE recipient_account_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM audit_events WHERE actor_account_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM venture_reviews WHERE venture_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM project_members WHERE project_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM projects WHERE id::text LIKE 'ad020000-%'`)
})

afterAll(async () => {
  for (const id of assets) await removeAsset(id)
  await query(`DELETE FROM venture_reviews WHERE venture_id::text LIKE 'ad020000-%'`)
  await query(`DELETE FROM projects WHERE id::text LIKE 'ad020000-%'`)
  await clearAdminFixture()
  await closePool()
})

describe('submission (shared with S1-UAT-06)', () => {
  it('the owner submits a complete draft once; others and incomplete drafts are refused', async () => {
    const v = await venture(1, 'memberA', 'DRAFT')
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at, permission, updated_at)
       VALUES ($1, $2, 'Cộng sự', 'ACTIVE', now(), 'EDIT', now())`,
      [v, P.memberB.profile],
    )
    expect(await failure(submit('memberB', v))).toMatchObject({ status: 403 })
    expect(await failure(submit('memberC', v))).toMatchObject({ status: 404 })
    const review = await submit('memberA', v)
    expect(review).toMatchObject({ kind: 'FIRST_PUBLISH', status: 'PENDING', version: 1 })
    expect(await failure(submit('memberA', v))).toMatchObject({ status: 409 })
    const draft = await venture(2, 'memberA', 'DRAFT', { complete: false })
    expect(await failure(submit('memberA', draft))).toMatchObject({
      status: 422,
      fields: {
        domain_ids: 'required',
        summary: 'required',
        stage_id: 'required',
        owner_role_label: 'required',
      },
    })
    expect(await failure(submit('memberA', await venture(3, 'memberA', 'PUBLIC')))).toMatchObject({
      status: 409,
    })
    expect(await live(v)).toMatchObject({ status: 'DRAFT', visibility: 'PRIVATE' })
  })
})

describe('public version stays live; unapproved edits never leak', () => {
  it('a core change on a PUBLIC venture opens a review and leaves the public row as it was', async () => {
    const v = await venture(4, 'memberA', 'PUBLIC', { name: 'ADM04 Approved' })
    const result = await save('memberA', v, {
      name: 'ADM04 Renamed',
      website: 'https://renamed.example',
    })
    expect(result).toMatchObject({ mode: 'REVIEW_CREATED', fields: ['name', 'website'] })
    expect(await live(v)).toMatchObject({
      name: 'ADM04 Approved',
      website: 'https://live.example',
      visibility: 'PUBLIC',
    })
    const listed = (await listPublicStartups()).filter((s) => s.ventureId === v)
    expect(listed.map((s) => s.name)).toEqual(['ADM04 Approved'])
    expect(JSON.stringify(await listPublicStartups())).not.toContain('ADM04 Renamed')
    // Equal values (whitespace, order) are no change; a private draft is written directly.
    expect(await save('memberA', v, { name: ' ADM04 Renamed ' })).toMatchObject({
      mode: 'UNCHANGED',
    })
    const draft = await venture(5, 'memberA', 'DRAFT')
    expect(await save('memberA', draft, { website: 'https://draft.example' })).toMatchObject({
      mode: 'APPLIED',
      fields: ['website'],
    })
    expect((await live(draft)).website).toBe('https://draft.example/')
  })
})

describe('approve / reject', () => {
  it('approves a first publication onto the same row, audits and notifies the owner', async () => {
    const v = await venture(6, 'memberA', 'DRAFT')
    const review = await submit('memberA', v)
    const done = await approve('admin', review.id)
    expect(done).toMatchObject({ status: 'APPROVED', version: 2 })
    expect(await live(v)).toMatchObject({ status: 'ACTIVE', visibility: 'PUBLIC' })
    expect(
      (
        await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM projects WHERE slug = 'adm04-fx-6'`,
        )
      )[0]!.n,
    ).toBe(1)
    const audits = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE resource_id = ANY($1::uuid[]) ORDER BY created_at, action`,
      [[review.id, v]],
    )
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        'VENTURE_REVIEW_SUBMITTED',
        'VENTURE_REVIEW_APPROVED',
        'VENTURE_PUBLISHED',
      ]),
    )
    const notices = await query<{ type: string }>(
      `SELECT type::text AS type FROM notifications WHERE recipient_account_id = $1`,
      [P.memberA.account],
    )
    expect(notices).toEqual([{ type: 'VENTURE_REVIEW_APPROVED' }])
  })

  it('approves a core change: the candidate replaces the live values, sectors included', async () => {
    const v = await venture(7, 'memberB', 'PUBLIC')
    const { review } = (await save('memberB', v, {
      name: 'ADM04 New',
      domain_ids: [D.edtech],
      stage_id: S.PILOT,
    })) as { review: { id: string } }
    await approve('admin', review.id)
    expect(await live(v)).toMatchObject({ name: 'ADM04 New', visibility: 'PUBLIC' })
    const domains = await query<{ id: string }>(
      `SELECT vocabulary_item_id::text AS id FROM project_domains WHERE project_id = $1`,
      [v],
    )
    expect(domains).toEqual([{ id: D.edtech }])
  })

  it('rejects with an optional reason, keeps the live version and the history; resubmission is new', async () => {
    const v = await venture(8, 'memberC', 'PUBLIC', { name: 'ADM04 Live' })
    const first = (await save('memberC', v, { name: 'ADM04 Rejected' })) as {
      review: { id: string }
    }
    const rejected = await reject('admin', first.review.id, { version: 1, reason: '  Trùng tên  ' })
    expect(rejected).toMatchObject({ status: 'REJECTED', reject_reason: 'Trùng tên' })
    expect((await live(v)).name).toBe('ADM04 Live')
    const again = (await save('memberC', v, { name: 'ADM04 Retry' })) as { review: { id: string } }
    const noReason = await reject('admin', again.review.id, { version: 1 })
    expect(noReason.reject_reason).toBeNull()
    expect(noReason.previous_reviews.map((r) => r.status)).toEqual(['REJECTED'])
    const actions = await query<{ action: string }>(
      `SELECT action FROM audit_events WHERE resource_id = $1 ORDER BY created_at`,
      [again.review.id],
    )
    expect(actions.map((a) => a.action)).toEqual([
      'VENTURE_REVIEW_RESUBMITTED',
      'VENTURE_REVIEW_REJECTED',
    ])
    expect(
      await failure(
        reject(
          'admin',
          ((await save('memberC', v, { name: 'X3' })) as { review: { id: string } }).review.id,
          {
            version: 1,
            reason: 'x'.repeat(501),
          },
        ),
      ),
    ).toMatchObject({ status: 422 })
  })
})

describe('edit while pending (task §9)', () => {
  it('updates the one pending candidate; a stale approval is refused; the latest one is applied', async () => {
    const v = await venture(9, 'memberA', 'PUBLIC', { name: 'ADM04 Base' })
    const created = (await save('memberA', v, { name: 'ADM04 Candidate 1' })) as {
      review: { id: string }
    }
    const updated = await save('memberA', v, { name: 'ADM04 Candidate 2' })
    expect(updated).toMatchObject({
      mode: 'REVIEW_UPDATED',
      review: { id: created.review.id, version: 2 },
    })
    expect(
      (
        await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM venture_reviews WHERE venture_id = $1`,
          [v],
        )
      )[0]!.n,
    ).toBe(1)
    expect(await failure(approve('admin', created.review.id, { version: 1 }))).toMatchObject({
      status: 409,
    })
    await approve('admin', created.review.id, { version: 2 })
    expect((await live(v)).name).toBe('ADM04 Candidate 2')
  })

  it('approve first, then edit: the edit opens a new review on the new live version', async () => {
    const v = await venture(18, 'memberC', 'PUBLIC', { name: 'ADM04 Seq 0' })
    const opened = (await save('memberC', v, { name: 'ADM04 Seq 1' })) as { review: { id: string } }
    await approve('admin', opened.review.id)
    const next = await save('memberC', v, { name: 'ADM04 Seq 2' })
    expect(next).toMatchObject({ mode: 'REVIEW_CREATED', fields: ['name'] })
    expect((await live(v)).name).toBe('ADM04 Seq 1')
  })

  it('edit vs approve race: one order wins, the older snapshot is never published', async () => {
    const v = await venture(10, 'memberB', 'PUBLIC', { name: 'ADM04 Race 0' })
    const opened = (await save('memberB', v, { name: 'ADM04 Race 1' })) as {
      review: { id: string }
    }
    const [edit, decision] = await Promise.allSettled([
      save('memberB', v, { name: 'ADM04 Race 2' }),
      approve('admin', opened.review.id, { version: 1 }),
    ])
    expect(edit.status).toBe('fulfilled')
    const reviews = await query<{ status: string; name: string }>(
      `SELECT status::text AS status, proposed->>'name' AS name FROM venture_reviews
        WHERE venture_id = $1 ORDER BY submitted_at, id`,
      [v],
    )
    if (decision.status === 'fulfilled') {
      // Approval first: Race 1 is live, the edit opened a new review for Race 2.
      expect((await live(v)).name).toBe('ADM04 Race 1')
      expect(reviews).toEqual([
        { status: 'APPROVED', name: 'ADM04 Race 1' },
        { status: 'PENDING', name: 'ADM04 Race 2' },
      ])
    } else {
      // Edit first: the approval saw version 1 and was refused; nothing went live.
      expect(decision.reason).toMatchObject({ status: 409 })
      expect((await live(v)).name).toBe('ADM04 Race 0')
      expect(reviews).toEqual([{ status: 'PENDING', name: 'ADM04 Race 2' }])
    }
  })
})

describe('website, logo, no business registration', () => {
  it('accepts http / https only, bounded and normalised', () => {
    expect(parseCoreChanges({ website: 'https://Startup.Example/a b' })).toEqual({
      website: 'https://startup.example/a%20b',
    })
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,<b>x</b>',
      'ftp://startup.example',
      'file:///etc/passwd',
      'http://localhost',
      'https://user:pw@startup.example',
      `https://startup.example/${'a'.repeat(500)}`,
      42,
    ]) {
      expect(() => parseCoreChanges({ website: bad }), String(bad)).toThrow()
    }
  })

  it('takes a logo only from the media store: own upload, allowed type and size', async () => {
    const own = await saveAvatarAsset(P.memberA.account, PNG, 'image/png')
    const foreign = await saveAvatarAsset(P.memberC.account, PNG, 'image/png')
    const big = await saveAvatarAsset(
      P.memberA.account,
      new Uint8Array(2 * 1024 * 1024 + 1).fill(1, 8),
      'image/png',
    )
    assets.push(own, foreign, big)
    const v = await venture(11, 'memberA', 'PUBLIC')
    for (const [value, reason] of [
      ['https://cdn.example/logo.png', 'invalid'],
      [foreign, 'invalid'],
      [big, 'invalid'],
      [`asset_${'f'.repeat(32)}`, 'invalid'],
    ] as const) {
      expect(await failure(save('memberA', v, { logo_asset_id: value })), value).toMatchObject({
        status: 422,
        fields: { logo_asset_id: reason },
      })
    }
    const opened = (await save('memberA', v, { logo_asset_id: own })) as { review: { id: string } }
    expect(await reviewerMayFetchLogo(P.admin.account, own)).toBe(true)
    expect(await reviewerMayFetchLogo(P.chALeader.account, own)).toBe(false)
    expect(await reviewerMayFetchLogo(P.admin.account, foreign)).toBe(false)
    const detail = await getVentureReview(P.admin.account, opened.review.id)
    expect(detail.logo.proposed).toMatchObject({
      asset_id: own,
      url: `/media/assets/${own}`,
      content_type: 'image/png',
    })
    await removeAsset(own)
    expect(await failure(approve('admin', opened.review.id))).toMatchObject({ status: 409 })
  })

  it('has no tax code or business registration anywhere in the model or the API', async () => {
    for (const key of [
      'tax_code',
      'business_registration',
      'registration_number',
      'ma_so_doanh_nghiep',
    ]) {
      expect(() => parseCoreChanges({ [key]: '0101234567' }), key).toThrow()
    }
    const columns = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name IN ('projects', 'venture_reviews')`,
    )
    expect(columns.some((c) => /tax|registration|business_code|ma_so/i.test(c.column_name))).toBe(
      false,
    )
    const v = await venture(12, 'memberA', 'PUBLIC')
    const { review } = (await save('memberA', v, { name: 'ADM04 Keys' })) as {
      review: { id: string }
    }
    const [row] = await query<{ keys: string[] }>(
      `SELECT ARRAY(SELECT jsonb_object_keys(proposed) ORDER BY 1) AS keys FROM venture_reviews WHERE id = $1`,
      [review.id],
    )
    expect(row!.keys).toEqual([
      'domain_ids',
      'logo_asset_id',
      'name',
      'owner_role_label',
      'region_id',
      'schema_version',
      'stage_id',
      'summary',
      'website',
    ])
  })
})

describe('queue, detail, scope and self-review', () => {
  it('is PLATFORM_ADMIN only; anyone else: list 403, ids 404', async () => {
    const v = await venture(13, 'memberA', 'PUBLIC', { name: 'ADM04 Queue' })
    const { review } = (await save('memberA', v, {
      name: 'ADM04 Queue 2',
      website: 'https://q.example',
    })) as {
      review: { id: string }
    }
    const list = await listVentureReviews(P.admin.account, new URLSearchParams())
    const item = list.items.find((i) => i.id === review.id)!
    expect(item).toMatchObject({
      kind: 'CORE_CHANGE',
      proposed_name: 'ADM04 Queue 2',
      changed_fields: ['name', 'website'],
      owner: { profile_id: P.memberA.profile, display_name: 'ADM02 memberA' },
      can_act: true,
    })
    for (const who of ['hubLeader', 'chALeader', 'memberA'] as const) {
      expect(
        await failure(listVentureReviews(P[who].account, new URLSearchParams())),
      ).toMatchObject({ status: 403 })
      expect(await failure(getVentureReview(P[who].account, review.id))).toMatchObject({
        status: 404,
      })
      expect(await failure(approve(who, review.id))).toMatchObject({ status: 404 })
    }
    for (const id of ['00000000-0000-4000-8000-000000000000', 'nope']) {
      expect(await failure(getVentureReview(P.admin.account, id))).toMatchObject({ status: 404 })
    }
    const detail = await getVentureReview(P.admin.account, review.id)
    expect(detail.public_version).toMatchObject({
      name: 'ADM04 Queue',
      website: 'https://live.example',
    })
    expect(detail.proposed).toMatchObject({ name: 'ADM04 Queue 2', website: 'https://q.example/' })
    expect(detail.diff.map((d) => [d.field, d.before, d.after])).toEqual([
      ['name', 'ADM04 Queue', 'ADM04 Queue 2'],
      ['website', 'https://live.example', 'https://q.example/'],
    ])
    expect(detail.vocabulary[D.govtech]).toBeTruthy()
    const text = JSON.stringify(detail)
    for (const secret of ['@example.test', 'account_id', 'phone', 'full_name'])
      expect(text).not.toContain(secret)
    for (const [params, field] of [
      [{ status: 'OPEN' }, 'status'],
      [{ kind: 'X' }, 'kind'],
      [{ limit: '0' }, 'limit'],
      [{ cursor: 'zz' }, 'cursor'],
      [{ owner: 'x' }, 'owner'],
    ] as const) {
      expect(
        await failure(listVentureReviews(P.admin.account, new URLSearchParams(params))),
      ).toMatchObject({
        status: 422,
        fields: { [field]: expect.any(String) },
      })
    }
  })

  it('never lets a reviewer decide a venture they own or belong to; the attempt is audited', async () => {
    const own = await venture(14, 'admin', 'DRAFT')
    const review = await submit('admin', own)
    expect((await getVentureReview(P.admin.account, review.id)).can_act).toBe(false)
    expect(await failure(approve('admin', review.id))).toMatchObject({
      status: 403,
      code: 'SCOPE_FORBIDDEN',
    })
    const team = await venture(15, 'memberA', 'DRAFT')
    await query(
      `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at, permission, updated_at)
       VALUES ($1, $2, 'Cố vấn', 'ACTIVE', now(), 'VIEW', now())`,
      [team, P.admin.profile],
    )
    const teamReview = await submit('memberA', team)
    expect(await failure(reject('admin', teamReview.id))).toMatchObject({ status: 403 })
    const refused = await query<{ n: number }>(
      `SELECT count(*)::int AS n FROM audit_events WHERE action = 'VENTURE_REVIEW_SELF_ACTION_REFUSED'
        AND resource_id = ANY($1::uuid[])`,
      [[review.id, teamReview.id]],
    )
    expect(refused[0]!.n).toBe(2)
    expect((await live(own)).visibility).toBe('PRIVATE')
  })
})

describe('review hardening (independent security review)', () => {
  it('bounds the website after normalisation, not only before', () => {
    const grows = `https://a.com/${'é'.repeat(200)}`
    expect(grows.length).toBeLessThan(500)
    expect(() => parseCoreChanges({ website: grows })).toThrow()
  })

  it('refuses a current avatar as a logo (the avatar flow deletes replaced files)', async () => {
    const avatar = await saveAvatarAsset(P.memberB.account, PNG, 'image/png')
    assets.push(avatar)
    await query(`UPDATE individual_profiles SET avatar_asset_id = $2 WHERE id = $1`, [
      P.memberB.profile,
      avatar,
    ])
    try {
      const v = await venture(19, 'memberB', 'PUBLIC')
      expect(await failure(save('memberB', v, { logo_asset_id: avatar }))).toMatchObject({
        status: 422,
        fields: { logo_asset_id: 'invalid' },
      })
    } finally {
      await query(`UPDATE individual_profiles SET avatar_asset_id = NULL WHERE id = $1`, [
        P.memberB.profile,
      ])
    }
  })

  it('refuses a cursor that is not a real instant with 422, never a 500', async () => {
    const bad = Buffer.from(JSON.stringify({ t: '2026-13-45T99:00:00.000000Z', i: V(1) })).toString(
      'base64url',
    )
    expect(
      await failure(listVentureReviews(P.admin.account, new URLSearchParams({ cursor: bad }))),
    ).toMatchObject({
      status: 422,
      fields: { cursor: 'invalid' },
    })
    const { listVerificationRequests } = await import('./verification-queue')
    expect(
      await failure(
        listVerificationRequests(P.admin.account, new URLSearchParams({ cursor: bad })),
      ),
    ).toMatchObject({ status: 422, fields: { cursor: 'invalid' } })
  })

  it('keeps first-publication edits in the private draft, so a rejection loses none', async () => {
    const v = await venture(20, 'memberA', 'DRAFT', { name: 'ADM04 Draft 0' })
    const review = await submit('memberA', v)
    expect(
      await save('memberA', v, { name: 'ADM04 Draft 1', website: 'https://d1.example' }),
    ).toMatchObject({
      mode: 'REVIEW_UPDATED',
      review: { id: review.id, version: 2 },
    })
    expect(await live(v)).toMatchObject({ name: 'ADM04 Draft 1', visibility: 'PRIVATE' })
    await reject('admin', review.id, { version: 2 })
    expect((await live(v)).name).toBe('ADM04 Draft 1')
    const again = await submit('memberA', v)
    const detail = await getVentureReview(P.admin.account, again.id)
    expect(detail.proposed).toMatchObject({ name: 'ADM04 Draft 1', website: 'https://d1.example/' })
  })
})

describe('concurrency', () => {
  it('two reviewers, approve vs reject: exactly one decision', async () => {
    await query(
      `INSERT INTO role_assignments (account_id, individual_profile_id, role_code, scope_type)
       VALUES ($1, $2, 'PLATFORM_ADMIN', 'PLATFORM')`,
      [P.memberC.account, P.memberC.profile],
    )
    try {
      const a = await submit('memberA', await venture(16, 'memberA', 'DRAFT'))
      const two = await Promise.allSettled([approve('admin', a.id), approve('memberC', a.id)])
      expect(two.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const b = await submit('memberB', await venture(17, 'memberB', 'DRAFT'))
      const race = await Promise.allSettled([approve('admin', b.id), reject('memberC', b.id)])
      expect(race.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const decided = await query<{ n: number }>(
        `SELECT count(*)::int AS n FROM audit_events WHERE resource_id = $1
           AND action IN ('VENTURE_REVIEW_APPROVED', 'VENTURE_REVIEW_REJECTED')`,
        [b.id],
      )
      expect(decided[0]!.n).toBe(1)
    } finally {
      await query(
        `DELETE FROM role_assignments WHERE individual_profile_id = $1 AND role_code = 'PLATFORM_ADMIN'`,
        [P.memberC.profile],
      )
    }
  })
})
