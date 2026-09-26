import Link from 'next/link'

import type { LandingEntry } from '@/lib/landing/entry'

import styles from './landing.module.css'

/**
 * P0-LANDING — the public homepage (DEC-P0-LANDING-D1..D3).
 *
 * Built from the approved public 1hub visual language (WF03-S09 public page:
 * dark top bar, burgundy hero, red-dash eyebrows, bordered cards, join band;
 * WF01-S01: Archivo display headline). No approved landing bitmap exists, so no
 * pixel equivalence is claimed.
 *
 * Every claim traces to the Master Spec §1 architecture statement and the Data
 * SOT principles. Status is explicit per surface: "Đang vận hành" = a P0
 * production workflow (WF01–WF03), "Demo" = WF04 / WF05, "Tương lai" = WF06
 * and 1Hub / CCCD identity verification. No metric, AI, investor or
 * marketplace claim. Every link goes to a real route or an in-page section.
 */

type Status = 'LIVE' | 'DEMO' | 'FUTURE'
const STATUS_LABELS: Record<Status, string> = {
  LIVE: 'Đang vận hành',
  DEMO: 'Demo',
  FUTURE: 'Tương lai',
}

const PROBLEMS = [
  {
    title: 'Biểu mẫu, sheet, drive rời rạc',
    text: 'Mỗi chương trình, mỗi sự kiện tự thu thập dữ liệu theo cách riêng.',
  },
  {
    title: 'Khai lại hồ sơ nhiều lần',
    text: 'Cùng một người, một dự án phải nhập lại thông tin cho từng nơi.',
  },
  {
    title: 'Dữ liệu tổ chức phân tán',
    text: 'Quan hệ thành viên, ban điều hành và cấu trúc HUB – Chapter – CLB nằm ở nhiều nơi.',
  },
  {
    title: 'Kết quả không được tích luỹ',
    text: 'Hoạt động và kết quả tham gia không quay về một hồ sơ chung.',
  },
]

const PILLARS: Array<{ name: string; title: string; text: string; status: Status }> = [
  {
    name: 'Programs',
    title: 'Chương trình & sự kiện',
    text: 'Sự kiện độc lập của tổ chức đang vận hành; vận hành Chương trình / Thử thách đang ở dạng demo.',
    status: 'DEMO',
  },
  {
    name: 'Verified Identity',
    title: 'Định danh có nguồn gốc',
    text: 'Mỗi dữ kiện ghi rõ nguồn: tự khai, hệ thống ghi nhận hay tổ chức xác nhận. Xác thực danh tính (CCCD) là giai đoạn sau.',
    status: 'FUTURE',
  },
  {
    name: 'Ecosystem Profiles',
    title: 'Hồ sơ hệ sinh thái',
    text: 'Một hồ sơ gốc cho mỗi người; hồ sơ dự án / startup dùng lại được, không nhân bản theo chương trình.',
    status: 'LIVE',
  },
  {
    name: 'Discovery & Matching',
    title: 'Khám phá & kết nối',
    text: 'Tầm nhìn dữ liệu của hệ sinh thái; chưa phải tính năng đang vận hành.',
    status: 'FUTURE',
  },
]

const FLYWHEEL = [
  'Chương trình · Sự kiện',
  'Hoạt động & kết quả có nguồn gốc',
  'Hồ sơ được làm giàu',
  'Dữ liệu hệ sinh thái',
  'Khám phá & kết nối tốt hơn',
]

type Surface = { title: string; text: string; status: Status; href?: string; linkLabel?: string }

function Chip({ status }: { status: Status }) {
  return (
    <span className={`${styles.chip} ${styles[`chip${status}`]}`} data-status={status}>
      {STATUS_LABELS[status]}
    </span>
  )
}

