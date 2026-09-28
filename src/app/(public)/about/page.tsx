import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { About } from '@/components/about/about'
import { SESSION_COOKIE_NAME, landingEntry, legalLinks, publicHubSlug } from '@/lib/landing/entry'

/**
 * TASK 22-PREVIEW-ABOUT — `/about`, the public "Về HUB Network" page.
 *
 * Public for every visitor (no guard). It reads only what the homepage reads:
 * the visitor's own entry point for "Tham gia HUB Network", the published
 * HUB's slug and the current legal links. No member, count or private data.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Về HUB Network — Mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số',
  description:
    'HUB Network — tổ chức cộng đồng phi lợi nhuận quy tụ người Việt trẻ trên toàn cầu chung niềm đam mê khởi nghiệp, đổi mới sáng tạo.',
}

export default async function AboutPage() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const [entry, hubSlug, legal] = await Promise.all([
    landingEntry(token),
    publicHubSlug(),
    legalLinks(),
  ])
  return <About entry={entry} hubSlug={hubSlug} legal={legal} />
}
