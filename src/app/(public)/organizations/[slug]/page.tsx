import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { isApiError } from '@/lib/api/errors'
import { getPublicOrganization, type PublicOrganizationDTO } from '@/lib/public/organization'

import styles from './public-organization.module.css'
import { HomeLink } from '@/components/shell/home-link'

/**
 * WF03-S09 — /organizations/:slug, the public organization page. Public:
 * guests and signed-in accounts get the same projection (DEC-WF03-S09-D1).
 * Reference (TASK 22.4, L19 CHP0 subset, full bleed):
 * design-reference/final/revision/L3/L19__chapter-public__SOURCE.png
 *
 * Mapped from the approved "Hồ sơ Chapter" page onto canonical data only: the
 * top bar, hero (type · parent, status, name, description, three canonical
 * counts, join call), direct children with their counts, upcoming published
 * standalone events, the join band and the footer. Not rendered (no P0 source
 * or never public): founding date, region line, partner logos, the leadership
 * team (PROFILE_DISCOVERY is never visible to a guest), team / summit numbers,
 * registration chips and capacities, the challenge links, contact email.
 * TASK 22.4 (DEC-L3-D1) keeps that mapping; the corrected L19's KPI strip
 * shows only the three canonical counts, its "Bài toán" nav, summit button,
 * province chips and footer links stay out (HD-08, Bucket B / C). The CLB
 * banners, initials and event tiles are decoration, not data.
 */
export const dynamic = 'force-dynamic'

