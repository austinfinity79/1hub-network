import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { Library } from '@/components/library/library'
import { SESSION_COOKIE_NAME, landingEntry } from '@/lib/landing/entry'

/**
 * TASK 22-PREVIEW-LIBRARY — `/library`, the public "Thư viện HUB Network"
 * (DEC-L15-D1). Public for every visitor (no guard). It reads only the
 * visitor's own entry point for the login button; the directory is a labelled
 * static demo (DEC-L15-D2), so no member, venture or programme data is read.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thư viện HUB Network — Bài toán, Startup, Nhà sáng lập',
  description:
    'Thư viện HUB Network: bài toán đang mở, những đội đang giải và những người đứng sau (bản xem trước, dữ liệu minh hoạ).',
}

export default async function LibraryPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const entry = await landingEntry(token)
  return <Library entry={entry} />
}
