import { isIP } from 'node:net'

/**
 * The client address used for rate limits and `request_ip` columns (`inet`).
 * Only a plain IPv4 / IPv6 literal from the first X-Forwarded-For hop is kept;
 * anything else a proxy may forward ("unknown", "ip:port", an IPv6 zone id) is
 * dropped rather than failing the request. Moved from the magic-link route in
 * S1-UAT-01 so every auth endpoint reads the address the same way.
 */
export function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  return first && isIP(first) !== 0 && !first.includes('%') ? first : null
}
