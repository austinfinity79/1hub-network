import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from './config'

/**
 * S1-UAT-01 — username normalisation and format, shared by server and browser
 * (Sprint1 UAT pack Appendix B "Tên tài khoản"). Mirrors email.ts: no imports,
 * so it ships to the browser as the register form shares the exact server rule.
 *
 * Format: 4-30 chars, unaccented letters, digits and dot. Case-insensitive
 * uniqueness: `username` keeps what the user typed, `username_normalized`
 * (lowercase) is what every lookup and the UNIQUE index use.
 */
const USERNAME_PATTERN = /^[a-z0-9.]+$/i

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase()
}

/** True when `username` (as typed, before normalising) has the allowed shape. */
export function isValidUsernameFormat(username: string): boolean {
  const value = username.trim()
  if (value.length < USERNAME_MIN_LENGTH || value.length > USERNAME_MAX_LENGTH) return false
  return USERNAME_PATTERN.test(value)
}

/**
 * Derives a starting username for a Google sign-up from the Google e-mail's
 * local part (US-01.05: "Tên tài khoản cho người đăng ký bằng Google: tự sinh
 * từ email, đổi được trong Cài đặt"). Strips everything outside the allowed
 * alphabet, pads a too-short result, and truncates a too-long one; the caller
 * (google.ts) appends a numeric suffix if the result collides.
 */
export function usernameSeedFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const cleaned = local
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .replace(/^\.+|\.+$/g, '')
  const padded =
    cleaned.length >= USERNAME_MIN_LENGTH ? cleaned : `${cleaned}user`.slice(0, USERNAME_MIN_LENGTH)
  return padded.slice(0, USERNAME_MAX_LENGTH)
}
