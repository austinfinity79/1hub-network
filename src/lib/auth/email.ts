/**
 * Email normalisation and plausibility, shared by server and browser.
 *
 * Extracted from tokens.ts (M0-T08) in WF01-S01 so the auth entry form applies
 * exactly the rule the magic-link endpoint enforces. tokens.ts imports
 * node:crypto and cannot ship to the browser; this module has no imports.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Accepts only what a real address needs; deliberately strict and simple. */
export function isPlausibleEmail(email: string): boolean {
  const value = normalizeEmail(email)
  if (value.length < 3 || value.length > 254) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}
