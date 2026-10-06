import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicAction } from '@/components/public-shell/public-action'
import { PublicHeader } from '@/components/public-shell/public-header'
import { STAGE_SHORT, findPublicStartup, type StartupPage } from '@/lib/public/directory-data'
import { PUBLIC_ROUTES } from '@/lib/public/routes'
import { publicShellData } from '@/lib/public/shell-data'

import styles from './startup.module.css'

/**
 * DEMO-SP1-FOUNDER-01 — `/products/[slug]`, the startup profile, tab Tổng quan
 * (DM10, `design-reference/final/demo-0710/DM10__startup-overview__SOURCE.png`).
 *
 * Public: a canonical published startup (STARTUP · ACTIVE · PUBLIC) by its
 * canonical slug; anything else — unknown, DRAFT, PRIVATE, a PROJECT — is
 * 404, with no hint that it exists. Identity, stage, place, domains, summary
 * and team are canonical; the Tổng quan copy, quarter figures, funding,
 * milestones and needs are the demo fixture (DEMO STATE ONLY). A team member
 * links to their founder page only when allow-listed (DEMO-D5). Chỉ số and
 * Cập nhật stay labels: their updated frames are not on the workstation.
 * Follow / connect / dataroom are visual-only (guest → /auth).
 */
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const startup = await findPublicStartup((await params).slug)
  return { title: startup ? `${startup.name} — Sản phẩm · HUB Network` : 'Sản phẩm — HUB Network' }
}

function initials(name: string, pick: 'first-two' | 'first-last'): string {
  const words = name.trim().split(/\s+/)
  const letters =
    words.length < 2
      ? name.slice(0, 2)
      : pick === 'first-two'
        ? words[0]!.charAt(0) + words[1]!.charAt(0)
        : words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)
  return letters.toLocaleUpperCase('vi')
}

function Label({ id, children }: { id?: string; children: string }) {
  return (
    <h2 id={id} className={styles.label}>
      {children}
    </h2>
  )
}

function Lock() {
  return (
    <svg viewBox="0 0 10 12" width="10" height="12" aria-hidden="true" className={styles.lock}>
      <path
        d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect x="0.5" y="5" width="9" height="6.5" rx="1.2" fill="#e8b04a" />
    </svg>
  )
}

