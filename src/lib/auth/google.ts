import { createHash, timingSafeEqual } from 'node:crypto'

import { trackEvent } from '@/lib/analytics/analytics'
import { ApiError } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import type { Executor } from '@/lib/db/client'
import { withTransaction } from '@/lib/db/client'

import { normalizeEmail } from './email'
import { completeSignIn, type SignInResponse } from './sign-in'
import { generateToken } from './tokens'
import { isValidUsernameFormat, usernameSeedFromEmail } from './username'

/**
 * S1-UAT-01 — Google sign-in / sign-up and account linking (Sprint1 UAT pack
 * US-01.05; Appendix B "Google + mật khẩu cùng email: Một tài khoản").
 *
 * OAuth 2.0 authorization-code flow with PKCE, over HTTPS with no SDK (the
 * same choice DEC-AUTH-EMAIL-D3 made for Resend). The client secret and the
 * code exchange stay on the server; the browser only carries Google's `code`
 * and `state` from the redirect back to POST /auth/google/callback.
 *
 * Replay / CSRF: `state` and the PKCE verifier live in a short-lived HttpOnly
 * cookie set when the flow starts; the callback compares state in constant
 * time and the route clears the cookie on every outcome, so a callback can be
 * completed at most once per started flow, and only by the browser that
 * started it. Google's code is itself single-use.
 *
 * Identity is Google's stable `sub`, never the e-mail. The e-mail only decides,
 * on the FIRST Google sign-in, which existing account to link (US-01.05) — and
 * only when Google says it is verified.
 */

export const GOOGLE_STATE_COOKIE = '1hub_google_oauth'
export const GOOGLE_STATE_MAX_AGE_SECONDS = 600

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'
const TIMEOUT_MS = 10_000

export type GoogleConfig = { clientId: string; clientSecret: string }

/** Server-only env; never NEXT_PUBLIC_*. Null = Google is not offered (providers = []). */
export function googleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** Google redirects the browser back to the existing WF01-S03 page. */
export function googleRedirectUri(base: string): string {
  return `${base}/auth/callback`
}

const challengeOf = (verifier: string) => createHash('sha256').update(verifier).digest('base64url')

/** Starts a flow: the authorize URL plus the cookie value that binds it to this browser. */
export function startGoogleFlow(
  config: GoogleConfig,
  base: string,
): { url: string; cookieValue: string } {
  const state = generateToken()
  const verifier = generateToken()
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: googleRedirectUri(base),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challengeOf(verifier),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  })
  return { url: `${AUTHORIZE_URL}?${params.toString()}`, cookieValue: `${state}.${verifier}` }
}

const STATE_MISMATCH = () =>
  new ApiError('AUTH_GOOGLE_STATE_MISMATCH', 400, 'The Google sign-in could not be verified.')
const FAILED = () => new ApiError('AUTH_GOOGLE_FAILED', 400, 'Google sign-in could not complete.')

/** Returns the PKCE verifier when `state` matches the cookie this browser holds. */
export function verifyGoogleState(cookieValue: string | undefined, state: unknown): string {
  const [expected, verifier] = (cookieValue ?? '').split('.')
  if (!expected || !verifier || typeof state !== 'string' || state.length === 0) {
    throw STATE_MISMATCH()
  }
  const a = Buffer.from(expected)
  const b = Buffer.from(state)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw STATE_MISMATCH()
  return verifier
}

export type GoogleProfile = {
  sub: string
  email: string
  emailVerified: boolean
  name: string | null
}

