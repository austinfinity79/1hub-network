import { ApiError } from '@/lib/api/errors'

/**
 * S1-UAT-01 (task section 13/14) — the password and Google endpoints accept a
 * JSON body only. A cross-site page can POST text/plain or a form without a
 * CORS preflight, but not application/json; refusing anything else stops a
 * login / sign-up CSRF (signing a victim's browser into an attacker's account)
 * on top of the SameSite=Lax cookie, without inventing a token mechanism the
 * contract has not named (config.ts CSRF_MECHANISM).
 */
export function requireJsonBody(request: Request): void {
  const type = request.headers.get('content-type') ?? ''
  if (!/^application\/json(\s*;|$)/i.test(type.trim())) {
    throw new ApiError('AUTH_VALIDATION_FAILED', 400, 'A JSON body is required.', {
      body: 'json_required',
    })
  }
}
