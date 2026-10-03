import { authWithReturn } from '@/lib/auth/return-path'

/**
 * WF05-PROD-04 (G23) — a `401` (the session expired or was revoked) goes
 * through sign-in and comes back to this page, instead of a retry loop or a
 * generic error. Nothing is kept in the browser: the page reads the server
 * again after sign-in.
 */
export function signInAgain(): void {
  window.location.assign(authWithReturn(`${window.location.pathname}${window.location.search}`))
}
