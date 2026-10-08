import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { DiscoveryError } from '@/components/discovery/discovery-states'
import { Directory } from '@/components/products/directory'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import { STAGE_ORDER, STAGE_SHORT, listDirectoryStartups } from '@/lib/public/directory-data'
import { loadPlaces } from '@/lib/public/discovery-places'
import type { SearchParams } from '@/lib/public/discovery-query'
import { readProductView } from '@/lib/public/discovery-views'
import { publicShellData } from '@/lib/public/shell-data'
import { viewerOf } from '@/lib/startup/access'
import { followedSlugs } from '@/lib/startup/follow'

import styles from '@/components/discovery/discovery.module.css'

/**
 * DEMO-DIR2-01 — `/products`, the Product / Startup directory (DM08).
 *
 * Public for every visitor (no guard): it lists the canonical published
 * startups only (DEC-W6P-D02 predicate) and the catalogue places for the
 * filter. Query parameters seed the filters (`q`, `linh-vuc`, `giai-doan`,
 * `quoc-gia`, `tinh`, `sap-xep`; THAO-05, DEC-THAO-DIR-D6); anything unknown is
 * ignored. A failed read renders the error state with a retry, never a 5xx.
 * A card's "Theo dõi" is Follow v1 (DEC-THAO-SP-D4; THAO-M3-QA-01).
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Sản phẩm — HUB Network',
  description: 'Sản phẩm và startup trong mạng lưới HUB Network.',
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [params, shell] = await Promise.all([searchParams, publicShellData()])
  const data = await Promise.all([
    listDirectoryStartups(),
    loadPlaces(),
    viewerOf(await headers()).then(followedSlugs),
  ]).catch(() => null)
  return (
    <div
      className={styles.page}
      data-screen="DEMO-PRODUCTS"
      data-revision="DM08"
      data-entry={shell.viewer.kind}
    >
      <div className={styles.top}>
        <PublicHeader viewer={shell.viewer} clubCount={shell.clubCount} current="products" />
        {data ? (
          <Directory
            startups={data[0]}
            places={data[1]}
            stageShort={STAGE_SHORT}
            stageOrder={STAGE_ORDER}
            guest={shell.viewer.kind === 'GUEST'}
            followed={data[2]}
            initial={readProductView(params, {
              domains: [...new Set(data[0].flatMap((x) => x.domains))],
              stages: STAGE_ORDER,
              places: data[1],
            })}
          />
        ) : (
          <div className={styles.body}>
            <div />
            <DiscoveryError noun="sản phẩm" retryHref="/products" />
          </div>
        )}
      </div>
      {/* THAO-02: the one public footer, as on every public page. */}
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
