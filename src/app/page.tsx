import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { Home } from '@/components/home/home'
import type { HomeTalent } from '@/components/home/home-talents'
import { libraryViewer } from '@/lib/library/library-api'
import { listHomeStartups } from '@/lib/public/home-data'
import { publicShellData } from '@/lib/public/shell-data'
import { listTalents } from '@/lib/public/talent-directory'

/**
 * DEMO-HOME-ABOUT-01 — `/`, Homepage v2 (DM01) for every visitor
 * (DEC-P0-LANDING-D1 / DEC-H1-D1: public, no redirect; the entry CTA is the
 * visitor's own entry point). It reads the visitor's entry, the current legal
 * links and the canonical published startups. No member, count or private
 * data beyond that.
 *
 * S2-HOME-TALENT-SECTION-01: the "Nhân tài" section reads the canonical talent
 * directory (listTalents, NETWORK_ONLY) for a signed-in NETWORK viewer only;
 * a guest's page never reads or carries a person. Order as /talents: the
 * pinned talent first, then by name.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'HUB Network — Chương trình, sản phẩm và nhân tài đổi mới sáng tạo',
  description:
    'HUB Network — mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số: chương trình, sản phẩm và nhân tài của cộng đồng.',
}

async function homeTalents(): Promise<HomeTalent[] | null> {
  const viewer = await headers().then(libraryViewer)
  if (viewer !== 'NETWORK') return null
  const cards = (await listTalents(viewer).catch(() => [])) ?? []
  return [...cards]
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.name.localeCompare(b.name, 'vi'))
    .map((c) => ({
      key: c.key,
      name: c.name,
      initials: c.initials,
      avatarUrl: c.avatarUrl,
      headline: c.headline,
      region: c.region,
      domains: c.domains,
      href: c.href,
    }))
}

export default async function RootPage() {
  const [shell, startups, talents] = await Promise.all([
    publicShellData(),
    listHomeStartups(),
    homeTalents(),
  ])
  return <Home shell={shell} startups={startups} talents={talents} />
}
