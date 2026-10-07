import Image from 'next/image'

import type { AboutNetwork } from '@/lib/public/about-network'
import { ECOSYSTEM_LINKS, FACEBOOK_URL, PUBLIC_ROUTES } from '@/lib/public/routes'
import type { PublicShellData } from '@/lib/public/shell-data'

import { ArrowRight, ArrowUpRight, PublicAction } from '@/components/public-shell/public-action'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'

import { ACTIVITIES, HERO_STATS, MILESTONES, VALUES, type Human } from './about-data'
import { AboutHumans, type HumanCard } from './about-humans'
import {
  ARCHIPELAGOS,
  HUB_TONG,
  PLACE_SINCE,
  REGIONAL_HUBS,
  initials,
  people,
  person,
  unitHref,
} from './about-hubs'
import { AboutMap, type MapHub } from './about-map'
import { VIETNAM_VIEW, WORLD_VIEW, project } from './about-map-geo'
import { AboutMilestones } from './about-milestones'
import styles from './about.module.css'

/**
 * DEMO-HOME-ABOUT-01 — About HUB v2, a full rebuild against the PO frames
 * DM02 (page), DM03 (HUB popup), DM04 / DM05 (Humans of HUB tabs).
 *
 * Content: the S1-UAT-08A copy, people, photos, milestones and activities are
 * reused verbatim; the frame decides the composition. Counts are canonical
 * (catalogue: 11 regional HUBs of 13 Chapters, 55 CLBs) wherever the frame's
 * sample numbers differ (DEMO-HOME-ABOUT-01 §4; SOT conflicts C1, C4). The
 * ecosystem renders the frame's 7-row visual list (DEMO-D11); the business
 * list stays open. ABOUT-PARTNERS-PRESENTATION-01: no partner list is
 * approved (DEC-THAO-ABOUT-D4 "Real partners await PO data"), so the frame's
 * placeholder partner wall is not rendered; an ecosystem row without a
 * supplied URL (iHUB Incubator, APEC Innovation Challenge; DEMO_SOT C2) is a
 * plain row, with no arrow or click affordance.
 */

const FOUNDED = 2021
const DEMO_YEAR = 2026

const card = (h: Human): HumanCard => ({
  name: h.name,
  title: h.title,
  photo: h.photo?.src ?? null,
  initials: initials(h.name),
})

const ECOSYSTEM: Array<{ label: string; name: string; text: string; href: string | null }> = [
  { label: 'XÁC THỰC', name: '1Hub', text: 'Định danh cá nhân', href: ECOSYSTEM_LINKS.oneHub },
  {
    label: 'CHƯƠNG TRÌNH ĐỔI MỚI SÁNG TẠO',
    name: 'APEC Innovation Challenge',
    text: 'Chương trình kết nối hệ sinh thái đổi mới sáng tạo 21 nền kinh tế APEC, hưởng ứng năm APEC Việt Nam 2027',
    href: ECOSYSTEM_LINKS.apecInnovationChallenge,
  },
  {
    label: 'ĐÀO TẠO · TUYỂN DỤNG',
    name: 'iHUB Incubator',
    text: 'Chương trình đổi mới sáng tạo, đào tạo và phát triển đội ngũ',
    href: ECOSYSTEM_LINKS.ihubIncubator,
  },
  {
    label: 'AI HỖ TRỢ',
    name: 'AI - Cofounder',
    text: 'Công cụ hỗ trợ hoàn thiện MVP',
    href: ECOSYSTEM_LINKS.aiCofounder,
  },
  {
    label: 'INCUBATOR',
    name: 'Builder Camp',
    text: 'Chương trình ươm tạo startup founder toàn cầu về Việt Nam xây dựng doanh nghiệp',
    href: ECOSYSTEM_LINKS.builderCamp,
  },
  {
    label: 'QUỸ ĐẦU TƯ',
    name: 'iHUB Ventures',
    text: 'Kết nối đầu tư giai đoạn đầu',
    href: ECOSYSTEM_LINKS.ihubVentures,
  },
  {
    label: 'QUỸ ĐẦU TƯ',
    name: 'Vietnam’s National Ventures',
    text: 'Quỹ đầu tư mạo hiểm quốc gia',
    href: ECOSYSTEM_LINKS.vnv,
  },
]

