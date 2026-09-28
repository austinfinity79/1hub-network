import { afterAll, describe, expect, it } from 'vitest'

import { closePool, query } from '@/lib/db/client'

import { MAX_LINKS_PER_EMAIL, MAX_REQUESTS_PER_IP, checkEmailRate, checkIpRate } from './rate-limit'
import { requestMagicLink } from './magic-link'

/** Rate limits of the sign-in request (DEC-AUTH-EMAIL-D2); they now guard open sign-up. */
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const created: string[] = []

afterAll(async () => {
  await query('DELETE FROM auth_magic_link_requests WHERE email_normalized = ANY($1::text[])', [
    created,
  ])
  await query('DELETE FROM user_accounts WHERE email_normalized = ANY($1::text[])', [created])
  await closePool()
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
