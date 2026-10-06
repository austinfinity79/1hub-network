import type { Metadata } from 'next'

import { Directory, type DirectoryInitial } from '@/components/products/directory'
import { PublicHeader } from '@/components/public-shell/public-header'
import {
  STAGE_ORDER,
  STAGE_SHORT,
  listDirectoryPlaces,
  listDirectoryStartups,
} from '@/lib/public/directory-data'
import { publicShellData } from '@/lib/public/shell-data'
import type { StartupStage } from '@/lib/library/startup-adapter'

import styles from '@/components/products/directory.module.css'

/**
 * DEMO-DIR2-01 — `/products`, the Product / Startup directory (DM08).
 *
 * Public for every visitor (no guard): it lists the canonical published
 * startups only (DEC-W6P-D02 predicate) and the catalogue places for the
 * filter. Query parameters seed the filters (`q`, `linh-vuc`, `giai-doan`,
 * `tinh`); anything unknown is ignored.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sản phẩm — HUB Network',
  description: 'Sản phẩm và startup trong mạng lưới HUB Network.',
}

const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : [])

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, shell, startups, places] = await Promise.all([
    searchParams,
    publicShellData(),
    listDirectoryStartups(),
    listDirectoryPlaces(),
  ])
  const initial: DirectoryInitial = {
    q: (many(params.q)[0] ?? '').trim().slice(0, 120),
    domains: many(params['linh-vuc']).filter((d) => startups.some((s) => s.domains.includes(d))),
    stages: many(params['giai-doan']).filter((s): s is StartupStage =>
      (STAGE_ORDER as string[]).includes(s),
    ),
    province: places.provinces.some((p) => p.label === many(params.tinh)[0])
      ? many(params.tinh)[0]!
      : null,
  }
  return (
    <div
      className={styles.page}
      data-screen="DEMO-PRODUCTS"
      data-revision="DM08"
      data-entry={shell.viewer.kind}
    >
      <div className={styles.top}>
        <PublicHeader viewer={shell.viewer} current="products" />
        <Directory
          startups={startups}
          provinces={places.provinces}
          countries={places.countries}
          stageShort={STAGE_SHORT}
          stageOrder={STAGE_ORDER}
          guest={shell.viewer.kind === 'GUEST'}
          initial={initial}
        />
      </div>
    </div>
  )
}
