import { SESSION_COOKIE_NAME, SESSION_COOKIE_SAMESITE, sessionCookieSecure } from './config'

/**
 * M0-T08 — session cookie semantics, 03_AUTH_RBAC:200.
 *
 * HttpOnly is the point: the token must be unreachable from page JavaScript, so
 * an XSS foothold cannot exfiltrate it. Nothing here is ever readable by the
 * client, and no role or scope is carried in the cookie.
 */
export type CookieDirective = {
  name: string
  value: string
  options: {
    httpOnly: true
    secure: boolean
    sameSite: 'lax' | 'strict'
    path: string
    maxAge: number
  }
}

export function sessionSetCookie(token: string, maxAgeSeconds: number): CookieDirective {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      secure: sessionCookieSecure(),
      sameSite: SESSION_COOKIE_SAMESITE,
      path: '/',
      maxAge: maxAgeSeconds,
    },
  }
}

/** maxAge 0 expires it immediately; the value is blanked as well. */
export function sessionClearCookie(): CookieDirective {
  return {
    name: SESSION_COOKIE_NAME,
    value: '',
    options: {
      httpOnly: true,
      secure: sessionCookieSecure(),
      sameSite: SESSION_COOKIE_SAMESITE,
      path: '/',
      maxAge: 0,
    },
  }
}

/** Reads the session token from a raw Cookie header without trusting anything else. */
export function readSessionToken(headers: Headers): string | undefined {
  const cookie = headers.get('cookie')
  if (!cookie) return undefined

  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === SESSION_COOKIE_NAME) {
      const value = rest.join('=')
      return value.length > 0 ? decodeURIComponent(value) : undefined
    }
  }

  return undefined
}
