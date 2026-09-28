import { expect, test } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { auditRevision } from '../pixel-qa/revision'

/**
 * WF03-S09 — public organization page (/organizations/:slug).
 * API 05 §8.5 `GET /organizations/by-slug/{slug}`; DEC-WF03-G9/G10/G13;
 * DEC-WF01-S07-D2 (PROFILE_DISCOVERY never public); DEC-WF03-S09-D1..D4; the
 * page is the corrected L19 CHP0 subset (TASK 22.4, DEC-L3-D1).
 */

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const SLUG = 'chapter-01'
const PAGE = (slug: string) => `/organizations/${slug}`
const API = (slug: string) => `/api/v1/organizations/by-slug/${slug}`
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

let consoleErrors: string[] = []
const orgs: string[] = []
const events: string[] = []
const profiles: string[] = []
const accounts: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of 404/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  await query(`DELETE FROM events WHERE id = ANY($1::uuid[])`, [events])
  await query(
    `DELETE FROM organization_relationships WHERE source_org_id = ANY($1::uuid[]) OR target_org_id = ANY($1::uuid[])`,
    [orgs],
  )
  await query(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`, [orgs])
  for (const table of [
    'community_memberships',
    'leadership_records',
    'profile_visibility_settings',
  ]) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [profiles])
  }
  await query('DELETE FROM individual_profiles WHERE id = ANY($1::uuid[])', [profiles])
  await query('DELETE FROM user_accounts WHERE id = ANY($1::uuid[])', [accounts])
  await closePool()
})

async function org(type: string, status: string, name: string) {
  const slug = `s09-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const [o] = await query<{ id: string }>(
    `INSERT INTO organizations (type, slug, name, status) VALUES ($1::org_type, $2, $3, $4::publication_status) RETURNING id::text`,
    [type, slug, name, status],
  )
  orgs.push(o!.id)
  return { id: o!.id, slug }
}

async function event(
  orgId: string,
  name: string,
  status: string,
  opts: { programme?: boolean; past?: boolean } = {},
) {
  const [e] = await query<{ id: string }>(
    `INSERT INTO events (organization_id, programme_id, slug, name, status, starts_at, ends_at, location_text)
     VALUES ($1, $2, $3, $4, $5::event_status,
             now() + ($6 || ' days')::interval, now() + ($6 || ' days')::interval + interval '3 hours', 'Cần Thơ')
     RETURNING id::text`,
    [
      orgId,
      opts.programme ? 'c0000000-0000-0000-0000-000000000001' : null,
      `s09-ev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      status,
      opts.past ? '-20' : '20',
    ],
  )
  events.push(e!.id)
  return e!.id
}

/** A person tied to Chapter 01 with a PUBLIC discovery override, email and leadership. */
async function publicLeader(name: string, email: string) {
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  accounts.push(a!.id)
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, headline, status) VALUES ($1, $2, 'Kỹ sư', 'ACTIVE') RETURNING id::text`,
    [a!.id, name],
  )
  profiles.push(p!.id)
  await query(
    `INSERT INTO profile_visibility_settings (profile_id, default_level, group_overrides) VALUES ($1, 'PUBLIC', $2)`,
    [p!.id, JSON.stringify({ PROFILE_DISCOVERY: 'PUBLIC' })],
  )
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source, started_at) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED', now())`,
    [p!.id, CHAPTER_01],
  )
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Trưởng chapter', 'ACTIVE')`,
    [p!.id, CHAPTER_01],
  )
}

const withoutRequestId = (body: { error?: { request_id?: string } }) => ({
  ...body,
  error: { ...body.error, request_id: undefined },
})