export function About({ shell, network }: { shell: PublicShellData; network: AboutNetwork }) {
  const { viewer } = shell
  const bySlug = new Map(network.chapters.map((c) => [c.slug, c]))
  const regional = REGIONAL_HUBS.filter((h) => bySlug.has(h.slug))
  const memberStat = HERO_STATS.find((s) => s.label === 'thành viên')
  const partnerStat = HERO_STATS.find((s) => s.label.startsWith('đối tác'))
  const stats = [
    memberStat ? { value: memberStat.value, label: 'thành viên' } : null,
    { value: String(regional.length), label: 'HUB khu vực' },
    { value: String(network.clubCount), label: 'câu lạc bộ trực thuộc', data: true },
    partnerStat ? { value: partnerStat.value, label: 'đối tác' } : null,
    { value: String(DEMO_YEAR - FOUNDED), label: 'năm thành lập' },
  ].filter((s): s is { value: string; label: string; data?: boolean } => s !== null)

  const mapHubs: MapHub[] = regional.map((h) => {
    const board = people(h.board).map(card)
    return {
      slug: h.slug,
      code: h.code,
      short: h.short,
      place: h.place,
      since: h.since,
      initials: board[0]?.initials ?? h.code,
      world: project(WORLD_VIEW, h.lon, h.lat),
      vietnam: project(VIETNAM_VIEW, h.lon, h.lat),
      board,
      clubs: (bySlug.get(h.slug)?.clubs ?? []).map((c) => ({
        name: c.name,
        href: unitHref(c.slug),
      })),
      href: unitHref(h.slug),
    }
  })
  const archipelagos = ARCHIPELAGOS.map((a) => ({
    name: a.name,
    world: project(WORLD_VIEW, a.lon, a.lat),
    vietnam: project(VIETNAM_VIEW, a.lon, a.lat),
  }))
  const catalogue = network.chapters.map((c) => ({
    name: c.name,
    href: unitHref(c.slug),
    clubs: c.clubs.map((k) => ({ name: k.name, href: unitHref(k.slug) })),
  }))

  const chair = person(HUB_TONG.chair)
  const hubTong = {
    chair: chair ? card(chair) : null,
    deputies: people(HUB_TONG.deputies).map(card),
    advisors: people(HUB_TONG.advisors).map(card),
    boards: HUB_TONG.boards.map((b) => {
      const lead = person(b.lead)
      return { name: b.name, lead: lead ? card(lead) : null }
    }),
  }
  const regions = mapHubs.map((h) => ({
    slug: h.slug,
    short: h.short,
    // THAO-04: the board heading names the unit as the catalogue does.
    name: bySlug.get(h.slug)!.name,
    place: h.place,
    since: h.since,
    clubCount: h.clubs.length,
    chair: h.board[0] ?? null,
    deputies: h.board.slice(1),
    href: h.href,
  }))
  // DM05 order: regional HUBs first (DM04 order), one club of each in turn, so the first cards span the HUBs.
  const rank = (slug: string) => {
    const i = REGIONAL_HUBS.findIndex((h) => h.slug === slug)
    return i < 0 ? REGIONAL_HUBS.length : i
  }
  const lists = [...network.chapters]
    .filter((c) => c.clubs.length)
    .sort((x, y) => rank(x.slug) - rank(y.slug) || x.order - y.order)
    .map((c) => ({
      hub:
        REGIONAL_HUBS.find((h) => h.slug === c.slug)?.short ??
        c.name.replace(/^HUB Network /, 'HUB '),
      clubs: c.clubs,
    }))
  const clubs: Array<{ hub: string; name: string; href: string }> = []
  for (let i = 0; lists.some((l) => i < l.clubs.length); i += 1)
    for (const l of lists) {
      const club = l.clubs[i]
      if (club) clubs.push({ hub: l.hub, name: club.name, href: unitHref(club.slug) })
    }
  // THAO-04: the domestic regional HUBs of the catalogue (the frame lists three).
  const domestic = regional
    .filter((h) => h.place.endsWith('Việt Nam'))
    .sort((x, y) => bySlug.get(x.slug)!.order - bySlug.get(y.slug)!.order)
    .map((h) => bySlug.get(h.slug)!.name.replace(/^HUB Network /, ''))

  const activities = [...ACTIVITIES.filter((a) => a.photo), ...ACTIVITIES.filter((a) => !a.photo)]

  return (
    <div
      className={styles.page}
      data-screen="PUBLIC-ABOUT"
      data-revision="DM02"
      data-entry={viewer.kind}
    >
      <section className={styles.dark}>
        <PublicHeader viewer={viewer} current="about" />

        <div className={styles.hero} data-section="hero">
          <p className={styles.eyebrowPink}>MẠNG LƯỚI NGƯỜI VIỆT TOÀN CẦU</p>
          <h1 className={styles.heroTitle}>HUB Network</h1>
          <p className={styles.heroTagline}>
            Mạng lưới Khởi nghiệp, Đổi mới sáng tạo và Chuyển đổi số
          </p>
          <p className={styles.heroLede}>
            Tổ chức cộng đồng phi lợi nhuận quy tụ người Việt trẻ trên toàn cầu chung niềm đam mê
            khởi nghiệp, đổi mới sáng tạo, cùng chia sẻ tri thức, cộng hưởng nguồn lực và kiến tạo
            giá trị cho Việt Nam.
          </p>
          <div className={styles.heroActions}>
            <PublicAction href={viewer.entry} className={styles.coralBtn} cta="about-join">
              Tham gia HUB Network <ArrowUpRight />
            </PublicAction>
            <PublicAction href={null} className={styles.outlineBtn} cta="partnership">
              Kết nối hợp tác
            </PublicAction>
            <PublicAction
              href={FACEBOOK_URL}
              className={styles.fbBtn}
              label="Facebook HUB Network"
              cta="facebook"
            >
              <svg viewBox="0 0 10 18" width="7" height="13" aria-hidden="true">
                <path
                  d="M6.5 18V9.8h2.7l.4-3.2H6.5v-2c0-.9.3-1.6 1.6-1.6h1.7V.1C9.5.1 8.5 0 7.4 0 5 0 3.3 1.5 3.3 4.2v2.4H.6v3.2h2.7V18z"
                  fill="currentColor"
                />
              </svg>
            </PublicAction>
          </div>
          <ul className={styles.stats} role="list">
            {stats.map((s) => (
              <li
                key={s.label}
                className={styles.stat}
                // Canonical count where the frame draws its own sample (INTENTIONAL-DATA).
                data-pixel={s.data ? 'data' : undefined}
              >
                <p className={styles.statValue}>{s.value}</p>
                <p className={styles.statLabel}>{s.label}</p>
              </li>
            ))}
          </ul>
        </div>

        <section className={styles.values} data-section="values" aria-labelledby="about-values">
          <p id="about-values" className={styles.eyebrowCoral}>
            GIÁ TRỊ CỐT LÕI
          </p>
          <ul className={styles.valueGrid} role="list">
            {VALUES.map((v) => (
              <li key={v.letter} className={styles.value}>
                <p className={styles.valueLetter} aria-hidden="true">
                  {v.letter}
                </p>
                <h2 className={styles.valueTitle}>
                  {v.letter}
                  {v.rest}
                </h2>
                <p className={styles.valueText}>{v.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.scale} data-section="scale" aria-labelledby="about-scale">
          <p className={styles.eyebrowCoral}>QUY MÔ CỘNG ĐỒNG</p>
          <div className={styles.scaleHead}>
            <h2 id="about-scale" className={styles.scaleTitle}>
              {regional.length} HUB Khu vực
            </h2>
            <p className={styles.scaleHint}>
              Di chuyển con trỏ chuột để xem nhanh, bấm vào các điểm sáng tương ứng để mở chi tiết
              hồ sơ HUB Khu vực
            </p>
          </div>
          <AboutMap hubs={mapHubs} archipelagos={archipelagos} catalogue={catalogue} />
        </section>

        <section className={styles.humans} data-section="humans" aria-labelledby="about-humans">
          <p className={styles.eyebrowCoral}>HUMANS OF HUB</p>
          <h2 id="about-humans" className={styles.humansTitle}>
            Những người đang dẫn dắt mạng lưới
          </h2>
          <PublicAction href={PUBLIC_ROUTES.talents} className={styles.underlineLight}>
            Tìm thành viên <ArrowRight />
          </PublicAction>
          <AboutHumans
            hubTong={hubTong}
            regions={regions}
            domestic={domestic}
            clubs={clubs}
            clubTotal={network.clubCount}
            talents={PUBLIC_ROUTES.talents}
          />
        </section>
      </section>

      <section className={styles.light}>
        <section className={styles.ecosystem} data-section="ecosystem" aria-labelledby="about-eco">
          <p className={styles.eyebrowRed}>
            HỆ SINH THÁI <span>HUB</span>
          </p>
          <h2 id="about-eco" className={styles.lightTitle}>
            Từ cộng đồng đến vốn đầu tư
          </h2>
          <ul className={styles.ecoList} role="list">
            {ECOSYSTEM.map((e) => (
              <li key={e.name}>
                {e.href ? (
                  <PublicAction href={e.href} className={styles.ecoRow} label={e.name}>
                    <span className={styles.ecoLabel}>{e.label}</span>
                    <span className={styles.ecoName}>{e.name}</span>
                    <span className={styles.ecoText}>{e.text}</span>
                    <span className={styles.ecoArrow} aria-hidden="true">
                      <ArrowUpRight />
                    </span>
                  </PublicAction>
                ) : (
                  // No URL supplied: plain text, nothing to click (no arrow, no hover).
                  <div className={styles.ecoRow} data-eco="static">
                    <span className={styles.ecoLabel}>{e.label}</span>
                    <span className={styles.ecoName}>{e.name}</span>
                    <span className={styles.ecoText}>{e.text}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={styles.milestones} data-section="milestones" aria-labelledby="about-ms">
          <p className={styles.eyebrowRed}>DẤU ẤN PHÁT TRIỂN</p>
          <h2 id="about-ms" className={styles.lightTitle}>
            {DEMO_YEAR - FOUNDED} năm kết nối và mở rộng
          </h2>
          <AboutMilestones milestones={MILESTONES} places={PLACE_SINCE} />
        </section>

        <section
          className={styles.activities}
          data-section="activities"
          aria-labelledby="about-act"
        >
          <div className={styles.activitiesHead}>
            <p id="about-act" className={styles.eyebrowRed}>
              HOẠT ĐỘNG TIÊU BIỂU
            </p>
            <PublicAction href={PUBLIC_ROUTES.events} className={styles.underline}>
              Xem lịch sự kiện <ArrowRight />
            </PublicAction>
          </div>
          <ul className={styles.activityTrack} role="list">
            {activities.map((a) => (
              <li key={a.row} className={styles.activity}>
                <div className={styles.activityArt}>
                  {a.photo ? (
                    <Image
                      src={a.photo.src}
                      alt={a.photo.alt}
                      fill
                      sizes="421px"
                      style={{ objectFit: 'cover' }}
                    />
                  ) : null}
                </div>
                <p className={styles.activityMeta}>
                  {[a.tagLabel, a.organisers[0]?.toLocaleUpperCase('vi') ?? a.time]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                <h3 className={styles.activityTitle}>{a.title}</h3>
              </li>
            ))}
          </ul>
        </section>
      </section>

      <section className={styles.band} data-section="closing" aria-labelledby="about-closing">
        <h2 id="about-closing" className={styles.bandTitle}>
          Cùng kiến tạo
          <br />
          những sáng kiến mới
          <br />
          cho hệ sinh thái đổi mới sáng tạo Việt Nam.
        </h2>
        <p className={styles.bandText}>
          Dù bạn là cá nhân đang tìm kiếm cộng đồng, một tổ chức muốn mở rộng hợp tác hay một đối
          tác mong muốn đóng góp nguồn lực, HUB Network luôn sẵn sàng cùng bạn tạo nên những kết nối
          có ý nghĩa.
        </p>
        <div className={styles.heroActions}>
          <PublicAction href={viewer.entry} className={styles.inkBtn} cta="closing-join">
            Tham gia HUB Network <ArrowUpRight />
          </PublicAction>
          <PublicAction href={null} className={styles.inkOutline} cta="closing-partnership">
            Kết nối hợp tác
          </PublicAction>
        </div>
      </section>

      <PublicFooter variant="about" legal={shell.legal} />
    </div>
  )
}
