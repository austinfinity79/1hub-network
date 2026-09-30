import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { Library } from '@/components/library/library'
import { SESSION_COOKIE_NAME, landingEntry } from '@/lib/landing/entry'
import { LIBRARY_PROBLEMS } from '@/lib/library/problem-source'
import { libraryQuery } from '@/lib/library/query'
import { loadStartupDirectory } from '@/lib/library/startup-source'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) — `/library`, the public "Thư viện HUB
 * Network" (DEC-L15-D1). Public for every visitor (no guard). It reads the
 * visitor's own entry point for the login button, the problem dataset shipped
 * with the app and the public startup directory (startup.json, cached,
 * DEC-L15-D7); a source failure renders an error state in the Startup / Nhà
 * sáng lập tabs, never a 5xx. `?q=` (the homepage search) opens the page with
 * that keyword applied by the page's own search.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thư viện HUB Network — Bài toán, Startup, Nhà sáng lập',
  description:
    'Thư viện HUB Network: bài toán đang mở, những đội đang giải và những người đứng sau.',
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const [entry, directory, params] = await Promise.all([
    landingEntry(token),
    loadStartupDirectory(),
    searchParams,
  ])
  return (
    <Library
      entry={entry}
      problems={LIBRARY_PROBLEMS}
      directory={directory}
      query={libraryQuery(params.q)}
    />
  )
}