test.describe('WF03-S09 public projection', () => {
  test('1/13. guest sees the canonical page: parent, child, counts, upcoming published event', async ({
    page,
    request,
  }) => {
    expect((await page.goto(PAGE(SLUG)))?.status()).toBe(200)
    await expect(page.locator('[data-screen="WF03-S09"]')).toBeVisible()
    await expect(page.locator('[data-shell="ops"], [data-shell="member"]')).toHaveCount(0)
    await expect(page.locator('[data-org-name]')).toHaveText('Chapter 01')
    await expect(page.locator('header')).toContainText('thuộc HUB Network')
    await expect(page.locator('[data-child="club-01"]')).toContainText('Club 01')
    await expect(page.locator('[data-event-card]')).toContainText(['Demo Event'])
    const body = await (await request.get(API(SLUG))).json()
    expect(Object.keys(body).sort()).toEqual([
      'children',
      'description',
      'name',
      'parent',
      'slug',
      'stats',
      'type',
      'upcoming_events',
    ])
    const [{ n }] = (await query(
      `SELECT count(*)::int AS n FROM community_memberships WHERE organization_id = $1 AND state = 'ACTIVE'`,
      [CHAPTER_01],
    )) as [{ n: number }]
    expect(body.stats.active_members).toBe(n)
    expect(JSON.stringify(body)).not.toMatch(UUID)
    expect(JSON.stringify(body)).not.toMatch(
      /metadata|role_code|capabilit|audit|account|profile_id|email/i,
    )
  })

  test('2/3. unknown, draft, archived and non-operational slugs are the same public 404', async ({
    page,
    request,
  }) => {
    const draft = await org('CHAPTER', 'DRAFT', 'S09 Draft Chapter')
    const archived = await org('CLB', 'ARCHIVED', 'S09 Archived Club')
    const company = await org('COMPANY', 'PUBLISHED', 'S09 Company')
    const reference = withoutRequestId(await (await request.get(API('no-such-org'))).json())
    for (const slug of ['no-such-org', draft.slug, archived.slug, company.slug, 'Bad Slug']) {
      const r = await request.get(API(encodeURIComponent(slug)))
      expect(r.status(), slug).toBe(404)
      expect(withoutRequestId(await r.json()), slug).toEqual(reference)
      expect((await page.goto(PAGE(encodeURIComponent(slug))))?.status(), slug).toBe(404)
      await expect(page.locator('[data-shell="not-found"]')).toBeVisible()
      await expect(page.locator('body')).not.toContainText('S09 ')
    }
  })

  test('hierarchy: only PUBLISHED canonical children; legacy parent_id ignored', async ({
    request,
  }) => {
    const hidden = await org('CLB', 'DRAFT', 'S09 Hidden Child')
    await query(
      `INSERT INTO organization_relationships (source_org_id, target_org_id, relationship_type) VALUES ($1, $2, 'PARENT')`,
      [CHAPTER_01, hidden.id],
    )
    const legacy = await org('CLB', 'PUBLISHED', 'S09 Legacy Child')
    await query(`UPDATE organizations SET parent_id = $1 WHERE id = $2`, [CHAPTER_01, legacy.id])
    const body = await (await request.get(API(SLUG))).json()
    const names = body.children.map((c: { name: string }) => c.name)
    expect(names).toContain('Club 01')
    expect(names).not.toContain('S09 Hidden Child')
    expect(names).not.toContain('S09 Legacy Child')
    expect(body.stats.children).toBe(names.length)
  })
})

