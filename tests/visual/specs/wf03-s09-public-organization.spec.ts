import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { runScreenQa } from '../pixel-qa/capture'
import { findScreen, loadManifest } from '../pixel-qa/manifest'
import { qaConfigFor } from '../pixel-qa/qa-screens'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF03-S09 — public organization page (/organizations/:slug).
 * API 05 §8.5 `GET /organizations/by-slug/{slug}`; DEC-WF03-G9/G10/G13;
 * DEC-WF01-S07-D2 (PROFILE_DISCOVERY never public); DEC-WF03-S09-D1..D4.
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

async function textRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const rects: { x: number; y: number; width: number; height: number }[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent!.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const r of range.getClientRects())
        rects.push({ x: r.x - 2, y: r.y - 2, width: r.width + 4, height: r.height + 4 })
    }
    return rects
  })
}

test.describe('WF03-S09 pixel QA', () => {
  test('viewport + full page against the approved reference (section segments)', async ({
    page,
  }) => {
    const { screens } = loadManifest()
    const screen = findScreen(screens, 'WF03-S09')
    const reports = await runScreenQa(page, screen, qaConfigFor('WF03-S09')!, {
      // Deterministic state: only seeded rows (test-created events / children removed).
      beforeNavigate: async () => {
        await query(`DELETE FROM events WHERE name LIKE 'S09 %'`)
        await query(
          `DELETE FROM organization_relationships WHERE target_org_id IN (SELECT id FROM organizations WHERE slug LIKE 's09-%')`,
        )
      },
      afterLoad: async (p) => {
        await expect(p.locator('[data-event-card]')).toHaveCount(1)
        await expect(p.locator('[data-child]')).toHaveCount(1)
      },
    })
    const viewport = reports.find((r) => r.capture === 'viewport')!
    expect(viewport.typography?.violations).toEqual([])

    const actual = decodePng(await page.screenshot({ animations: 'disabled', fullPage: true }))
    const reference = readPng(path.join(REPO_ROOT, screen.full_page_baseline!))
    const top = async (sel: string) =>
      Math.round((await page.locator(sel).first().boundingBox())!.y)
    const childDy = (await top('#truc-thuoc')) - 1170
    const eventsDy = (await top('#su-kien')) - 1705
    const joinY = await top('[data-screen="WF03-S09"] section:last-of-type')
    const joinDy = joinY - 2064
    const footerDy = (await top('[data-screen="WF03-S09"] footer')) - 2362
    const ghost = (await page.locator('a[href="#su-kien"]').last().boundingBox())!
    const childCardDy = (await top('[data-child]')) - 1381
    const mask = await textRects(page)
    // Reference text regions (moved with their segments).
    const REF_TEXT: Rect[] = [
      { x: 146, y: 62, width: 290, height: 26 },
      { x: 1160, y: 64, width: 116, height: 24 },
      { x: 146, y: 158, width: 205, height: 20 },
      { x: 238, y: 196, width: 380, height: 84 },
      { x: 146, y: 288, width: 670, height: 56 },
      { x: 146, y: 426, width: 1150, height: 58 },
      { x: 170, y: 532, width: 130, height: 26 },
      { x: 146, y: 1230 + childDy, width: 700, height: 130 },
      { x: 146, y: 1760 + eventsDy, width: 700, height: 100 },
      { x: 146, y: 2116 + joinDy, width: 800, height: 130 },
      { x: 146, y: 2384 + footerDy, width: 320, height: 46 },
    ]
    // INTENTIONAL-CONTRACT / P0-SCOPE regions of the reference (D4): the "Bài toán" nav link
    // (WF04), the founding-date chip, the summit button and note, the chapter link card.
    const OMITTED: Rect[] = [
      { x: 790, y: 60, width: 350, height: 30 },
      { x: 340, y: 150, width: 225, height: 34 },
      { x: 322, y: 516, width: 520, height: 58 },
      { x: ghost.x - 4, y: ghost.y - 4, width: 520, height: ghost.height + 8 },
      { x: 970, y: 2136 + joinDy, width: 325, height: 150 },
      // "Nộp bài không qua chapter" (WF04), CLB region chips, footer links (no P0 source).
      { x: 336, y: 2252 + joinDy, width: 248, height: 60 },
      { x: 168, y: 1396 + childCardDy, width: 210, height: 36 },
      { x: 930, y: 2396 + footerDy, width: 365, height: 24 },
    ]
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'frame-top', reference: { x: 0, y: 0, width: 1440, height: 38 }, dy: 0 },
        { name: 'top-bar', reference: { x: 0, y: 38, width: 1440, height: 74 }, dy: 0 },
        { name: 'hero', reference: { x: 0, y: 112, width: 1440, height: 492 }, dy: 0 },
        {
          name: 'children-section-top',
          reference: { x: 0, y: 1170, width: 1440, height: 205 },
          dy: childDy,
        },
        {
          name: 'child-card-top',
          reference: { x: 145, y: 1375, width: 380, height: 60 },
          dy: childCardDy,
        },
        {
          name: 'events-section-top',
          reference: { x: 0, y: 1705, width: 1440, height: 170 },
          dy: eventsDy,
        },
        {
          name: 'event-card-top',
          reference: { x: 145, y: 1875, width: 380, height: 20 },
          dy: (await top('[data-event-card]')) - 1881,
        },
        { name: 'join-band', reference: { x: 0, y: 2064, width: 1440, height: 298 }, dy: joinDy },
        { name: 'footer', reference: { x: 0, y: 2362, width: 1440, height: 149 }, dy: footerDy },
      ],
      [...mask, ...REF_TEXT, ...OMITTED],
      { diffPath: resolveOutputPath('diff', 'WF03-S09.segments.diff.png') },
    )
    const full = reports.find((r) => r.capture === 'full_page')!
    writeJsonReport('WF03-S09.segments.json', {
      screen_id: 'WF03-S09',
      state: qaConfigFor('WF03-S09')!.state,
      full_page: {
        rule: 'EXACT',
        status: full.comparison.status,
        reference_height: 2511,
        actual_height: full.comparison.actual_size!.height,
      },
      offsets: { childDy, eventsDy, joinDy, footerDy },
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-S09-D3: no person is rendered (PROFILE_DISCOVERY is never public, DEC-WF01-S07-D2) — the leadership section is omitted; no contact email',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reason:
            'No P0 source: founding date, region line, partner strip, team / summit counts, "Bài toán", summit button, registration chips and capacity, chapter challenge link, CLB region chips and the QĐ-13 note; the later sections move up (compared per section)',
        },
        {
          class: 'INTENTIONAL-TYPOGRAPHY-MIGRATION',
          reason: 'glyphs masked; DOM typography contract asserted',
        },
      ],
      segments: results,
      product_pixel_pass_claimed: false,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
