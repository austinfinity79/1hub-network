/**
 * M0-T08 — auth/session constants.
 *
 * Values marked FROZEN come from the contract. Values marked UNSTATED are not
 * defined by any frozen source; they are named here with a provisional value
 * rather than chosen silently inside the implementation, the same discipline
 * used for `--unresolved-` design tokens and `UNCONTRACTED_` error codes.
 * `auth.db-test.ts` asserts the manifest stays in sync.
 */

/** FROZEN: 05_API_CONTRACT_P0_v1.0.yaml:314 names the cookie. */
export const SESSION_COOKIE_NAME = '1hub_session'

/** FROZEN: 05:174-176 return these to the client verbatim. */
export const MAGIC_LINK_EXPIRES_IN_SECONDS = 900
export const MAGIC_LINK_RESEND_AFTER_SECONDS = 60

/** FROZEN: 05:23 IDs are opaque strings. The contract's own examples are prefixed. */
export const AUTH_REQUEST_ID_PREFIX = 'authreq_'

export type UnstatedAuthValue = {
  name: string
  provisional: string
  reason: string
  wouldBeSettledBy: string
}

/**
 * Not frozen anywhere. Verified by grep across docs/architecture, docs/product,
 * docs/workflows and CLAUDE.md: zero hits for a session TTL or a SameSite value,
 * and 03_AUTH_RBAC:201 qualifies CSRF as "when applicable" with no mechanism.
 */
export const UNSTATED_AUTH_VALUES: readonly UnstatedAuthValue[] = [
  {
    name: 'SESSION_TTL_SECONDS',
    provisional: '2592000 (30 days)',
    reason:
      'No frozen source states a session lifetime; user_sessions.expires_at exists but no value is given.',
    wouldBeSettledBy: 'A contract amendment to 03_AUTH_RBAC section 9.',
  },
  {
    name: 'SESSION_COOKIE_SAMESITE',
    provisional: 'lax',
    reason:
      '03_AUTH_RBAC:200 requires a SameSite cookie but names no value. lax is the least-surprising choice that survives the magic-link top-level navigation.',
    wouldBeSettledBy: 'A contract amendment naming strict or lax.',
  },
  {
    name: 'CSRF_MECHANISM',
    provisional: 'none implemented',
    reason:
      '03_AUTH_RBAC:201 says "CSRF protection for state-changing browser requests when applicable" with no mechanism, header or token endpoint. Nothing is invented here; SameSite=lax is the only mitigation currently in place.',
    wouldBeSettledBy: 'A contract amendment naming the mechanism.',
  },
]

/** UNSTATED, see manifest. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30

/** UNSTATED, see manifest. */
export const SESSION_COOKIE_SAMESITE = 'lax' as const

/**
 * Secure is environment-appropriate rather than unstated: the contract requires
 * a Secure cookie, and local development runs on plain http, where a Secure
 * cookie would simply never be stored.
 */
export function sessionCookieSecure(): boolean {
  return process.env.NODE_ENV === 'production'
}
