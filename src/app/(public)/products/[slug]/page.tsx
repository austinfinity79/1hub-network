import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicAction } from '@/components/public-shell/public-action'
import { PublicHeader } from '@/components/public-shell/public-header'
import { STAGE_SHORT, findPublicStartup } from '@/lib/public/directory-data'
import { PUBLIC_ROUTES } from '@/lib/public/routes'
import { publicShellData } from '@/lib/public/shell-data'

import styles from './startup.module.css'

/**
 * DEMO-DIR2-01 — `/products/[slug]`, the startup page a directory card opens.
 *
 * Public: a canonical published startup (STARTUP · ACTIVE · PUBLIC) by its
 * canonical slug; anything else — unknown, DRAFT, PRIVATE, a PROJECT — is
 * 404, with no hint that it exists. This is the interim Tổng quan header and
 * summary in the DM10 language; the full DM10 / DM11 / DM12 page is
 * DEMO-SP1-FOUNDER-01. Team names are shown for the demo ventures only
 * (fictional people). Follow / connect are visual-only (guest → /auth).
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const startup = await findPublicStartup((await params).slug)
  return { title: startup ? `${startup.name} — Sản phẩm · HUB Network` : 'Sản phẩm — HUB Network' }
}

export default async function StartupPage({ params }: Params) {
  const { slug } = await params
  const [shell, startup] = await Promise.all([publicShellData(), findPublicStartup(slug)])
  if (!startup) notFound()
  const guest = shell.viewer.kind === 'GUEST'
  const meta = [
    startup.since ? `Từ ${startup.since}` : null,
    startup.round,
    startup.region?.replace(/^TP\. /, ''),
  ].filter(Boolean)
  const mark = startup.name.trim().split(/\s+/)
  return (
    <div
      className={styles.page}
      data-screen="DEMO-STARTUP"
      data-startup={startup.slug}
      data-entry={shell.viewer.kind}
    >
      <PublicHeader viewer={shell.viewer} current="products" tone="light" />
      <main className={styles.main}>
        <Link href={PUBLIC_ROUTES.products ?? '/'} className={styles.back} data-cta="back">
          ← Sản phẩm
        </Link>
        <section className={styles.head} aria-labelledby="startup-name">
          <div className={styles.headTop}>
            <span className={styles.logo} aria-hidden="true">
              {(mark.length > 1
                ? mark[0]!.charAt(0) + mark[1]!.charAt(0)
                : startup.name.slice(0, 2)
              ).toLocaleUpperCase('vi')}
            </span>
            <div className={styles.identity}>
              <h1 id="startup-name">{startup.name}</h1>
              {startup.domains[0] ? (
                <span className={styles.domain}>{startup.domains[0]}</span>
              ) : null}
            </div>
            <div className={styles.side}>
              {startup.stage ? (
                <span className={styles.status}>
                  {startup.stage === 'PILOT' ? 'Đang pilot' : STAGE_SHORT[startup.stage]}
                </span>
              ) : null}
              {meta.length ? <p className={styles.meta}>{meta.join(' · ')}</p> : null}
              <div className={styles.actions}>
                <PublicAction href={guest ? '/auth' : null} className={styles.follow} cta="follow">
                  Theo dõi
                </PublicAction>
                <PublicAction
                  href={guest ? '/auth' : null}
                  className={styles.connect}
                  cta="connect"
                >
                  Đề nghị kết nối
                </PublicAction>
              </div>
            </div>
          </div>
          {startup.summary ? (
            <div className={styles.pitch}>
              <p className={styles.eyebrow}>
                {startup.domains.map((d) => d.toLocaleUpperCase('vi')).join(' · ')}
              </p>
              <p className={styles.tagline}>{startup.summary}</p>
            </div>
          ) : null}
        </section>

        <nav className={styles.tabs} aria-label="Hồ sơ sản phẩm">
          <span className={styles.tabOn} aria-current="page">
            Tổng quan
          </span>
          <span className={styles.tab} data-nav-kind="LABEL">
            Chỉ số
          </span>
          <span className={styles.tab} data-nav-kind="LABEL">
            Cập nhật
          </span>
        </nav>

        <div className={styles.body}>
          <section className={styles.block} aria-labelledby="startup-about">
            <p id="startup-about" className={styles.label}>
              GIỚI THIỆU
            </p>
            <p className={styles.lead}>{startup.summary ?? 'Chưa có mô tả.'}</p>
            {startup.headline.length ? (
              <dl className={styles.numbers}>
                {startup.headline.map((h) => (
                  <div key={h.label}>
                    <dt>{h.value}</dt>
                    <dd>{h.label}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {startup.team.length ? (
              <>
                <p className={styles.label}>ĐỘI NGŨ</p>
                <ul className={styles.team} role="list">
                  {startup.team.map((m) => (
                    <li key={m.name}>
                      <span className={styles.face} aria-hidden="true">
                        {m.name
                          .trim()
                          .split(/\s+/)
                          .filter((_, i, a) => i === 0 || i === a.length - 1)
                          .map((w) => w.charAt(0))
                          .join('')
                          .toLocaleUpperCase('vi')}
                      </span>
                      <span>
                        <strong>{m.name}</strong>
                        {m.role ? <small>{m.role}</small> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>
          <aside className={styles.facts} aria-label="Thông tin">
            <dl>
              {startup.stage ? (
                <div>
                  <dt>Giai đoạn</dt>
                  <dd>{startup.stageLabel}</dd>
                </div>
              ) : null}
              {startup.region ? (
                <div>
                  <dt>Khu vực</dt>
                  <dd>{startup.region}</dd>
                </div>
              ) : null}
              {startup.domains.length ? (
                <div>
                  <dt>Lĩnh vực</dt>
                  <dd>{startup.domains.join(', ')}</dd>
                </div>
              ) : null}
              {startup.fundraising ? (
                <div>
                  <dt>Gọi vốn</dt>
                  <dd>{startup.round ? `Vòng ${startup.round}` : 'Đang gọi vốn'}</dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>
      </main>
    </div>
  )
}
