import type { Metadata } from 'next'
import { headers } from 'next/headers'

import { DiscoveryError } from '@/components/discovery/discovery-states'
import { ProgrammeDirectory } from '@/components/discovery/programme-directory'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import { libraryViewer } from '@/lib/library/library-api'
import type { SearchParams } from '@/lib/public/discovery-query'
import { readProgrammeView } from '@/lib/public/discovery-views'
import { listPublicProgrammes } from '@/lib/public/programme-directory'
import { publicShellData } from '@/lib/public/shell-data'

import styles from '@/components/discovery/discovery.module.css'

/**
 * THAO-05 DIR0 — `/programmes`, the public programme list (DM06,
 * DEC-THAO-DIR-D1). Public for every visitor; the server projects PUBLISHED
 * and CLOSED programmes only. The viewer decides one thing: whether a card
 * may offer the existing member apply entry. Query parameters seed the view;
 * unknown values are ignored. A failed read renders the error state.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Chương trình, cuộc thi — HUB Network',
  description: 'Chương trình và cuộc thi đổi mới sáng tạo trong mạng lưới HUB Network.',
}

export default async function ProgrammesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [params, shell, viewer] = await Promise.all([
    searchParams,
    publicShellData(),
    headers().then(libraryViewer),
  ])
  const programmes = await listPublicProgrammes(viewer).catch(() => null)
  return (
    <div className={styles.page} data-screen="PUBLIC-PROGRAMMES" data-revision="DM06">
      <div className={styles.top}>
        <PublicHeader viewer={shell.viewer} current="programmes" />
        {programmes ? (
          <ProgrammeDirectory
            programmes={programmes}
            initial={readProgrammeView(
              params,
              programmes.flatMap((p) => (p.host ? [p.host.slug] : [])),
            )}
          />
        ) : (
          <div className={styles.body}>
            <div />
            <DiscoveryError noun="chương trình" retryHref="/programmes" />
          </div>
        )}
      </div>
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
