import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * M0-T08 — opaque token generation and hashing.
 *
 * RAW TOKENS ARE NEVER PERSISTED AND NEVER LOGGED. Both
 * auth_magic_link_requests and user_sessions store only `token_hash`, so a
 * database disclosure does not yield usable credentials.
 *
 * SHA-256 is correct here and bcrypt/argon2 would not be: these are 256-bit
 * random tokens, not user-chosen passwords, so there is no offline guessing
 * advantage to slow down. The contract requires no password at all (05:181).
 */

/** 256 bits of entropy, URL-safe so it survives a magic-link query string. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/**
 * Constant-time comparison of two token hashes.
 *
 * Lookup is by hash equality in SQL, which is not constant-time, but the value
 * compared there is already a hash of an unguessable 256-bit token, so timing
 * leaks nothing useful. This exists for the places where two hashes are
 * compared in application code.
 */
export function hashesEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8')
  const right = Buffer.from(b, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

/** Masks an address for display, per the contract's `email_masked` field. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***'
  return `${local.slice(0, 1)}***@${domain}`
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Accepts only what a real address needs; deliberately strict and simple. */
export function isPlausibleEmail(email: string): boolean {
  const value = normalizeEmail(email)
  if (value.length < 3 || value.length > 254) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}
