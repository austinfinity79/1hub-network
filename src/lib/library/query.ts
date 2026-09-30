/**
 * The Library keyword carried in the address (`/library?q=…`), set by the
 * homepage search (PO decision, Alpha interaction gap fix 30/09). It is applied
 * through the page's own search, exactly as if typed there: plain text, the
 * same length cap as the search field, never rendered as HTML.
 */
export const LIBRARY_QUERY_MAX = 120

/** The keyword from a `q` search parameter; empty when absent or blank. */
export function libraryQuery(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value
  return (raw ?? '').trim().slice(0, LIBRARY_QUERY_MAX)
}

/** The Library address for a keyword, or null when there is nothing to search. */
export function libraryHref(keyword: string): string | null {
  const q = keyword.trim().slice(0, LIBRARY_QUERY_MAX)
  return q ? `/library?q=${encodeURIComponent(q)}` : null
}
