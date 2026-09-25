import { expect, test, type Page } from '@playwright/test'

import { FROZEN_ROUTES } from '../../../src/lib/routes'

/**
 * M0 foundation completion audit — browser console health.
 *
 * Every frozen foundation route and every dev harness must load without a
 * console error, an uncaught page error or an unexpected 404, both for a guest
 * and for the seeded personas whose route groups they belong to. This proves
 * the foundation is quiet before WF screens are built on it.
 */

const DEV_HARNESSES = ['/dev/typography', '/dev/primitives', '/dev/pixel-qa']

type Problem = { url: string; kind: string; text: string }

async function visit(page: Page, url: string): Promise<{ status: number; problems: Problem[] }> {
  const problems: Problem[] = []
  const onConsole = (msg: import('@playwright/test').ConsoleMessage) => {
    if (msg.type() === 'error') problems.push({ url, kind: 'console', text: msg.text() })
  }
  const onPageError = (error: Error) =>
    problems.push({ url, kind: 'pageerror', text: error.message })
  page.on('console', onConsole)
  page.on('pageerror', onPageError)
  const response = await page.goto(url, { waitUntil: 'networkidle' })
  page.off('console', onConsole)
  page.off('pageerror', onPageError)
  return { status: response?.status() ?? 0, problems }
}

const PERSONAS = [
  { name: 'guest', email: null },
  { name: 'member', email: 'member@example.test' },
  { name: 'leader', email: 'leader@example.test' },
] as const

for (const persona of PERSONAS) {
  test(`frozen routes load cleanly for ${persona.name}`, async ({ page }) => {
    if (persona.email) {
      const login = await page.request.post('/dev/login', { data: { email: persona.email } })
      expect(login.ok()).toBe(true)
    }
    const problems: Problem[] = []
    for (const route of FROZEN_ROUTES) {
      const result = await visit(page, route.samplePath)
      expect(result.status, `${route.samplePath} status`).toBeLessThan(400)
      problems.push(...result.problems)
    }
    expect(problems).toEqual([])
  })
}

test('dev harnesses load cleanly', async ({ page }) => {
  const problems: Problem[] = []
  for (const url of DEV_HARNESSES) {
    const result = await visit(page, url)
    expect(result.status, `${url} status`).toBe(200)
    problems.push(...result.problems)
  }
  expect(problems).toEqual([])
})