/** Exchanges the code and reads the OpenID userinfo. Any provider failure is AUTH_GOOGLE_FAILED. */
export async function fetchGoogleProfile(
  config: GoogleConfig,
  base: string,
  code: unknown,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleProfile> {
  if (typeof code !== 'string' || code.length === 0 || code.length > 2048) throw FAILED()
  try {
    const tokenResponse = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: googleRedirectUri(base),
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const tokens = (await tokenResponse.json().catch(() => null)) as {
      access_token?: unknown
    } | null
    if (!tokenResponse.ok || typeof tokens?.access_token !== 'string') throw FAILED()

    const infoResponse = await fetchImpl(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const info = (await infoResponse.json().catch(() => null)) as Record<string, unknown> | null
    if (
      !infoResponse.ok ||
      !info ||
      typeof info.sub !== 'string' ||
      typeof info.email !== 'string'
    ) {
      throw FAILED()
    }
    return {
      sub: info.sub,
      email: info.email,
      emailVerified: info.email_verified === true,
      name:
        typeof info.name === 'string' && info.name.trim() ? info.name.trim().slice(0, 200) : null,
    }
  } catch (error) {
    if (error instanceof ApiError) throw error
    // Network / timeout. Nothing from the provider (codes, tokens) is logged.
    console.error('google sign-in provider error', (error as Error).name)
    throw FAILED()
  }
}

/** A free username derived from the e-mail, with a numeric suffix on collision. */
async function freeUsername(exec: Executor, email: string): Promise<string> {
  const seed = usernameSeedFromEmail(email)
  for (let n = 0; n < 50; n++) {
    const suffix = n === 0 ? '' : String(n)
    const candidate = `${seed.slice(0, 30 - suffix.length)}${suffix}`
    if (!isValidUsernameFormat(candidate)) continue
    const [taken] = await exec(`SELECT 1 FROM user_accounts WHERE username_normalized = $1`, [
      candidate.toLowerCase(),
    ])
    if (!taken) return candidate
  }
  // Practically unreachable; a random tail still satisfies the format.
  return `${seed.slice(0, 18)}.${generateToken()
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 10)
    .toLowerCase()}`
}

type Resolved = { id: string; status: string; created: boolean }

/**
 * Finds the account for a verified Google identity, linking or creating it.
 * 1. Linked before (provider_subject)            → that account.
 * 2. An account owns the verified e-mail          → link it: the SAME account.
 * 3. Neither                                      → new account, username generated.
 * Account status is checked BEFORE anything is linked, so a BLOCKED or
 * DEACTIVATED account is never touched and never signs in (task section 9).
 */
export async function resolveGoogleAccount(
  profile: GoogleProfile,
  requestId: string,
): Promise<Resolved> {
  if (!profile.emailVerified) throw FAILED()
  const email = normalizeEmail(profile.email)

  return withTransaction(async (exec) => {
    const [linked] = await exec<{ id: string; status: string }>(
      `SELECT a.id::text, a.status::text FROM auth_identities i
         JOIN user_accounts a ON a.id = i.account_id
        WHERE i.provider = 'GOOGLE' AND i.provider_subject = $1`,
      [profile.sub],
    )
    if (linked) return { ...linked, created: false }

    // Serialises concurrent first sign-ins for one address on the account row.
    const [existing] = await exec<{ id: string; status: string; has_google: boolean }>(
      `SELECT a.id::text, a.status::text,
              EXISTS (SELECT 1 FROM auth_identities i
                       WHERE i.account_id = a.id AND i.provider = 'GOOGLE') AS has_google
         FROM user_accounts a WHERE a.email_normalized = $1 FOR UPDATE`,
      [email],
    )

    if (existing) {
      if (existing.status !== 'ACTIVE')
        return { id: existing.id, status: existing.status, created: false }
      // A different Google identity is already linked to this account: never a second one.
      if (existing.has_google) throw FAILED()
      await linkIdentity(exec, existing.id, profile, email, requestId)
      return { id: existing.id, status: existing.status, created: false }
    }

    const username = await freeUsername(exec, email)
    const [created] = await exec<{ id: string }>(
      `INSERT INTO user_accounts
         (email, email_normalized, status, username, username_normalized, signup_full_name)
       VALUES ($1, $1, 'ACTIVE', $2, $3, $4)
       RETURNING id::text`,
      [email, username, username.toLowerCase(), profile.name],
    )
    await linkIdentity(exec, created!.id, profile, email, requestId)
    await trackEvent(exec, {
      name: 'account_created',
      accountId: created!.id,
      profileId: null,
      workflow: 'WF01',
      screenId: 'WF01-S03',
    })
    return { id: created!.id, status: 'ACTIVE', created: true }
  })
}

async function linkIdentity(
  exec: Executor,
  accountId: string,
  profile: GoogleProfile,
  email: string,
  requestId: string,
): Promise<void> {
  await exec(
    `INSERT INTO auth_identities (account_id, provider, provider_subject, email_at_link)
     VALUES ($1, 'GOOGLE', $2, $3)`,
    [accountId, profile.sub, email],
  )
  await writeAudit(exec, {
    actorAccountId: accountId,
    action: 'AUTH_GOOGLE_IDENTITY_LINKED',
    resourceType: 'user_account',
    resourceId: accountId,
    after: { provider: 'GOOGLE' },
    requestId,
  })
}

/** Callback end to end: verified profile → account → status gate → fresh session. */
export async function signInWithGoogle(
  profile: GoogleProfile,
  requestId: string,
): Promise<{ response: SignInResponse; sessionToken: string }> {
  // Two first sign-ins racing for one new address: the loser hits a UNIQUE
  // index, and its retry finds the winner's account (one account per e-mail).
  const account = await resolveGoogleAccount(profile, requestId).catch((error: unknown) => {
    if ((error as { code?: string }).code === '23505')
      return resolveGoogleAccount(profile, requestId)
    throw error
  })
  // ADMIN-PROD-05 (PD-7): Google never bypasses BLOCKED / DEACTIVATED. The
  // password lockout is deliberately NOT consulted (US-01.03: Google still works).
  if (account.status !== 'ACTIVE') {
    throw new ApiError('AUTH_ACCOUNT_BLOCKED', 403, 'This account cannot sign in.')
  }
  const { response, sessionToken } = await completeSignIn(account.id, account.created)
  return { response, sessionToken }
}
