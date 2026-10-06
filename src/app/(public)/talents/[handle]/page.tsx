import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { PublicAction } from '@/components/public-shell/public-action'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import { VERIFIED_DEMO_MARKER, type DemoBadge } from '@/lib/demo-0710/founders'
import { findDemoFounder } from '@/lib/public/founder-data'
import { publicShellData } from '@/lib/public/shell-data'

import styles from './founder.module.css'

/**
 * DEMO-SP1-FOUNDER-01 — `/talents/[handle]`, the public Founder Profile
 * (DM13, `design-reference/final/demo-0710/DM13__founder-profile__SOURCE.png`),
 * PUBLIC VIEW only (DEMO-D13).
 *
 * - Only the demo allow-list renders (DEMO-D5); any other handle is 404. The
 *   route key is a fixed public handle: no profile id reaches the page.
 * - Name, headline, region, bio, ventures: canonical, through the discovery
 *   projection. Experience, education, expertise, certificates, badges: the
 *   demo fixture. A section without data is not drawn.
 * - "Đã xác thực danh tính qua 1Hub" is DEMO STATE ONLY (DEMO-D10): a
 *   fixture flag, no verification, no role, nothing stored.
 * - Not rendered (owner-only or private): the contact / privacy card, "+ Tạo
 *   sản phẩm", e-mail, phone, programme applications and their scores.
 * - "Kết nối", "Theo dõi" are visual-only (guest → /auth); "Thông tin liên
 *   hệ" is inert (contact details are private).
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ handle: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const founder = await findDemoFounder((await params).handle)
  return { title: founder ? `${founder.name} — Nhân tài · HUB Network` : 'Nhân tài — HUB Network' }
}

function initials(name: string): string {
  const w = name.trim().split(/\s+/)
  return (
    w.length < 2 ? name.slice(0, 2) : w[0]!.charAt(0) + w[w.length - 1]!.charAt(0)
  ).toLocaleUpperCase('vi')
}

function Badge({ badge }: { badge: DemoBadge }) {
  return (
    <li className={styles.badge}>
      <span className={`${styles.medal} ${styles[badge.tone]}`} aria-hidden="true">
        <span className={badge.mark === 'diamond' ? styles.diamond : styles.dot} />
      </span>
      <strong>{badge.title}</strong>
      <small>{badge.note}</small>
    </li>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {children}
    </section>
  )
}

export default async function FounderPage({ params }: Params) {
  const { handle } = await params
  const [shell, founder] = await Promise.all([publicShellData(), findDemoFounder(handle)])
  if (!founder) notFound()
  const guest = shell.viewer.kind === 'GUEST'
  const d = founder.demo
  const metaLine = [founder.region?.replace(/^TP\. /, ''), d.hubRole].filter(Boolean) as string[]
  return (
    <div
      className={styles.page}
      data-screen="DEMO-FOUNDER"
      data-revision="DM13"
      data-founder={founder.handle}
      data-entry={shell.viewer.kind}
    >
      {/* DM13 draws the dark bar on a light page: the dark header tone is transparent. */}
      <div className={styles.bar}>
        <PublicHeader viewer={shell.viewer} current="talents" />
      </div>
      <main className={styles.main}>
        <div className={styles.column}>
          <section className={styles.hero} aria-labelledby="founder-name">
            <div className={styles.cover} aria-hidden="true" />
            <div className={styles.heroBody}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(founder.name)}
              </span>
              <div className={styles.nameRow}>
                <h1 id="founder-name">{founder.name}</h1>
                {d.identityVerifiedDemo ? (
                  <span
                    className={styles.verified}
                    data-verified="demo"
                    data-demo={VERIFIED_DEMO_MARKER}
                  >
                    <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
                      <circle cx="6" cy="6" r="6" fill="#fc523c" />
                      <path
                        d="M3.3 6.2l1.8 1.8 3.6-3.8"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="1.5"
                      />
                    </svg>
                    Đã xác thực danh tính qua 1Hub
                  </span>
                ) : null}
              </div>
              {founder.headline ? <p className={styles.headline}>{founder.headline}</p> : null}
              <p className={styles.meta}>
                {metaLine.map((m) => (
                  <span key={m}>{m}</span>
                ))}
                <PublicAction href={null} className={styles.contact} cta="contact">
                  Thông tin liên hệ
                </PublicAction>
              </p>
              {d.badges.length ? (
                <div className={styles.badges}>
                  <p className={styles.badgeHead}>
                    <span className={styles.hubPill}>HUB NETWORK</span>
                    Huy hiệu thành viên
                  </p>
                  <ul role="list">
                    {d.badges.map((b) => (
                      <Badge key={b.title} badge={b} />
                    ))}
                  </ul>
                </div>
              ) : null}
              {d.tags.length ? (
                <ul className={styles.tags} role="list" aria-label="Lĩnh vực">
                  {d.tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
              <div className={styles.actions}>
                <PublicAction
                  href={guest ? '/auth' : null}
                  className={styles.connect}
                  cta="connect"
                >
                  Kết nối
                </PublicAction>
                <PublicAction href={guest ? '/auth' : null} className={styles.follow} cta="follow">
                  Theo dõi
                </PublicAction>
              </div>
            </div>
          </section>

          {founder.bio ? (
            <Section id="founder-about" title="Giới thiệu">
              <p className={styles.bio}>{founder.bio}</p>
            </Section>
          ) : null}

          {d.experience.length ? (
            <Section id="founder-experience" title="Kinh nghiệm">
              <ul className={styles.entries} role="list">
                {d.experience.map((e) => (
                  <li key={e.title + e.org}>
                    <span className={styles.mark} aria-hidden="true">
                      {e.mark}
                    </span>
                    <div>
                      <h3>{e.title}</h3>
                      <p className={styles.sub}>{e.org}</p>
                      <p className={styles.when}>{e.period}</p>
                      {e.points.length ? (
                        <ul className={styles.points} role="list">
                          {e.points.map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {founder.ventures.length ? (
            <Section id="founder-ventures" title="Dự án/doanh nghiệp khởi nghiệp, đổi mới sáng tạo">
              <ul className={styles.entries} role="list">
                {founder.ventures.map((v) => (
                  <li key={v.href}>
                    <span className={`${styles.mark} ${styles.markRed}`} aria-hidden="true">
                      {initials(v.name)}
                    </span>
                    <div>
                      <h3 className={styles.ventureName}>
                        <Link href={v.href} data-cta="venture">
                          {v.name}
                        </Link>
                        {v.stage ? <span className={styles.chip}>{v.stage}</span> : null}
                      </h3>
                      {v.role ? <p className={styles.sub}>{v.role}</p> : null}
                      <p className={styles.when}>
                        {[...v.domains, v.region].filter(Boolean).join(' · ')}
                      </p>
                      {v.summary ? <p className={styles.note}>{v.summary}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {d.education.length ? (
            <Section id="founder-education" title="Học vấn">
              <ul className={styles.entries} role="list">
                {d.education.map((e) => (
                  <li key={e.school}>
                    <span className={`${styles.mark} ${styles.round}`} aria-hidden="true">
                      {e.mark}
                    </span>
                    <div>
                      <h3>{e.school}</h3>
                      <p className={styles.sub}>{e.degree}</p>
                      <p className={styles.when}>{e.period}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {d.expertise.length ? (
            <Section id="founder-expertise" title="Chuyên môn">
              <ul className={styles.skills} role="list">
                {d.expertise.map((s) => (
                  <li key={s.name}>
                    <span>{s.name}</span>
                    <span className={s.level === 'Chính' ? styles.main1 : styles.minor}>
                      {s.level}
                    </span>
                    <span className={styles.years}>{s.years}</span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {d.certificates.length ? (
            <Section id="founder-certificates" title="Chứng chỉ">
              <ul className={styles.entries} role="list">
                {d.certificates.map((c) => (
                  <li key={c.name}>
                    <span className={styles.mark} aria-hidden="true">
                      {c.mark}
                    </span>
                    <div>
                      <h3>{c.name}</h3>
                      <p className={styles.sub}>{c.issuer}</p>
                      <p className={styles.when}>{c.period}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        <aside className={styles.rail} aria-label="Liên quan">
          {founder.ventures.length ? (
            <section className={styles.railCard} aria-labelledby="founder-products">
              <h2 id="founder-products" className={styles.railLabel}>
                Sản phẩm
              </h2>
              <ul className={styles.products} role="list">
                {founder.ventures.map((v) => (
                  <li key={v.href}>
                    <Link href={v.href} className={styles.product} data-cta="product">
                      <span className={styles.productMark} aria-hidden="true">
                        {v.name.slice(0, 2)}
                      </span>
                      <span>
                        <strong>{v.name}</strong>
                        <small>{[v.stage, v.domains[0]].filter(Boolean).join(' · ')}</small>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {founder.others.length ? (
            <section className={styles.railCard} aria-labelledby="founder-others">
              <h2 id="founder-others" className={styles.railLabel}>
                Nhà sáng lập khác
              </h2>
              <ul className={styles.others} role="list">
                {founder.others.map((o) => (
                  <li key={o.href}>
                    <Link href={o.href} className={styles.other} data-cta="other-founder">
                      <span className={styles.otherFace} aria-hidden="true">
                        {initials(o.name)}
                      </span>
                      <span>
                        <strong>{o.name}</strong>
                        {o.line ? <small>{o.line}</small> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </main>
      {/* THAO-02: the one public footer, as on every public page. */}
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
