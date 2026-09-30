/**
 * Return to the intended action after sign-in (BD-02 return-to rule,
 * DEC-2809-D1 / homepage-cta-map), browser side. PO decision, Alpha
 * interaction gap fix 30/09: a guest who starts from "Tạo hồ sơ startup của
 * bạn" signs in and comes back to the venture creation.
 *
 * - `/auth?redirect=<path>` names the path. Only a same-origin relative path
 *   is accepted (starts with `/`, not `//`, no scheme, no backslash), never an
 *   auth or API path; anything else is ignored and the usual destination holds.
 * - The accepted path is kept in localStorage when the link is requested, so
 *   the e-mailed link opened in another tab of the same browser finds it. It is
 *   read once, by the callback, and dropped after an hour.
 * - Onboarding still comes first: an unfinished account carries the path in
 *   this tab's sessionStorage, and the onboarding exit (ACC-10) offers it
 *   instead of the account home.
 *
 * The path is only ever a navigation target: it grants nothing, every page
 * re-checks the session server-side. It is not stored with the magic-link
 * request, so a link opened in another browser or device lands on the usual
 * destination.
 */

export const RETURN_PATH_PARAM = 'redirect'
export const RETURN_PATH_STORAGE_KEY = '1hub.auth.return-path'
export const RETURN_PATH_MAX_AGE_MS = 60 * 60 * 1000

const BASE = 'https://return.invalid'

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The path when it is a safe same-origin relative path, otherwise null. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null
  if (!value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value)) return null
  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }
  if (url.origin !== BASE) return null
  const { pathname } = url
  if (pathname === '/auth' || pathname.startsWith('/auth/') || pathname.startsWith('/api/')) {
    return null
  }
  return `${pathname}${url.search}${url.hash}`
}

/** The sign-in entry that returns to `path` afterwards. */
export function authWithReturn(path: string): string {
  return `/auth?${RETURN_PATH_PARAM}=${encodeURIComponent(path)}`
}

/** Keeps `path` (or forgets any earlier one when null). Storage failures are ignored. */
export function rememberReturnPath(
  storage: StorageLike,
  path: string | null,
  now: number = Date.now(),
): void {
  try {
    if (path) storage.setItem(RETURN_PATH_STORAGE_KEY, JSON.stringify({ path, at: now }))
    else storage.removeItem(RETURN_PATH_STORAGE_KEY)
  } catch {
    // No storage (private mode, quota): the usual destination holds.
  }
}

/** The kept path when it is still fresh and safe, without removing it. */
export function readReturnPath(storage: StorageLike, now: number = Date.now()): string | null {
  try {
    const raw = storage.getItem(RETURN_PATH_STORAGE_KEY)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return null
    const { path, at } = value as { path?: unknown; at?: unknown }
    if (typeof path !== 'string' || typeof at !== 'number') return null
    if (at > now || now - at > RETURN_PATH_MAX_AGE_MS) return null
    return safeReturnPath(path)
  } catch {
    return null
  }
}

/** Reads the kept path once: it is removed whatever it holds. */
export function takeReturnPath(storage: StorageLike, now: number = Date.now()): string | null {
  const path = readReturnPath(storage, now)
  rememberReturnPath(storage, null)
  return path
}
