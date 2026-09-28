import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'

import { closePool, query } from '@/lib/db/client'

import { isProvisioned } from './provisioning'
import { MAX_LINKS_PER_EMAIL, MAX_REQUESTS_PER_IP, checkEmailRate, checkIpRate } from './rate-limit'
import { requestMagicLink } from './magic-link'

/** TASK 22-PREVIEW-AUTH — invite-only request and rate limits (DEC-AUTH-EMAIL-D1 / D2). */
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const created: string[] = []

afterEach(() => vi.unstubAllEnvs())

afterAll(async () => {
  await query('DELETE FROM auth_magic_link_requests WHERE email_normalized = ANY($1::text[])', [
    created,
  ])
  await query('DELETE FROM user_accounts WHERE email_normalized = ANY($1::text[])', [created])
  await closePool()
})

describe('isProvisioned', () => {
  it('accepts an existing account, refuses an unknown address and creates nothing', async () => {
    vi.stubEnv('ENABLE_DEV_ROUTES', '')
    expect(await isProvisioned('MEMBER@example.test')).toBe(true)
    const unknown = `stranger-${stamp}@not-provisioned.vn`
    expect(await isProvisioned(unknown)).toBe(false)
    const rows = await query('SELECT 1 FROM user_accounts WHERE email_normalized = $1', [unknown])
    expect(rows).toHaveLength(0)
  })

  it('accepts an unconsumed launch-roster address', async () => {
    vi.stubEnv('ENABLE_DEV_ROUTES', '')
    const [roster] = await query<{ email_normalized: string }>(
      'SELECT email_normalized FROM membership_bootstrap WHERE consumed_at IS NULL LIMIT 1',
    )
    if (roster) expect(await isProvisioned(roster.email_normalized)).toBe(true)
  })

  it('counts new @example.test personas only while dev routes are on', async () => {
    const persona = `fresh-${stamp}@example.test`
    vi.stubEnv('ENABLE_DEV_ROUTES', '')
    expect(await isProvisioned(persona)).toBe(false)
    vi.stubEnv('ENABLE_DEV_ROUTES', '1')
    expect(await isProvisioned(persona)).toBe(true)
    expect(await isProvisioned(`fresh-${stamp}@not-provisioned.vn`)).toBe(false)
  })
})

describe('rate limits', () => {
  it('refuses the next link once an address had the maximum in 15 minutes', async () => {
    const email = `rate-${stamp}@example.test`
    created.push(email)
    for (let i = 0; i < MAX_LINKS_PER_EMAIL; i++) {
      await checkEmailRate(email)
      await requestMagicLink(email, null)
    }
    await expect(checkEmailRate(email)).rejects.toMatchObject({
      code: 'AUTH_RATE_LIMITED',
      status: 429,
    })
  })

  it('refuses an IP over its window and skips requests without a trusted IP', () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 200)}`
    const t0 = Date.now()
    for (let i = 0; i < MAX_REQUESTS_PER_IP; i++) checkIpRate(ip, t0)
    expect(() => checkIpRate(ip, t0)).toThrow()
    expect(() => checkIpRate(ip, t0 + 16 * 60 * 1000)).not.toThrow()
    for (let i = 0; i < MAX_REQUESTS_PER_IP + 5; i++) checkIpRate(null, t0)
  })
})
