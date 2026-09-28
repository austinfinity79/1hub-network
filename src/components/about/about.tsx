import Link from 'next/link'

import type { LandingEntry } from '@/lib/landing/entry'

import { Arrow, Cta, type Action } from '../landing/landing-parts'
import landing from '../landing/landing.module.css'

import {
  AboutMotion,
  ActivitiesStrip,
  ClosingGlow,
  HumansStrip,
  OrgDiagram,
  TimelineTrack,
} from './about-client'
import {
  HERO_CARDS,
  HERO_STATS,
  MISSIONS,
  ORG_TIERS,
  SCALE_FUNCTIONS,
  SCALE_PHOTOS,
  VALUES,
} from './about-data'
import { Photo, ScaleRing } from './about-parts'
import styles from './about.module.css'

/**
 * TASK 22-PREVIEW-ABOUT — the public About page, `/about` for every visitor.
 *
 * Reference: About.zip (Sprint 1 · DL29, 28/09): 01 Hero · 02 Sứ mệnh ·
 * 03 Giá trị cốt lõi H·U·B · 04 Quy mô mạng lưới · 05 Cơ cấu tổ chức + Humans
 * of HUB · 06 Dấu ấn phát triển · 07 Các hoạt động tiêu biểu · 08 Mỗi kết
 * nối, một khởi đầu · Footer. The header reuses the homepage bar classes
 * (landing.module.css, read-only) so both public pages match.
 *
 * Calls to action go to a real destination or are inert with a reason
 * (`Cta`, DEC-P0-SHELL-D2): "Tham gia HUB Network" is the visitor's entry
 * point (the homepage's); "Khám phá các HUB Chapter" is the published HUB's
 * public page (it lists its chapters). Everything else has no screen yet.
 */

function entryLabel(entry: LandingEntry): string | null {
  if (entry.kind === 'GUEST') return null
  return entry.onboarded ? 'Vào tài khoản của tôi' : 'Tiếp tục thiết lập tài khoản'
}

function SectionLabel({
  no,
  children,
  tone = 'red',
}: {
  no: string
  children: string
  tone?: 'red' | 'coral' | 'ink'
}) {
  return (
    <p className={styles.label}>
      <span className={styles[`labelNo_${tone}`]}>{no}</span>
      <span className={styles.labelSlash}> / </span>
      {children}
    </p>
  )
}

