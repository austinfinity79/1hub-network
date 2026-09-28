import { ApiError } from '@/lib/api/errors'
import { query } from '@/lib/db/client'

/**
 * TASK 22-PREVIEW-AUTH — server-side limit on magic-link sends
 * (DEC-AUTH-EMAIL-D2; API 05: "rate-limit by email + IP").
 *
 * Per address: links issued in the last 15 minutes, counted from
 * `auth_magic_link_requests` (no new table). Per IP: every request, allowed or
 * not, in process memory — enough for the single review container; it resets on
 * restart. Requests without a client IP skip the IP limit; the route applies
 * both limits on servers only (dev routes off).
 */

const WINDOW_MS = 15 * 60 * 1000
export const MAX_LINKS_PER_EMAIL = 10
export const MAX_REQUESTS_PER_IP = 30

declare global {
  var __hubMagicLinkIpHits: Map<string, number[]> | undefined
}

const ipHits = (): Map<string, number[]> => (globalThis.__hubMagicLinkIpHits ??= new Map())

const limited = () =>
  new ApiError('AUTH_RATE_LIMITED', 429, 'Too many sign-in links requested. Try again later.')

/** Counts this request against the IP; throws AUTH_RATE_LIMITED over the limit. */
export function checkIpRate(ip: string | null, now = Date.now()): void {
  if (!ip) return
  const hits = (ipHits().get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (hits.length >= MAX_REQUESTS_PER_IP) {
    ipHits().set(ip, hits)
    throw limited()
  }
  hits.push(now)
  ipHits().set(ip, hits)
}

/** Throws AUTH_RATE_LIMITED when the address already had the maximum links in the window. */
export async function checkEmailRate(emailNormalized: string): Promise<void> {
  const [row] = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM auth_magic_link_requests
      WHERE email_normalized = $1 AND created_at > now() - interval '15 minutes'`,
    [emailNormalized],
  )
  if ((row?.n ?? 0) >= MAX_LINKS_PER_EMAIL) throw limited()
}
