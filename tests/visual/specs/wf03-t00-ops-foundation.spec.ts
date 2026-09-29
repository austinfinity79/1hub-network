import path from 'node:path'

import { expect, test, type APIRequestContext } from '@playwright/test'

import { closePool, query } from '../../../src/lib/db/client'
import { REPO_ROOT, resolveOutputPath } from '../pixel-qa/paths'
import { decodePng, readPng } from '../pixel-qa/png'
import { writeJsonReport } from '../pixel-qa/report'
import { compareSegments, type Rect } from '../pixel-qa/segments'

/**
 * WF03-T00 — ops foundation: OpsShell, /ops guard, organization context,
 * GET /ops/organizations, canonical hierarchy (DEC-WF03-G6/G9/G11/G15, C2).
 */

const HUB = '10000000-0000-0000-0000-000000000001'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const API = '/api/v1/ops/organizations'
const ORG_ROUTES = (id: string) => [
  `/ops/org/${id}`,
  `/ops/org/${id}/members`,
  `/ops/org/${id}/members/40000000-0000-0000-0000-000000000001`,
  `/ops/org/${id}/programmes`,
  `/ops/org/${id}/profile`,
  `/ops/org/${id}/events`,
  `/ops/org/${id}/settings`,
]

let consoleErrors: string[] = []
const people: string[] = []

test.beforeEach(async ({ page }) => {
  consoleErrors = []
  page.on('console', (m) => {
    if (m.type() === 'error' && !/status of (4\d\d)/.test(m.text())) consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(e.message))
  await page.context().clearCookies()
})

test.afterEach(() => {
  expect(consoleErrors, 'browser console errors').toEqual([])
})

test.afterAll(async () => {
  for (const table of ['community_memberships', 'leadership_records']) {
    await query(`DELETE FROM ${table} WHERE profile_id = ANY($1::uuid[])`, [people])
  }
  await closePool()
})

async function login(request: APIRequestContext, email: string) {
  expect((await request.post('/dev/login', { data: { email } })).ok()).toBe(true)
}

/** An onboarded person whose only ties are a membership and a leadership title. */
async function relationsOnly(): Promise<string> {
  const email = `t00-rel-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
     VALUES ($1, 'Rel', 'ACTIVE', now(), now()) RETURNING id::text`,
    [a!.id],
  )
  await query(
    `INSERT INTO community_memberships (profile_id, organization_id, state, source) VALUES ($1, $2, 'ACTIVE', 'ORGANIZATION_VERIFIED')`,
    [p!.id, CHAPTER_01],
  )
  await query(
    `INSERT INTO leadership_records (profile_id, organization_id, role_label, state) VALUES ($1, $2, 'Chủ tịch', 'ACTIVE')`,
    [p!.id, CHAPTER_01],
  )
  people.push(p!.id)
  return email
}

test.describe('WF03-T00 guard', () => {
  test('1. guest: every /ops route → /auth; API 401', async ({ page, request }) => {
    for (const route of ['/ops/network', ...ORG_ROUTES(CHAPTER_01)]) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/auth')
    }
    expect((await request.get(API)).status()).toBe(401)
  })

  test('2/7. member (HUB_MEMBER role + ACTIVE membership): no ops area; API 403', async ({
    page,
  }) => {
    await login(page.request, 'member@example.test')
    for (const route of ['/ops/network', ...ORG_ROUTES(CHAPTER_01)]) {
      expect((await page.goto(route))?.status(), route).toBe(404)
    }
    const r = await page.request.get(API)
    expect(r.status()).toBe(403)
    expect((await r.json()).error.code).toBe('SCOPE_FORBIDDEN')
  })

  test('3. incomplete onboarding follows the canonical resolver', async ({ page }) => {
    await login(page.request, `t00-new-${Date.now()}@example.test`)
    for (const route of ['/ops/network', `/ops/org/${CHAPTER_01}`]) {
      await page.goto(route)
      await expect(page, route).toHaveURL('/onboarding')
    }
  })

  test('6/8. leadership "Chủ tịch" + ACTIVE membership alone grant nothing', async ({ page }) => {
    await login(page.request, await relationsOnly())
    for (const route of ['/ops/network', `/ops/org/${CHAPTER_01}`]) {
      expect((await page.goto(route))?.status(), route).toBe(404)
    }
    expect((await page.request.get(API)).status()).toBe(403)
  })
})