export function Landing({
  entry,
  hubSlug,
  legal,
}: {
  entry: LandingEntry
  hubSlug: string | null
  legal: Array<{ href: string; label: string }>
}) {
  const primary =
    entry.kind === 'GUEST'
      ? { href: entry.href, label: 'Đăng nhập / Tham gia' }
      : entry.onboarded
        ? { href: entry.href, label: 'Vào tài khoản của tôi' }
        : { href: entry.href, label: 'Tiếp tục thiết lập tài khoản' }
  const network = hubSlug ? `/organizations/${hubSlug}` : null
  const surfaces: Surface[] = [
    {
      title: 'Hồ sơ thành viên',
      text: 'Đăng nhập bằng email, thiết lập hồ sơ, quyền riêng tư và quan hệ với tổ chức.',
      status: 'LIVE',
    },
    {
      title: 'Tổ chức & mạng lưới',
      text: 'HUB, Chapter, CLB: thành viên, ban điều hành, hồ sơ, sự kiện và trang công khai.',
      status: 'LIVE',
      ...(network ? { href: network, linkLabel: 'Xem trang mạng lưới →' } : {}),
    },
    {
      title: 'Chương trình / Thử thách',
      text: 'Tạo, cấu hình hành trình tham gia và theo dõi chương trình.',
      status: 'DEMO',
    },
    {
      title: 'Dự án / Startup',
      text: 'Một hồ sơ dự án hoặc startup với đội ngũ, dùng lại cho mọi chương trình.',
      status: 'LIVE',
    },
    {
      title: 'Khám phá & kết nối',
      text: 'Tìm đúng người, đúng dự án từ dữ liệu có nguồn gốc của hệ sinh thái.',
      status: 'FUTURE',
    },
  ]

  return (
    <div className={styles.page} data-screen="P0-LANDING" data-entry={entry.kind}>
      <header className={styles.bar}>
        <Link href="/" className={styles.brand} aria-label="1hub.network — trang chủ">
          1HUB.NETWORK
        </Link>
        <nav className={styles.nav} aria-label="Trang chủ">
          <a href="#van-de">Vấn đề</a>
          <a href="#san-pham">Sản phẩm</a>
          <a href="#tam-nhin">Tầm nhìn</a>
          {network ? <Link href={network}>Mạng lưới</Link> : null}
          <Link href={primary.href} className={styles.barCta} data-cta="primary-bar">
            {primary.label}
          </Link>
        </nav>
      </header>

      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.inner}>
            <p className={styles.heroEyebrow}>Hạ tầng chung cho hệ sinh thái đổi mới sáng tạo</p>
            <h1 id="hero-title" className={`type-display ${styles.heroTitle}`}>
              Một hồ sơ gốc cho mỗi người, mỗi dự án, mỗi tổ chức
            </h1>
            <p className={styles.heroLede}>
              1hub.network là lớp dữ liệu và vận hành dùng chung: hoạt động trong cộng đồng, chương
              trình và sự kiện được ghi thành dữ liệu có cấu trúc, rồi làm giàu dần hồ sơ của người
              tham gia, dự án và tổ chức.
            </p>
            <div className={styles.heroActions}>
              <Link href={primary.href} className={styles.primary} data-cta="primary">
                {primary.label}
              </Link>
              {network ? (
                <Link href={network} className={styles.ghost} data-cta="network">
                  Khám phá mạng lưới
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className={styles.section} id="van-de" aria-labelledby="problem-title">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>Vấn đề hiện tại</p>
            <h2 id="problem-title" className={styles.title}>
              Dữ liệu hệ sinh thái đang bị chia nhỏ
            </h2>
            <ul className={styles.grid4}>
              {PROBLEMS.map((p) => (
                <li key={p.title} className={styles.card}>
                  <h3 className={styles.cardTitle}>{p.title}</h3>
                  <p className={styles.cardText}>{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section
          className={`${styles.section} ${styles.grey}`}
          id="san-pham"
          aria-labelledby="what-title"
        >
          <div className={styles.inner}>
            <p className={styles.eyebrow}>1hub.network là gì</p>
            <h2 id="what-title" className={styles.title}>
              Programs × Verified Identity × Ecosystem Profiles × Discovery &amp; Matching
            </h2>
            <ul className={styles.grid4}>
              {PILLARS.map((p) => (
                <li key={p.name} className={styles.card} data-pillar={p.name}>
                  <div className={styles.cardHead}>
                    <p className={styles.cardKicker}>{p.name}</p>
                    <Chip status={p.status} />
                  </div>
                  <h3 className={styles.cardTitle}>{p.title}</h3>
                  <p className={styles.cardText}>{p.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.section} id="tam-nhin" aria-labelledby="flywheel-title">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>Vòng dữ liệu hệ sinh thái</p>
            <h2 id="flywheel-title" className={styles.title}>
              Mỗi hoạt động làm giàu thêm hồ sơ chung
            </h2>
            <ol className={styles.flywheel}>
              {FLYWHEEL.map((step, i) => (
                <li key={step} className={styles.step}>
                  <span className={styles.stepIndex} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className={styles.stepText}>{step}</span>
                </li>
              ))}
            </ol>
            <p className={styles.note}>
              Đây là tầm nhìn sản phẩm. Ghi nhận hồ sơ và tổ chức đang vận hành; khám phá &amp; kết
              nối dựa trên dữ liệu là giai đoạn sau, chưa vận hành.
            </p>
          </div>
        </section>

        <section className={`${styles.section} ${styles.grey}`} aria-labelledby="surfaces-title">
          <div className={styles.inner}>
            <p className={styles.eyebrow}>Các phân hệ</p>
            <h2 id="surfaces-title" className={styles.title}>
              Trạng thái từng phần của sản phẩm
            </h2>
            <ul className={styles.grid5}>
              {surfaces.map((s) => (
                <li key={s.title} className={styles.card} data-surface={s.title}>
                  <Chip status={s.status} />
                  <h3 className={styles.cardTitle}>{s.title}</h3>
                  <p className={styles.cardText}>{s.text}</p>
                  {s.href ? (
                    <Link href={s.href} className={styles.cardLink}>
                      {s.linkLabel}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className={styles.join} aria-labelledby="join-title">
          <div className={styles.inner}>
            <h2 id="join-title" className={styles.joinTitle}>
              {entry.kind === 'GUEST' ? 'Tham gia 1hub.network' : 'Tiếp tục với 1hub.network'}
            </h2>
            <p className={styles.joinText}>
              Đăng nhập bằng email — chưa có tài khoản thì hệ thống tự tạo. Hồ sơ của bạn chỉ hiển
              thị theo lựa chọn quyền riêng tư của bạn.
            </p>
            <Link href={primary.href} className={styles.joinButton} data-cta="primary-final">
              {primary.label} →
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.inner} ${styles.footerInner}`}>
          <p className={styles.footerBrand}>1HUB.NETWORK</p>
          {legal.length ? (
            <nav className={styles.footerLinks} aria-label="Pháp lý">
              {legal.map((l) => (
                <Link key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </footer>
    </div>
  )
}
