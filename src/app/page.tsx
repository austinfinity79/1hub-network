import type { Metadata } from 'next'

import { Home } from '@/components/home/home'
import { listHomeStartups } from '@/lib/public/home-data'
import { publicShellData } from '@/lib/public/shell-data'

/**
 * DEMO-HOME-ABOUT-01 — `/`, Homepage v2 (DM01) for every visitor
 * (DEC-P0-LANDING-D1 / DEC-H1-D1: public, no redirect; the entry CTA is the
 * visitor's own entry point). It reads the visitor's entry, the current legal
 * links and the canonical published startups. No member, count or private
 * data beyond that.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HUB Network — Chương trình, sản phẩm và nhân tài đổi mới sáng tạo',
  description:
    'HUB Network — mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số: chương trình, sản phẩm và nhân tài của cộng đồng.',
}

export default async function RootPage() {
  const [shell, startups] = await Promise.all([publicShellData(), listHomeStartups()])
  return <Home shell={shell} startups={startups} />
}