const TYPE_LABELS: Record<string, string> = { HUB: 'HUB', CHAPTER: 'Chapter', CLB: 'CLB' }
/** Up to two initials from a name, e.g. "Club 01" → "C0"; decoration only. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
const JOIN_TARGET = '/me/roles' // WF02-S04: the member's own membership request (guests go to /auth)

async function load(slug: string): Promise<PublicOrganizationDTO> {
  try {
    return await getPublicOrganization(slug)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    return { title: `${(await getPublicOrganization(slug)).name} · HUB NETWORK` }
  } catch {
    return {}
  }
}

const zone = 'Asia/Ho_Chi_Minh'
const dayMonth = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, day: '2-digit', month: '2-digit' }).format(
    new Date(iso),
  )
const time = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso))

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const org = await load(slug)
  const type = TYPE_LABELS[org.type] ?? org.type
  const join = `Xin vào ${org.type === 'CHAPTER' ? 'chapter' : type}`
  const childLabel = org.type === 'HUB' ? 'đơn vị' : 'CLB'

  return (
    <div className={styles.canvas} data-screen="WF03-S09">
      <div className={styles.page}>
        <nav className={styles.bar} aria-label="HUB NETWORK">
          <div className={`${styles.inner} ${styles.barInner}`}>
            <p className={styles.brand}>
              <HomeLink>HUB NETWORK</HomeLink>
              <span className={styles.slash} aria-hidden="true">
                /
              </span>
              <span className={styles.brandOrg}>{org.name}</span>
            </p>
            <div className={styles.links}>
              <a href="#gioi-thieu">Giới thiệu</a>
              <a href="#su-kien">Sự kiện</a>
              <a href="#truc-thuoc">
                {childLabel === 'CLB' ? 'CLB trực thuộc' : 'Đơn vị trực thuộc'}
              </a>
              <a className={styles.barCta} href={JOIN_TARGET} data-action="join">
                {join}
              </a>
            </div>
          </div>
        </nav>

        <header className={styles.hero} id="gioi-thieu">
          <div className={styles.inner}>
            <div className={styles.intro}>
              <p className={styles.eyebrowRow}>
                <span className={styles.heroEyebrow}>
                  {type}
                  {org.parent ? ` · thuộc ${org.parent.name}` : ''}
                </span>
                <span className={styles.statusChip}>Đang hoạt động</span>
              </p>
              <div className={styles.identity}>
                <span className={styles.logo} aria-hidden="true" />
                <h1 className={styles.name} data-org-name>
                  {org.name}
                </h1>
              </div>
              {org.description ? <p className={styles.description}>{org.description}</p> : null}
            </div>
            <dl className={styles.stats}>
              <div>
                <dt>thành viên</dt>
                <dd data-stat="active_members">{org.stats.active_members}</dd>
              </div>
              <div>
                <dt>sự kiện công khai</dt>
                <dd data-stat="public_events">{org.stats.public_events}</dd>
              </div>
              <div>
                <dt>{childLabel} trực thuộc</dt>
                <dd data-stat="children">{org.stats.children}</dd>
              </div>
            </dl>
            <div className={styles.heroActions}>
              <a className={styles.primary} href={JOIN_TARGET}>
                {join}
              </a>
              <a className={styles.ghost} href="#su-kien">
                Xem sự kiện sắp tới
              </a>
              <span className={styles.heroNote}>
                Yêu cầu tham gia do người phụ trách {org.name} duyệt.
              </span>
            </div>
          </div>
        </header>

        <section className={`${styles.section} ${styles.grey}`} id="truc-thuoc">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>
              {childLabel === 'CLB' ? 'CLB trực thuộc' : 'Đơn vị trực thuộc'}
            </p>
            <h2 className={styles.title}>
              {/* The total (WF06-PROD-03: the list holds the first 200 by name). */}
              {org.stats.children} {childLabel} trực thuộc {org.name}
            </h2>
            <p className={styles.lede}>
              Số liệu là tổng hợp công khai; danh sách thành viên không hiển thị ở trang này.
            </p>
            {org.children.length ? (
              <ul className={styles.cards}>
                {org.children.map((c, i) => (
                  <li key={c.slug} className={styles.card} data-child={c.slug}>
                    <span className={styles.cardBanner} data-tone={i % 3} aria-hidden="true" />
                    <div className={styles.cardHead}>
                      <span className={styles.cardAvatar} aria-hidden="true">
                        {initials(c.name)}
                      </span>
                      <p className={styles.cardType}>{TYPE_LABELS[c.type] ?? c.type}</p>
                    </div>
                    <h3 className={styles.cardTitle}>{c.name}</h3>
                    <dl className={styles.cardStats}>
                      <div>
                        <dt>thành viên</dt>
                        <dd>{c.stats.active_members}</dd>
                      </div>
                      <div>
                        <dt>sự kiện công khai</dt>
                        <dd>{c.stats.public_events}</dd>
                      </div>
                    </dl>
                    <a className={styles.cardLink} href={`/organizations/${c.slug}`}>
                      Xem trang {TYPE_LABELS[c.type] ?? c.type} →
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty} data-state="no-children">
                Chưa có đơn vị trực thuộc công khai.
              </p>
            )}
          </div>
        </section>

        <section className={styles.section} id="su-kien">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>Sự kiện</p>
            <h2 className={styles.title}>Sự kiện sắp tới</h2>
            <p className={styles.lede}>Các sự kiện đã công khai do {org.name} tổ chức.</p>
            {org.upcoming_events.length ? (
              <ul className={styles.cards}>
                {org.upcoming_events.map((e, i) => (
                  <li
                    key={`${e.name}-${i}`}
                    className={`${styles.card} ${styles.eventCard}`}
                    data-event-card
                  >
                    <div className={styles.eventMedia} data-tone={i % 3} aria-hidden="true">
                      <span className={styles.eventDate}>
                        {e.starts_at ? dayMonth(e.starts_at) : '—'}
                      </span>
                    </div>
                    <div className={styles.eventText}>
                      <h3 className={styles.eventName}>{e.name}</h3>
                      <p className={styles.eventMeta}>
                        {[e.location_text, e.starts_at ? time(e.starts_at) : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty} data-state="no-events">
                Chưa có sự kiện sắp tới.
              </p>
            )}
          </div>
        </section>

        <section className={styles.join}>
          <div className={styles.inner}>
            <p className={styles.joinEyebrow}>Tham gia</p>
            <h2 className={styles.joinTitle}>Vào {org.name}</h2>
            <p className={styles.joinText}>
              Đăng nhập để gửi yêu cầu; người phụ trách {org.name} duyệt. Tham gia không làm hồ sơ
              cá nhân của bạn trở nên công khai.
            </p>
            <a className={styles.joinButton} href={JOIN_TARGET}>
              {join} →
            </a>
          </div>
        </section>

        <footer className={styles.footer}>
          <div className={styles.inner}>
            <p className={styles.footerBrand}>HUB NETWORK · {org.name}</p>
            <p className={styles.footerSub}>
              {type}
              {org.parent ? ` thuộc ${org.parent.name}` : ''}
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