export function About({
  entry,
  hubSlug,
  legal,
}: {
  entry: LandingEntry
  hubSlug: string | null
  legal: Array<{ href: string; label: string }>
}) {
  const member = entryLabel(entry)
  const join: Action = { href: entry.href }
  const network: Action = hubSlug
    ? { href: `/organizations/${hubSlug}` }
    : { inert: 'NO_P0_SCREEN' }
  const later: Action = { inert: 'NO_P0_SCREEN' }

  return (
    <div
      className={`${landing.page} ${styles.page}`}
      data-screen="PUBLIC-ABOUT"
      data-entry={entry.kind}
    >
      <AboutMotion />
      <div className={styles.content}>
        {/* 01 — Hero */}
        <section className={styles.hero} data-section="hero" aria-labelledby="about-title">
          <header className={landing.bar}>
            <Link href="/" className={landing.brand} aria-label="HUB NETWORK — trang chủ">
              HUB NETWORK
            </Link>
            <nav className={landing.nav} aria-label="Trang chủ">
              <Link href="/about" className={styles.navActive} aria-current="page">
                Về HUB Network
              </Link>
              <Cta action={later} label="Chương trình">
                Chương trình
              </Cta>
              <Cta action={later} label="Sự kiện">
                Sự kiện
              </Cta>
              <Cta action={network} label="Mạng lưới đổi mới sáng tạo">
                Mạng lưới đổi mới sáng tạo
              </Cta>
            </nav>
            <div className={landing.barRight}>
              <Cta action={{ inert: 'FUTURE' }} label="VI | EN" className={landing.lang}>
                VI | EN
              </Cta>
              {member ? null : (
                <Link href={entry.href} className={landing.login} data-cta="login">
                  Đăng nhập
                </Link>
              )}
              <Link href={entry.href} className={landing.barPill} data-cta="primary-bar">
                {member ?? 'Tạo tài khoản'}
              </Link>
            </div>
          </header>

          <div className={styles.heroCards} aria-hidden="true">
            {HERO_CARDS.map((c, i) => (
              <div key={c.caption} className={`${styles.heroCard} ${styles[`heroCard${i + 1}`]}`}>
                <Photo
                  caption={c.caption}
                  tone={c.tone}
                  rounded={false}
                  photo={c.photo}
                  sizes="(max-width: 899px) 45vw, 250px"
                  priority
                />
              </div>
            ))}
          </div>

          <p className={styles.heroEyebrow}>VIETNAMESE GLOBAL NETWORK</p>
          <h1 id="about-title" className={styles.heroTitle}>
            HUB
            <br />
            Network
          </h1>
          <p className={styles.heroTagline}>
            Mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số
          </p>
          <div className={styles.heroSide}>
            <p className={styles.heroLede}>
              Tổ chức cộng đồng phi lợi nhuận quy tụ người Việt trẻ trên toàn cầu chung niềm đam mê
              khởi nghiệp, đổi mới sáng tạo, cùng chia sẻ tri thức, cộng hưởng nguồn lực và kiến tạo
              giá trị cho Việt Nam.
            </p>
            <div className={styles.heroActions}>
              <Cta
                action={join}
                label="Tham gia HUB Network"
                className={styles.btnInk}
                cta="about-join"
              >
                Tham gia HUB Network <Arrow />
              </Cta>
              <Cta action={later} label="Kết nối hợp tác" className={styles.btnLine}>
                Kết nối hợp tác
              </Cta>
            </div>
          </div>
          <ul className={styles.stats}>
            {HERO_STATS.map((s) => (
              <li key={s.label} className={styles.stat}>
                <span className={styles.statValue}>{s.value}</span>
                <span className={styles.statLabel}>{s.label}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 02 — Sứ mệnh */}
        <section
          id="su-menh"
          className={styles.mission}
          data-section="mission"
          aria-labelledby="mission-title"
        >
          <SectionLabel no="02">SỨ MỆNH</SectionLabel>
          <h2 id="mission-title" className={styles.h2}>
            Sứ mệnh
          </h2>
          <ol className={styles.missionList}>
            {MISSIONS.map((m, i) => (
              <li
                key={m.no}
                className={`${styles.missionRow} ${i === 0 ? styles.missionRowOpen : ''}`}
                data-reveal="rise"
              >
                <span className={styles.missionNo}>{m.no}</span>
                <p className={styles.missionTitle}>{m.title}</p>
                <div className={styles.missionPhoto} data-reveal="open">
                  <Photo
                    caption={m.caption}
                    tone={m.tone}
                    photo={m.photo}
                    sizes="(max-width: 1279px) 100vw, 520px"
                  />
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* 03 — Giá trị cốt lõi H·U·B */}
        <section className={styles.values} data-section="values" aria-labelledby="values-title">
          <SectionLabel no="03" tone="coral">
            GIÁ TRỊ CỐT LÕI
          </SectionLabel>
          <h2 id="values-title" className={`${styles.h2} ${styles.onDark}`}>
            Giá trị cốt lõi
          </h2>
          <ul className={styles.valueList}>
            {VALUES.map((v, i) => (
              <li
                key={v.letter}
                className={`${styles.valueCard} ${i === 0 ? styles.valueCardLit : ''}`}
              >
                <span className={styles.valueLetter} aria-hidden="true" data-reveal="slide">
                  {v.letter}
                </span>
                <h3 className={styles.valueName}>
                  <span className={styles.coralText}>{v.letter}</span>
                  {v.rest}
                </h3>
                <p className={styles.valueText}>{v.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* 04 — Quy mô mạng lưới */}
        <section
          id="quy-mo"
          className={styles.scale}
          data-section="scale"
          aria-labelledby="scale-title"
        >
          <div className={styles.scaleHead}>
            <div>
              <SectionLabel no="04">QUY MÔ MẠNG LƯỚI</SectionLabel>
              <h2 id="scale-title" className={styles.h2Big}>
                Một mạng lưới,
                <br />
                nhiều điểm kết nối
              </h2>
            </div>
            <p className={styles.scaleLede}>
              HUB Network phát triển theo mô hình liên kết đa tầng: thống nhất về tầm nhìn và định
              hướng, đồng thời trao quyền để mỗi HUB chủ động phát triển cộng đồng và nguồn lực phù
              hợp với từng khu vực và nhóm thành viên.
            </p>
          </div>

          <div className={styles.core}>
            <div className={styles.coreText}>
              <p className={styles.coreTier}>
                <span className={styles.coreDot} aria-hidden="true" />
                TẦNG 1 · TRUNG TÂM CỦA MẠNG LƯỚI
              </p>
              <h3 className={styles.coreTitle}>HUB Tổng</h3>
              <p className={styles.coreLede}>
                Định hướng chiến lược, kết nối nguồn lực và xây dựng hệ thống vận hành chung cho
                toàn mạng lưới.
              </p>
              <ol className={styles.coreList}>
                {SCALE_FUNCTIONS.map((f, i) => (
                  <li key={f}>
                    <span className={styles.coreNo}>0{i + 1}</span>
                    {f}
                  </li>
                ))}
              </ol>
              <p className={styles.coreChips}>
                <span>13 HUB thành viên</span>
                <span>Gần 60 câu lạc bộ, cộng đồng</span>
              </p>
            </div>
            <ScaleRing className={styles.coreRing} />
          </div>

          <div className={styles.tiers}>
            <article className={styles.tierCard}>
              <div className={styles.tierHead}>
                <span className={styles.tierBig}>13</span>
                <div>
                  <p className={styles.tierNo}>TẦNG 2</p>
                  <h3 className={styles.tierTitle}>HUB thành viên</h3>
                </div>
              </div>
              <p className={styles.tierText}>
                Phát triển theo khu vực địa lý; trực tiếp kết nối cộng đồng, đối tác và triển khai
                các hoạt động phù hợp.
              </p>
              <div className={styles.tierPhoto}>
                <Photo
                  caption="ẢNH · HOẠT ĐỘNG TẠI MỘT HUB KHU VỰC"
                  tone="warm"
                  photo={SCALE_PHOTOS.memberHubs}
                  sizes="(max-width: 1279px) 100vw, 660px"
                />
              </div>
            </article>
            <article className={styles.tierCard}>
              <div className={styles.tierHead}>
                <span className={styles.tierBig}>~60</span>
                <div>
                  <p className={styles.tierNo}>TẦNG 3</p>
                  <h3 className={styles.tierTitle}>Câu lạc bộ, cộng đồng</h3>
                </div>
              </div>
              <p className={styles.tierText}>
                Kết nối gần 60 câu lạc bộ và cộng đồng về khởi nghiệp, đổi mới sáng tạo, công nghệ
                và dữ liệu, tạo những điểm kết nối sâu tại trường học, địa phương và các nhóm chuyên
                môn.
              </p>
              <div className={styles.tierPhoto}>
                <Photo
                  caption="ẢNH · CÂU LẠC BỘ TẠI TRƯỜNG"
                  tone="dark"
                  photo={SCALE_PHOTOS.clubs}
                  sizes="(max-width: 1279px) 100vw, 660px"
                />
              </div>
            </article>
          </div>

          <div className={styles.scaleActions}>
            <Cta action={network} label="Khám phá các HUB Chapter" className={styles.btnInk}>
              Khám phá các HUB Chapter <Arrow />
            </Cta>
            <Cta action={later} label="Khám phá các câu lạc bộ" className={styles.btnLineInk}>
              Khám phá các câu lạc bộ <Arrow />
            </Cta>
          </div>
        </section>

        {/* 05 — Cơ cấu tổ chức + Humans of HUB */}
        <section id="co-cau" className={styles.org} data-section="org" aria-labelledby="org-title">
          <div className={styles.orgHead}>
            <div>
              <p className={styles.label}>
                <span className={styles.labelNo_coral}>CƠ CẤU TỔ CHỨC</span>
              </p>
              <h2 id="org-title" className={`${styles.h2} ${styles.onDark}`}>
                Cơ cấu tổ chức
              </h2>
              <p className={styles.orgNote}>
                <span className={styles.coreDot} aria-hidden="true" />
                Đội ngũ Ban Điều hành HUB Network nhiệm kỳ hiện tại
              </p>
            </div>
            <p className={styles.orgLede}>
              Mỗi vị trí trong mạng lưới — từ HUB Tổng tới từng HUB thành viên và câu lạc bộ — cùng
              những người đang đảm nhiệm.
            </p>
          </div>

          <div className={styles.orgBody}>
            <ol className={styles.orgTiers}>
              {ORG_TIERS.map((t) => (
                <li key={t.tier}>
                  <p className={styles.orgTier}>{t.tier}</p>
                  <p className={styles.orgTierTitle}>{t.title}</p>
                  {t.note ? <p className={styles.orgTierNote}>{t.note}</p> : null}
                </li>
              ))}
            </ol>
            <OrgDiagram />
          </div>
          <p className={styles.orgHint}>
            RÊ CHUỘT HOẶC CHẠM VÀO MỘT HUB ĐỂ XEM NGƯỜI PHỤ TRÁCH · VÒNG NGOÀI MANG TÍNH MINH HOẠ
          </p>

          <div id="humans" className={styles.humans}>
            <HumansStrip later={later} />
          </div>
        </section>

        {/* 06 — Dấu ấn phát triển */}
        <section
          id="dau-an"
          className={styles.timeline}
          data-section="timeline"
          aria-labelledby="timeline-title"
        >
          <SectionLabel no="06">DẤU ẤN PHÁT TRIỂN</SectionLabel>
          <h2 id="timeline-title" className={styles.h2}>
            5 năm kết nối và mở rộng
          </h2>
          <TimelineTrack />
        </section>

        {/* 07 — Các hoạt động tiêu biểu */}
        <section
          className={styles.activities}
          data-section="activities"
          aria-labelledby="activities-title"
        >
          <SectionLabel no="07">CÁC HOẠT ĐỘNG TIÊU BIỂU</SectionLabel>
          <h2 id="activities-title" className={styles.h2Big}>
            Các hoạt động tiêu biểu
          </h2>
          <p className={styles.activitiesLede}>
            Các chương trình, sự kiện, cuộc thi HUB Network chủ trì tổ chức và phối hợp tổ chức.
          </p>
          <ActivitiesStrip later={later} />
        </section>

        {/* 08 — Mỗi kết nối, một khởi đầu */}
        <ClosingGlow>
          <SectionLabel no="08" tone="ink">
            THAM GIA
          </SectionLabel>
          <h2 className={styles.closingTitle}>
            Mỗi kết nối, một
            <br />
            khởi đầu
          </h2>
          <div className={styles.closingFoot}>
            <p className={styles.closingText}>
              Dù bạn là cá nhân đang tìm kiếm cộng đồng, một tổ chức muốn mở rộng hợp tác hay một
              đối tác mong muốn đóng góp nguồn lực, HUB Network luôn sẵn sàng cùng bạn tạo nên những
              kết nối có ý nghĩa.
            </p>
            <div className={styles.closingActions}>
              <Cta
                action={join}
                label="Tham gia HUB Network"
                className={`${styles.btnInk} ${styles.magnet}`}
                cta="about-join-closing"
              >
                Tham gia HUB Network <Arrow />
              </Cta>
              <Cta action={later} label="Kết nối hợp tác" className={styles.btnLine}>
                Kết nối hợp tác
              </Cta>
            </div>
          </div>
        </ClosingGlow>
      </div>

      {/* Footer — fixed behind the page (revealed as the last section scrolls away) */}
      <footer className={styles.footer} data-section="footer">
        <div className={styles.footerTop}>
          <div>
            <p className={styles.footerBrand}>HUB NETWORK</p>
            <p className={styles.footerText}>
              Mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số.
            </p>
          </div>
          <FooterColumn title="VỀ HUB NETWORK">
            {/* The pack has no separate vision section; "Tầm nhìn" opens the mission. */}
            <a href="#su-menh">Tầm nhìn</a>
            <a href="#quy-mo">Quy mô mạng lưới</a>
            <a href="#co-cau">Cơ cấu tổ chức</a>
            <a href="#dau-an">Dấu ấn phát triển</a>
          </FooterColumn>
          <FooterColumn title="MẠNG LƯỚI">
            <Cta action={network} label="HUB Chapters">
              HUB Chapters
            </Cta>
            <Cta action={later} label="Câu lạc bộ">
              Câu lạc bộ
            </Cta>
            <a href="#humans">Humans of HUB</a>
          </FooterColumn>
          <FooterColumn title="THÔNG TIN">
            <Cta action={later} label="Câu hỏi thường gặp">
              Câu hỏi thường gặp
            </Cta>
            {legal.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </FooterColumn>
          <FooterColumn title="LIÊN HỆ">
            <Cta action={later} label="global@1hub.network">
              global@1hub.network
            </Cta>
            <Cta action={later} label="0936 966 001">
              0936 966 001
            </Cta>
          </FooterColumn>
        </div>
        <p className={styles.footerMark} aria-hidden="true">
          HUB NETWORK
        </p>
        <div className={styles.footerBottom}>
          <span>© 2026 HUB Network</span>
          <span>1hub.network</span>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.footerCol}>
      <p className={styles.footerHead}>{title}</p>
      <div className={styles.footerLinks}>{children}</div>
    </div>
  )
}
