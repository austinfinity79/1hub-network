import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'

import { DiscoveryError } from '@/components/discovery/discovery-states'
import { TalentDirectory } from '@/components/discovery/talent-directory'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import { libraryViewer } from '@/lib/library/library-api'
import { loadPlaces } from '@/lib/public/discovery-places'
import type { SearchParams } from '@/lib/public/discovery-query'
import { readTalentView } from '@/lib/public/discovery-views'
import { publicShellData } from '@/lib/public/shell-data'
import { listTalents } from '@/lib/public/talent-directory'

import styles from '@/components/discovery/discovery.module.css'

/**
 * THAO-05 DIR3 — `/talents` (DM09, DEC-THAO-DIR-D3). Publicly reachable; the
 * viewer decides everything on the server:
 * - a guest gets the sign-in gate only: no person is read, so no name,
 *   avatar, card or count can reach the page (DEC-WF02-H3 kept);
 * - a signed-in ACTIVE account gets the NETWORK_ONLY discovery cards.
 * The answer is per viewer and never shared-cached.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Nhân tài — HUB Network',
  description: 'Nhân tài trong mạng lưới HUB Network, dành cho thành viên đã đăng nhập.',
}

export default async function TalentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [params, shell, viewer] = await Promise.all([
    searchParams,
    publicShellData(),
    headers().then(libraryViewer),
  ])
  const data =
    viewer === 'NETWORK'
      ? await Promise.all([listTalents(viewer), loadPlaces()]).catch(() => null)
      : null
  return (
    <div
      className={styles.page}
      data-screen="PUBLIC-TALENTS"
      data-revision="DM09"
      data-viewer={viewer}
    >
      <div className={styles.top}>
        <PublicHeader viewer={shell.viewer} current="talents" />
        {viewer !== 'NETWORK' ? (
          <>
            <section className={`${styles.hero} ${styles.heroPlain}`} data-section="directory-hero">
              <p className={styles.eyebrow}>NHÂN TÀI</p>
              <h1 className={styles.title}>Nhân tài trong mạng lưới</h1>
            </section>
            <div className={styles.body} data-section="talent-gate">
              <div />
              <div className={styles.gate} data-state="gate">
                <h2>Dành cho thành viên HUB Network</h2>
                <p>
                  Hồ sơ nhân tài chỉ hiển thị trong mạng lưới, cho thành viên đã đăng nhập, theo lựa
                  chọn hiển thị của từng người.
                </p>
                <Link href={shell.viewer.entry} className={styles.view} data-cta="talent-sign-in">
                  Đăng nhập để xem
                </Link>
              </div>
            </div>
          </>
        ) : data && data[0] ? (
          <TalentDirectory
            talents={data[0]}
            places={data[1]}
            initial={readTalentView(params, {
              domains: [...new Set(data[0].flatMap((t) => t.domains))],
              places: data[1],
            })}
          />
        ) : (
          <div className={styles.body}>
            <div />
            <DiscoveryError noun="nhân tài" retryHref="/talents" />
          </div>
        )}
      </div>
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
