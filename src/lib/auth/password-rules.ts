import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './config'

/**
 * S1-UAT-01 — browser-safe password rule and strength meter (US-01.02). The
 * RULE is the server's (password.ts re-exports isValidPasswordFormat from
 * here), so the form never accepts what the server refuses. The METER is
 * guidance only: it never blocks beyond the rule.
 */
export function isValidPasswordFormat(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return false
  return /[A-Za-z]/.test(password) && /[0-9]/.test(password)
}

export type PasswordStrength = { level: 1 | 2 | 3 | 4; label: string }

export function passwordStrength(password: string): PasswordStrength {
  if (!isValidPasswordFormat(password)) return { level: 1, label: 'Yếu' }
  let score = 2
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) score++
  const level = Math.min(score, 4) as 2 | 3 | 4
  return { level, label: level === 2 ? 'Trung bình' : level === 3 ? 'Khá' : 'Mạnh' }
}