test.describe('WF03-T00 scope and context (leader, admin)', () => {
  test('4/5/9/10. leader: exact scope only; context in the URL or request is not authority; safe DTO', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    // Own organization: shell + context + placeholder body.
    expect((await page.goto('/ops/network'))?.status()).toBe(200)
    await expect(page.locator('[data-shell="ops"]')).toBeVisible()
    await expect(page.locator('[data-shell="member"]')).toHaveCount(0)
    // WF03-S01 has replaced its placeholder inside OpsShell.
    await expect(page.locator('[data-screen="WF03-S01"]')).toBeVisible()
    await expect(page.locator('[data-nav-key="network"]')).toHaveAttribute('aria-current', 'page')

    expect((await page.goto(`/ops/org/${CHAPTER_01}/members`))?.status()).toBe(200)
    await expect(page.locator(`[data-org-context="${CHAPTER_01}"]`)).toContainText('Chapter 01')
    await expect(page.locator('[data-nav-key]')).toHaveText([
      'Danh sách tổ chức',
      'Tổng quan',
      'Thành viên',
      'Hồ sơ tổ chức',
      'Sự kiện',
      'Quan hệ tổ chức',
    ])
    await expect(page.locator('[data-nav-key="members"]')).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('[data-nav-key="programmes"]')).toHaveCount(0)
    // 4/9. Sibling, child (no inheritance), parent, malformed: all the same 404.
    for (const id of [CHAPTER_02, CLUB_01, HUB, 'sample-org']) {
      for (const route of ORG_ROUTES(id)) {
        expect((await page.goto(route))?.status(), route).toBe(404)
      }
    }
    // 5. Spoofed context (query, headers) changes nothing.
    const spoofed = await page.request.get(`${API}?orgId=${CHAPTER_02}&scope=${HUB}`, {
      headers: { 'x-org-id': CHAPTER_02, 'x-organization-id': HUB },
    })
    const body = await spoofed.json()
    expect(body.items.map((i: { id: string }) => i.id)).toEqual([CHAPTER_01])
    // 10. Safe DTO: exact keys, no person or internal data.
    expect(Object.keys(body.items[0]).sort()).toEqual(
      ['active_members', 'id', 'name', 'parent', 'slug', 'status', 'type'].sort(),
    )
    expect(body.items[0].parent).toEqual({
      id: HUB,
      slug: 'hub-network',
      name: 'HUB Network',
      type: 'HUB',
    })
    expect(JSON.stringify(body)).not.toMatch(/@|metadata|role|assignment|audit|profile/i)
    expect(body.page).toEqual({ next_cursor: null, limit: 50 })
  })

  test('platform admin: every operational organization, incl. the C2 canonical parent', async ({
    page,
  }) => {
    await login(page.request, 'ops@example.test')
    const body = await (await page.request.get(`${API}?q=0`)).json()
    const byId = new Map(
      body.items.map((i: { id: string; parent: { id: string } | null }) => [i.id, i]),
    )
    for (const id of [CHAPTER_01, CHAPTER_02, CLUB_01]) expect(byId.has(id), id).toBe(true)
    expect((byId.get(CHAPTER_02) as { parent: { id: string } }).parent.id).toBe(HUB)
    expect((byId.get(CLUB_01) as { parent: { id: string } }).parent.id).toBe(CHAPTER_01)
    expect((await page.goto(`/ops/org/${CLUB_01}`))?.status()).toBe(200)
    await expect(page.locator(`[data-org-context="${CLUB_01}"]`)).toContainText('Club 01')
  })
})

test.describe('WF03-T00 OpsShell pixel (family "Quản trị HUB tổng", WF03-S08 reference)', () => {
  test('sidebar frame, active item and canvas edge match the approved sidebar', async ({
    page,
  }) => {
    await login(page.request, 'leader@example.test')
    await page.goto('/ops/network', { waitUntil: 'networkidle' })
    await page.evaluate(() => document.fonts.ready)
    const actual = decodePng(await page.screenshot({ animations: 'disabled' }))
    const box = (await page.locator('[data-nav-key="network"]').boundingBox())!
    const textMask: Rect[] = await page.evaluate(() => {
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
    // Reference text: wordmark, subtitle, group label, item labels.
    const REF_TEXT: Rect[] = [
      { x: 14, y: 22, width: 110, height: 42 },
      { x: 14, y: 74, width: 50, height: 16 },
      { x: 26, y: 114, width: 150, height: 180 },
    ]
    const reference = readPng(
      path.join(
        REPO_ROOT,
        'design-reference/final/WF03/WF03-S08__unit-settings-relationships__1440x900.png',
      ),
    )
    // Reference active box: x 18..197, y 224..261.
    const activeDy = Math.round(box.y) - 224
    const results = compareSegments(
      reference,
      actual,
      [
        { name: 'sidebar-head', reference: { x: 0, y: 0, width: 216, height: 100 }, dy: 0 },
        { name: 'active-item', reference: { x: 10, y: 218, width: 196, height: 50 }, dy: activeDy },
        { name: 'sidebar-body', reference: { x: 0, y: 340, width: 216, height: 440 }, dy: 0 },
        { name: 'sidebar-edge', reference: { x: 206, y: 100, width: 20, height: 690 }, dy: 0 },
      ],
      [...textMask, ...REF_TEXT, ...REF_TEXT.map((r) => ({ ...r, y: r.y + activeDy }))],
      { diffPath: resolveOutputPath('diff', 'WF03-T00.shell.diff.png') },
    )
    writeJsonReport('WF03-T00.shell.json', {
      reference: 'WF03-S08 (sidebar only)',
      intentional: [
        {
          class: 'INTENTIONAL-CONTRACT',
          reason:
            'DEC-WF03-G15: one OpsShell for /ops/*; the ADM-coded "Quản trị" sidebar (S01/S05) and the unit top nav (S02/S06) are not reproduced',
        },
        {
          class: 'INTENTIONAL-P0-SCOPE',
          reason:
            'Drawn items without an executable WF03 destination (account admin, approval queue, verification, audit log) and the sprint/FS-03 note card are not rendered',
        },
        {
          class: 'INTENTIONAL-COPY',
          reason:
            'Subtitle slot carries the ops context / breadcrumb instead of "Quản trị HUB tổng"; labels pending PO review',
        },
      ],
      segments: results,
    })
    for (const r of results) expect(r.outside_ratio, `${r.name} drift`).toBeLessThan(0.002)
  })
})