function Team({ team }: { team: StartupPage['team'] }) {
  return (
    // Canonical team names differ from the frame's samples (INTENTIONAL-DATA).
    <ul className={styles.team} role="list" data-pixel="data">
      {team.map((m) => {
        const body = (
          <>
            <span className={styles.face} aria-hidden="true">
              {initials(m.name, 'first-last')}
              {/* QA-B-05: a visible cue that the row opens the founder profile. */}
              {m.href ? <span className={styles.memberGo}>→</span> : null}
            </span>
            <span className={styles.who}>
              <strong>{m.name}</strong>
              {m.role ? <small>{m.role}</small> : null}
            </span>
          </>
        )
        return (
          <li key={m.name}>
            {m.href ? (
              <Link href={m.href} className={styles.member} data-cta="founder">
                {body}
              </Link>
            ) : (
              <span className={styles.member}>{body}</span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export default async function StartupProfilePage({ params }: Params) {
  const { slug } = await params
  const [shell, startup] = await Promise.all([publicShellData(), findPublicStartup(slug)])
  if (!startup) notFound()
  const guest = shell.viewer.kind === 'GUEST'
  const o = startup.overview
  const meta = [
    startup.since ? `Từ ${startup.since}` : null,
    startup.round,
    startup.region?.replace(/^TP\. /, ''),
  ].filter(Boolean)
  return (
    <div
      className={styles.page}
      data-screen="DEMO-STARTUP"
      data-revision="DM10"
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
              {initials(startup.name, 'first-two')}
            </span>
            <div className={styles.identity}>
              <div className={styles.nameRow}>
                <h1 id="startup-name">{startup.name}</h1>
                {startup.domains[0] ? (
                  <span className={styles.domain}>{startup.domains[0]}</span>
                ) : null}
              </div>
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
          <div className={styles.pitch}>
            <p className={styles.eyebrow}>{o ? o.focus : startup.domains.join(' · ')}</p>
            <p className={styles.tagline}>{o ? o.tagline : (startup.summary ?? startup.name)}</p>
          </div>
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
          <div className={styles.main2}>
            {o ? (
              <>
                <section className={styles.block} aria-labelledby="sp-problem">
                  <Label id="sp-problem">Bài toán</Label>
                  <p className={styles.lead}>{o.problem.text}</p>
                  <dl className={styles.figures}>
                    {o.problem.figures.map((f) => (
                      <div key={f.label}>
                        <dt>{f.value}</dt>
                        <dd>{f.label}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
                <section className={styles.block} aria-labelledby="sp-solution">
                  <Label id="sp-solution">Giải pháp</Label>
                  <p className={styles.lead}>{o.solution.text}</p>
                  <ul className={styles.features} role="list">
                    {o.solution.features.map((f) => (
                      <li key={f.title}>
                        <h3>{f.title}</h3>
                        <p>{f.text}</p>
                      </li>
                    ))}
                  </ul>
                </section>
                <section className={styles.block} aria-labelledby="sp-market">
                  <Label id="sp-market">Thị trường</Label>
                  <p className={styles.soft}>{o.market.text}</p>
                  <dl className={styles.sizes}>
                    {o.market.sizes.map((m) => (
                      <div key={m.label}>
                        <dt>{m.label}</dt>
                        <dd>
                          <strong>{m.value}</strong>
                          <span>{m.note}</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className={styles.method}>
                    <h3>{o.market.method.title}</h3>
                    <p>{o.market.method.text}</p>
                  </div>
                </section>
                <section className={styles.block} aria-labelledby="sp-quotes">
                  <Label id="sp-quotes">Chia sẻ từ khách hàng</Label>
                  <div className={styles.quotes}>
                    {o.quotes.map((q) => (
                      <figure key={q.source}>
                        <blockquote>{q.text}</blockquote>
                        <figcaption>{q.source}</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <section className={styles.block} aria-labelledby="sp-about">
                <Label id="sp-about">Giới thiệu</Label>
                <p className={styles.lead}>{startup.summary ?? 'Chưa có mô tả.'}</p>
              </section>
            )}
            {startup.team.length ? (
              <section className={styles.block} aria-labelledby="sp-team">
                <Label id="sp-team">Đội ngũ</Label>
                <Team team={startup.team} />
              </section>
            ) : null}
            {o ? (
              <section className={styles.block} aria-labelledby="sp-vision">
                <Label id="sp-vision">Tầm nhìn</Label>
                <p className={styles.vision}>{o.vision}</p>
              </section>
            ) : null}
          </div>

          {o ? (
            <aside className={styles.rail} aria-label="Tóm tắt">
              <section className={styles.dark} aria-labelledby="sp-quarter">
                <Label id="sp-quarter">{o.quarter.label}</Label>
                <dl className={styles.quarter}>
                  {o.quarter.figures.map((f) => (
                    <div key={f.label}>
                      <dt>
                        {f.value}
                        <span className={styles.delta}>{f.delta}</span>
                      </dt>
                      <dd>{f.label}</dd>
                    </div>
                  ))}
                </dl>
                <PublicAction href={null} className={styles.darkLink}>
                  Xem chỉ số →
                </PublicAction>
              </section>
              <section className={styles.card} aria-labelledby="sp-funding">
                <Label id="sp-funding">Gọi vốn</Label>
                <dl className={styles.rows}>
                  {o.funding.rows.map((r) => (
                    <div key={r.label}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className={styles.progress} aria-hidden="true">
                  <span style={{ width: `${Math.round(o.funding.progress * 100)}%` }} />
                </div>
                <PublicAction
                  href={guest ? '/auth' : null}
                  className={styles.dataroom}
                  cta="dataroom"
                >
                  <Lock />
                  Hồ sơ đầy đủ &amp; dataroom
                </PublicAction>
              </section>
              <section className={styles.card} aria-labelledby="sp-milestones">
                <Label id="sp-milestones">Dấu ấn</Label>
                <ul className={styles.milestones} role="list">
                  {o.milestones.map((m) => (
                    <li key={m.title}>
                      <strong>{m.title}</strong>
                      <small>{m.meta}</small>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.card} aria-labelledby="sp-needs">
                <Label id="sp-needs">Nhu cầu</Label>
                <ul className={styles.needs} role="list">
                  {o.needs.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <PublicAction href={null} className={styles.cardLink}>
                  Xem vị trí tuyển dụng →
                </PublicAction>
              </section>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  )
}