test.describe('WF03-S09 privacy and event filtering', () => {
  test('4–10. no member PII, pending data or leader identity — even with PUBLIC discovery', async ({
    page,
    request,
  }) => {
    await publicLeader('S09 Công Khai', 's09-leader@example.test')
    const texts = [await page.goto(PAGE(SLUG)).then(() => page.locator('body').innerText())]
    texts.push(JSON.stringify(await (await request.get(API(SLUG))).json()))
    for (const text of texts) {
      expect(text).not.toContain('S09 Công Khai')
      expect(text).not.toContain('Demo Pending') // PENDING_APPROVAL requester
      expect(text).not.toContain('Trưởng chapter')
      expect(text).not.toMatch(
        /@example\.test|s09-leader|\+84|PENDING|REJECTED|WITHDRAWN|SELF_DECLARED|ORGANIZATION_VERIFIED|HUB_COMMUNITY_LEADER|PLATFORM_ADMIN/,
      )
    }
  })

  test('11/12. only upcoming PUBLISHED standalone events: no draft, cancelled, past or WF04 event', async ({
    request,
  }) => {
    await event(CHAPTER_01, 'S09 Public Upcoming', 'PUBLISHED')
    await event(CHAPTER_01, 'S09 Draft', 'DRAFT')
    await event(CHAPTER_01, 'S09 Cancelled', 'CANCELLED')
    await event(CHAPTER_01, 'S09 Live', 'LIVE')
    await event(CHAPTER_01, 'S09 Past Published', 'PUBLISHED', { past: true })
    await event(CHAPTER_01, 'S09 Programme Event', 'PUBLISHED', { programme: true })
    const body = await (await request.get(API(SLUG))).json()
    const names = body.upcoming_events.map((e: { name: string }) => e.name)
    expect(names).toContain('S09 Public Upcoming')
    for (const hidden of [
      'S09 Draft',
      'S09 Cancelled',
      'S09 Live',
      'S09 Past Published',
      'S09 Programme Event',
      'Demo Draft Event',
    ])
      expect(names).not.toContain(hidden)
    const [{ n }] = (await query(
      `SELECT count(*)::int AS n FROM events WHERE organization_id = $1 AND programme_id IS NULL AND status = 'PUBLISHED'`,
      [CHAPTER_01],
    )) as [{ n: number }]
    expect(body.stats.public_events).toBe(n)
    for (const e of body.upcoming_events)
      expect(Object.keys(e).sort()).toEqual([
        'ends_at',
        'location_text',
        'name',
        'starts_at',
        'summary',
      ])
  })

  test('14. signed-in member, leader and admin receive exactly the guest projection', async ({
    page,
    request,
  }) => {
    const guest = await (await request.get(API(SLUG))).json()
    await page.goto(PAGE(SLUG))
    const guestText = await page.locator('[data-screen="WF03-S09"]').innerText()
    for (const email of ['member@example.test', 'leader@example.test', 'ops@example.test']) {
      await page.context().clearCookies()
      expect((await page.request.post('/dev/login', { data: { email } })).ok()).toBe(true)
      expect(await (await page.request.get(API(SLUG))).json(), email).toEqual(guest)
      await page.goto(PAGE(SLUG))
      expect(await page.locator('[data-screen="WF03-S09"]').innerText(), email).toBe(guestText)
    }
  })
})

