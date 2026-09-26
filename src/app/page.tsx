import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { Landing } from '@/components/landing/landing'
import { SESSION_COOKIE_NAME, landingEntry, legalLinks, publicHubSlug } from '@/lib/landing/entry'

/**
 * P0-LANDING — `/` is the public homepage (DEC-P0-LANDING-D1, superseding the
 * M0-ENTRY-01 redirect for `/` only). Guests and signed-in accounts both see
 * it; the primary call to action is the visitor's real entry point (/auth, or
 * the canonical onboarding resolver's route). Protected routes keep their own
 * guards and the resolver unchanged.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '1hub.network — hạ tầng dữ liệu và vận hành chung cho hệ sinh thái',
  description:
    'Một hồ sơ gốc cho mỗi người, mỗi dự án và mỗi tổ chức, được làm giàu qua hoạt động trong cộng đồng, chương trình và sự kiện.',
}

export default async function RootPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const [entry, hubSlug, legal] = await Promise.all([
    landingEntry(token),
    publicHubSlug(),
    legalLinks(),
  ])
  return <Landing entry={entry} hubSlug={hubSlug} legal={legal} />
}
