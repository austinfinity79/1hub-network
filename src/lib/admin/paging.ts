import { ApiError } from '@/lib/api/errors'

import { isUuid } from './hierarchy'
import { isCursorTime } from './venture-review'

/**
 * Strict list parameters for the Admin queues: refused (422) rather than
 * silently clamped or ignored; keyset cursors on (time, id) so decisions
 * between pages never make the next page skip an item.
 */

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Validation failed.', { [field]: reason })

export function checkParams(params: URLSearchParams, allowed: readonly string[]): void {
  for (const key of new Set(params.keys())) {
    if (!allowed.includes(key)) throw invalid(key, 'not_accepted')
    if (params.getAll(key).length > 1) throw invalid(key, 'duplicate')
  }
}

export function parseLimit(params: URLSearchParams, fallback = 20, max = 50): number {
  const raw = params.get('limit')
  if (raw === null) return fallback
  const limit = Number(raw)
  if (!/^\d{1,3}$/.test(raw) || limit < 1 || limit > max) throw invalid('limit', 'invalid')
  return limit
}

export type Keyset = { t: string; i: string }

export function encodeKeyset(cursor: Keyset): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

export function decodeKeyset(raw: string | null): Keyset | null {
  if (raw === null) return null
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Keyset>
    if (isCursorTime(value.t) && isUuid(value.i)) return { t: value.t, i: value.i }
  } catch {
    // refused below
  }
  throw invalid('cursor', 'invalid')
}

/** SQL fragment rendering a timestamptz column as a keyset cursor time. */
export const cursorTime = (column: string) =>
  `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

const DATE = /^\d{4}-\d{2}-\d{2}$/

/** A calendar day `YYYY-MM-DD` (a real date), or null when absent. */
export function parseDay(params: URLSearchParams, field: string): string | null {
  const raw = params.get(field)
  if (raw === null) return null
  const parsed = new Date(`${raw}T00:00:00Z`)
  if (
    !DATE.test(raw) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== raw
  )
    throw invalid(field, 'invalid')
  return raw
}
