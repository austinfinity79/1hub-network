import type { ListEnvelope, ListQuery } from './types'

/**
 * M0-T05 — success envelopes, 05:65-79.
 *
 * Single-resource endpoints return the resource directly, so there is no
 * wrapper helper for them on purpose: adding one would invent an envelope the
 * contract does not define.
 */

/** Contract example uses 50; 04:266 allows cursor paging on large lists. */
export const DEFAULT_PAGE_LIMIT = 50
export const MAX_PAGE_LIMIT = 200

export function listEnvelope<T>(
  items: T[],
  page: { nextCursor?: string | null; limit?: number } = {},
): ListEnvelope<T> {
  return {
    items,
    page: {
      next_cursor: page.nextCursor ?? null,
      limit: page.limit ?? DEFAULT_PAGE_LIMIT,
    },
  }
}

/**
 * Parses `?cursor=&limit=` defensively. An unusable limit falls back to the
 * default rather than erroring, because the contract defines no error code for
 * a malformed pagination parameter.
 */
export function parseListQuery(
  params: URLSearchParams,
): Required<Pick<ListQuery, 'limit'>> & ListQuery {
  const cursor = params.get('cursor')?.trim() || undefined
  const rawLimit = Number(params.get('limit'))

  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT

  return { cursor, limit }
}
