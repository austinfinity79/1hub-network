import type { APIRequestContext, Browser, Page } from '@playwright/test'

import { query } from '../../../src/lib/db/client'
import { expect } from './uat'

/** PRJ1 → PRJ3 as the member drives them, and the stored venture. */

export type Step1 = {
  type: 'Dự án / ý tưởng' | 'Startup'
  name: string
  domains?: string[]
  summary?: string
  stage?: string
  role?: string
}

export const VENTURES = '/api/v1/ventures'
export const next = (page: Page) => page.getByRole('button', { name: 'Tiếp tục · Mời đội ngũ' })
export const alerts = (page: Page) => page.locator('[data-step-form="info"] [role="alert"]')

export async function fillStep1(page: Page, v: Step1): Promise<void> {
  await page.getByRole('radio', { name: v.type, exact: true }).check({ force: true })
  await page.locator('#ve-name').fill(v.name)
  await page.locator('[aria-controls="ve-domain-list"]').click()
  for (const label of v.domains ?? ['Logistics'])
    await page.locator('#ve-domain-list').getByRole('button', { name: label, exact: true }).click()
  await page.locator('#ve-summary').fill(v.summary ?? 'Một dòng mô tả.')
  await page.getByRole('radio', { name: v.stage ?? 'Ý tưởng', exact: true }).check({ force: true })
  if (v.role) await page.getByRole('radio', { name: v.role, exact: true }).check({ force: true })
}

/** Counts the POST /ventures this page sends. */
export function countCreates(page: Page): { n: number } {
  const counter = { n: 0 }
  page.on('request', (r) => {
    if (r.method() === 'POST' && new URL(r.url()).pathname === VENTURES) counter.n++
  })
  return counter
}

export async function ventureRow(id: string) {
  const [row] = await query<{
    type: string
    status: string
    visibility: string
    owner: string
    stage: string | null
    role: string | null
    team_rows: number
  }>(
    `SELECT p.type::text AS type, p.status::text AS status, p.visibility::text AS visibility,
            p.owner_profile_id::text AS owner, v.slug AS stage, p.owner_role_label AS role,
            (SELECT count(*)::int FROM project_members WHERE project_id = p.id) AS team_rows
       FROM projects p LEFT JOIN vocabulary_items v ON v.id = p.stage_id WHERE p.id = $1`,
    [id],
  )
  return row!
}

export const ventureCount = async (profileId: string) =>
  (
    await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1',
      [profileId],
    )
  )[0]!.n

/**
 * DRAFT / private leakage: a guest and an unrelated member reach no page or
 * API that names the venture.
 */
export async function assertNoLeak(
  browser: Browser,
  outsider: APIRequestContext,
  venture: { id: string; name: string },
): Promise<void> {
  const guest = await browser.newContext()
  for (const path of ['/', '/library', '/organizations/chapter-01', '/about']) {
    const response = await guest.request.get(path)
    expect(response.status(), path).toBe(200)
    const html = await response.text()
    expect(html.includes(venture.name) || html.includes(venture.id), path).toBe(false)
  }
  expect((await guest.request.get(`${VENTURES}/${venture.id}`)).status()).toBe(401)
  await guest.close()
  expect((await outsider.get(`${VENTURES}/${venture.id}`)).status()).toBe(404)
  const theirs = await (await outsider.get('/api/v1/me/ventures')).json()
  expect(JSON.stringify(theirs)).not.toContain(venture.id)
}
