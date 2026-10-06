import type { Metadata } from 'next'

import { About } from '@/components/about/about'
import { loadAboutNetwork } from '@/lib/public/about-network'
import { publicShellData } from '@/lib/public/shell-data'

/**
 * DEMO-HOME-ABOUT-01 — `/about`, About HUB v2 (DM02–DM05).
 *
 * Public for every visitor (no guard). It reads the visitor's own entry, the
 * current legal links and the published catalogue units (names, slugs, CLB
 * counts). People, milestones and activities are the S1-UAT-08A sources. No
 * member, private or account data.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Về HUB Network — Mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số',
  description:
    'HUB Network — tổ chức cộng đồng phi lợi nhuận quy tụ người Việt trẻ trên toàn cầu chung niềm đam mê khởi nghiệp, đổi mới sáng tạo.',
}

export default async function AboutPage() {
  const [shell, network] = await Promise.all([publicShellData(), loadAboutNetwork()])
  return <About shell={shell} network={network} />
}