test.describe('WF03-S09 pixel QA (corrected L19 CHP0 subset)', () => {
  const REFERENCE = 'design-reference/final/revision/L3/L19__chapter-public__SOURCE.png'
  /** L19, measured once: section tops, the first CLB and event cards, the join button, the footer. */
  const REF = {
    children: 1195,
    childCard: 1418,
    events: 1767,
    eventCard: 1953,
    join: 2149,
    joinButton: 2352,
    footer: 2461,
  }

  test('1440×900 full page: bar, hero frame and actions, sections, cards, join band, footer', async ({
    page,
  }) => {
    // Deterministic state: only seeded rows (test-created events / children removed).
    await query(`DELETE FROM events WHERE name LIKE 'S09 %'`)
    await query(
      `DELETE FROM organization_relationships WHERE target_org_id IN (SELECT id FROM organizations WHERE slug LIKE 's09-%')`,
    )
    await page.goto('/organizations/chapter-01', { waitUntil: 'networkidle' })
    await expect(page.locator('[data-event-card]')).toHaveCount(1)
    await expect(page.locator('[data-child]')).toHaveCount(1)
    const top = async (sel: string) =>
      Math.round((await page.locator(sel).first().boundingBox())!.y)
    const dyChildren = (await top('#truc-thuoc')) - REF.children
    const dyChildCard = (await top('[data-child]')) - REF.childCard
    const dyEvents = (await top('#su-kien')) - REF.events
    const dyEventCard = (await top('[data-event-card]')) - REF.eventCard
    const join = page.locator('[data-screen="WF03-S09"] section').last()
    const dyJoin = Math.round((await join.boundingBox())!.y) - REF.join
    const dyJoinButton = Math.round((await join.locator('a').boundingBox())!.y) - REF.joinButton
    const dyFooter = (await top('[data-screen="WF03-S09"] footer')) - REF.footer
    await auditRevision(page, {
      name: 'WF03-S09.L19',
      reference: REFERENCE,
      full: true,
      segments: [
        // "HUB NETWORK /" and the join CTA; the org name differs.
        { name: 'bar-brand', reference: { x: 0, y: 0, width: 272, height: 78 }, dy: 0 },
        { name: 'bar-cta', reference: { x: 1160, y: 8, width: 170, height: 62 }, dy: 0 },
        { name: 'hero-logo', reference: { x: 100, y: 156, width: 106, height: 104 }, dy: 0 },
        { name: 'stats-top-rule', reference: { x: 120, y: 384, width: 1200, height: 12 }, dy: 0 },
        { name: 'stats-first-label', reference: { x: 112, y: 446, width: 90, height: 24 }, dy: 0 },
        {
          name: 'stats-bottom-rule',
          reference: { x: 120, y: 480, width: 1200, height: 12 },
          dy: 0,
        },
        { name: 'hero-join', reference: { x: 110, y: 500, width: 194, height: 70 }, dy: 0 },
        {
          // L19's eyebrow row also holds the omitted QĐ-13 chip, which makes it 5px lower.
          name: 'children-eyebrow',
          reference: { x: 110, y: 1256, width: 150, height: 26 },
          dy: dyChildren - 5,
        },
        {
          name: 'child-card-banner',
          reference: { x: 118, y: 1415, width: 392, height: 70 },
          dy: dyChildCard,
        },
        {
          name: 'child-card-link',
          reference: { x: 132, y: 1660, width: 140, height: 30 },
          dy: dyChildCard,
        },
        {
          name: 'child-card-bottom',
          reference: { x: 118, y: 1690, width: 392, height: 20 },
          dy: dyChildCard,
        },
        {
          name: 'events-eyebrow',
          reference: { x: 110, y: 1822, width: 110, height: 26 },
          dy: dyEvents,
        },
        {
          name: 'event-card-media',
          reference: { x: 118, y: 2006, width: 128, height: 86 },
          dy: dyEventCard,
        },
        {
          name: 'event-card-right',
          reference: { x: 470, y: 1949, width: 40, height: 142 },
          dy: dyEventCard,
        },
        { name: 'join-eyebrow', reference: { x: 110, y: 2200, width: 90, height: 30 }, dy: dyJoin },
        {
          name: 'join-button',
          reference: { x: 120, y: 2352, width: 186, height: 51 },
          dy: dyJoinButton,
        },
        {
          name: 'footer-brand',
          reference: { x: 110, y: 2482, width: 186, height: 30 },
          dy: dyFooter,
        },
      ],
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-S09-D3 / DEC-L3-D1: no person is rendered (PROFILE_DISCOVERY is never public) — the leadership section is omitted; no contact email',
        },
        {
          class: 'INTENTIONAL-SCOPE',
          reason:
            'DEC-L3-D1 (HD-08, no P0 source): "Bài toán" nav, founding-date chip, region line, partner strip, team / summit counts, summit button, QĐ-13 chip, province chips, registration chips and capacities, footer links; later sections move up (compared per section)',
        },
        {
          class: 'INTENTIONAL-DATA',
          reason:
            'names, counts, description and the event come from the seeded Chapter 01; the stat labels are the three canonical counts; CLB banners and initials are decoration',
        },
        { class: 'INTENTIONAL-SCOPE', reason: 'HD-11: no floating "Góp ý" button' },
      ],
    })
  })
})
