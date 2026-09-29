import { expect, test, type Page } from '@playwright/test'

import { hashToken } from '../../../src/lib/auth/tokens'
import { requestMagicLink } from '../../../src/lib/auth/magic-link'
import { closePool, query } from '../../../src/lib/db/client'

/**
 * SEC-OBS-01 — the magic-link callback must never leak its token through the
 * Referer of its own subresource requests. `next.config.ts` sends
 * `Referrer-Policy: no-referrer` on /auth/callback from the first byte; the
 * page's <meta name="referrer"> alone came after the asset links.
 */

const MEMBER = 'member@example.test'
const NEWCOMER = 'newcomer@example.test'

test.afterAll(async () => {
  await closePool()
})

const mint = async (email: string) => (await requestMagicLink(email, null)).token
const callback = (token: string) => `/auth/callback?token=${encodeURIComponent(token)}`

/** Every request of the page, with the Referer it actually sent. */
function recordReferers(page: Page) {
  const seen: { url: string; type: string; referer: string | undefined }[] = []
  page.on('request', (r) =>
    seen.push({ url: r.url(), type: r.resourceType(), referer: r.headers()['referer'] }),
  )
  return seen
}

function assertNoLeak(seen: ReturnType<typeof recordReferers>, token: string) {
  const subresources = seen.filter((s) => s.type !== 'document')
  expect(subresources.length, 'the callback loads assets').toBeGreaterThan(0)
  for (const s of seen) {
    const ref = s.referer ?? ''
    expect(ref, `${s.type} ${s.url}`).not.toContain('token=')
    expect(ref, `${s.type} ${s.url}`).not.toContain(token)
    expect(ref, `${s.type} ${s.url}`).not.toContain('/auth/callback?')
  }
}

test.describe('SEC-OBS-01 callback Referrer-Policy', () => {
  test('the callback response sends Referrer-Policy: no-referrer; other routes are unchanged', async ({
    request,
  }) => {
    const res = await request.get('/auth/callback?token=invalid-token-value', { maxRedirects: 0 })
    expect(res.headers()['referrer-policy']).toBe('no-referrer')
    // Narrow scope: the header is not added elsewhere.
    for (const path of ['/auth', '/me', '/auth/error']) {
      const other = await request.get(path, { maxRedirects: 0 })
      expect(other.headers()['referrer-policy'], path).toBeUndefined()
    }
  })

  test('valid link: one session, redirect, no token in any Referer, token gone from the URL', async ({
    page,
  }) => {
    const token = await mint(NEWCOMER)
    const seen = recordReferers(page)
    const count = async () =>
      (
        await query<{ n: number }>(
          `SELECT count(*)::int AS n FROM user_sessions s JOIN user_accounts a ON a.id = s.account_id WHERE a.email_normalized = $1`,
          [NEWCOMER],
        )
      )[0]!.n
    const before = await count()
    await page.goto(callback(token))
    await expect(page).toHaveURL('/onboarding')
    await page.waitForLoadState('networkidle')
    assertNoLeak(seen, token)
    expect(await count()).toBe(before + 1)
    // Consumed once: the same link now resolves to USED.
    const again = recordReferers(page)
    await page.goto(callback(token))
    await expect(page).toHaveURL('/auth/callback?status=used')
    assertNoLeak(again, token)
  })

  test('expired and invalid links keep their states and leak nothing', async ({ page }) => {
    const expired = await mint(MEMBER)
    await query(
      `UPDATE auth_magic_link_requests SET expires_at = now() - interval '1 second' WHERE token_hash = $1`,
      [hashToken(expired)],
    )
    let seen = recordReferers(page)
    await page.goto(callback(expired))
    await expect(page).toHaveURL('/auth/callback?status=expired')
    await page.waitForLoadState('networkidle')
    assertNoLeak(seen, expired)

    const invalid = 'not-a-real-token-value-000000'
    seen = recordReferers(page)
    await page.goto(callback(invalid))
    await expect(page).toHaveURL('/auth/error')
    await page.waitForLoadState('networkidle')
    assertNoLeak(seen, invalid)
  })
})
