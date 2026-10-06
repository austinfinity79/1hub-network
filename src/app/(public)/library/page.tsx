import type { Metadata } from 'next'
import { cookies, headers } from 'next/headers'

import { Library } from '@/components/library/library'
import { SESSION_COOKIE_NAME, landingEntry } from '@/lib/landing/entry'
import { libraryViewer } from '@/lib/library/library-api'
import { libraryInitial } from '@/lib/library/library-bodies'
import { libraryQuery } from '@/lib/library/query'
import { publicShellData } from '@/lib/public/shell-data'

/**
 * TASK 22-PREVIEW-LIBRARY(-FIX) / WF06-PROD-04 — `/library`, the public
 * "Thư viện HUB Network" (DEC-L15-D1). Public for every visitor (no guard). It
 * reads the visitor's own entry point for the login button and the first page
 * of each tab exactly as the Library APIs answer it (API §25), for this viewer:
 * a member sees visible founders, a guest the sign-in state. A tab that cannot
 * be read renders its error state, never a 5xx. `?q=` (the homepage search)
 * opens the page with that keyword applied.
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
  const [entry, shell, viewer, params] = await Promise.all([
    landingEntry(token),
    publicShellData(),
    libraryViewer(await headers()),
    searchParams,
  ])
  const initial = await libraryInitial(viewer, libraryQuery(params.q))
  return <Library entry={entry} shell={shell} initial={initial} />
}
