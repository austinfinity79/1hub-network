import type { ReactNode } from 'react'

import { Arrow, Cta } from './landing-parts'
import { Rail } from './landing-rail'
import styles from './activities.module.css'
import cards from './activity-cards.module.css'

/**
 * Homepage activity rails, in reference order: events, programmes, investment
 * pipeline (DEC-H1-R2). The cards are the reference's illustrative content,
 * shown verbatim under a visible "Dữ liệu minh hoạ" label; none of them has a
 * destination yet, so every card action is inert.
 */

function Head({
  id,
  title,
  text,
  rule = true,
  narrow,
}: {
  id: string
  title: string
  text: ReactNode
  rule?: boolean
  narrow?: boolean
}) {
  return (
    <>
      <div className={styles.head}>
        <h2 id={id} className={styles.headTitle}>
          {title}
        </h2>
        <span className={styles.demo} data-demo="true">
          DỮ LIỆU MINH HOẠ
        </span>
        {rule ? <span className={styles.headRule} aria-hidden="true" /> : null}
      </div>
      <p className={`${styles.lede} ${narrow ? styles.ledeNarrow : ''}`}>{text}</p>
    </>
  )
}

const EVENTS = [
  {
    day: '12',
    month: 'TH9 · 2026',
    tag: 'NỔI BẬT',
    meta: 'HÀ NỘI · HƠN 40 STARTUP',
    title: 'HUB Demo Day 2026',
    text: 'Ngày hội trình diễn sản phẩm của startup trong mạng lưới.',
    tone: 'ember',
  },
  {
    day: '20',
    month: 'TH9 · 2026',
    tag: 'VÒNG CHUNG KẾT',
    meta: 'TP. HỒ CHÍ MINH · VÒNG CHUNG KẾT',
    title: 'Final Pitch — Open Innovation',
    text: 'Vòng chung kết các bài toán đổi mới sáng tạo mở, hội đồng chấm trực tiếp.',
    tone: 'dusk',
  },
  {
    day: '10',
    month: 'TH10 · 2026',
    tag: '',
    meta: 'ĐÀ NẴNG · KẾT NỐI CỐ VẤN',
    title: 'Founders & Mentors Night',
    text: 'Buổi kết nối giữa founder trong mạng lưới và đội ngũ cố vấn chuyên môn.',
    tone: 'wine',
  },
]

export function Events() {
  return (
    <section className={styles.section} data-section="events" aria-labelledby="events-title">
      <Head
        id="events-title"
        title="Khám phá hoạt động — Sự kiện"
        text="Khám phá workshop, hackathon, ngày hội trình diễn sản phẩm và các sự kiện trong hệ sinh thái đổi mới sáng tạo."
      />
      <Rail label="Sự kiện" rest={0.5056}>
        {EVENTS.map((e) => (
          <li key={e.title} className={cards.event}>
            <div className={cards.art} data-tone={e.tone}>
              <span className={cards.date}>
                <span className={cards.day}>{e.day}</span>
                <span className={cards.month}>{e.month}</span>
              </span>
              {e.tag ? <span className={cards.artTag}>{e.tag}</span> : null}
            </div>
            <p className={cards.meta}>{e.meta}</p>
            <h3 className={cards.cardTitle}>{e.title}</h3>
            <p className={cards.cardText}>{e.text}</p>
            <Cta
              action={{ inert: 'NO_P0_SCREEN' }}
              label={`Chi tiết — ${e.title}`}
              className={cards.more}
            >
              Chi tiết <Arrow />
            </Cta>
          </li>
        ))}
      </Rail>
    </section>
  )
}

const PROGRAMMES = [
  {
    status: 'ĐANG DIỄN RA',
    statusTone: 'coral',
    blank: 123,
    title: 'APEC Innovation Challenge',
    organiser: 'APEC',
    field: 'Đa lĩnh vực',
    tone: 'ember',
  },
  {
    status: 'MỞ',
    statusTone: 'coral',
    blank: 72,
    title: 'Fintech Challenge Vietnam',
    organiser: 'Ngân hàng Nhà nước',
    field: 'Công nghệ tài chính',
    tone: 'dusk',
  },
  {
    status: 'ĐANG DIỄN RA',
    statusTone: 'white',
    blank: 86,
    title: 'Honda Challenge',
    organiser: 'Honda Việt Nam',
    field: 'Logistics',
    tone: 'glow',
  },
]

export function Programmes() {
  return (
    <section
      className={styles.section}
      data-section="programmes"
      aria-labelledby="programmes-title"
    >
      <Head
        id="programmes-title"
        title="Chương trình đổi mới sáng tạo"
        text="Vận hành toàn bộ chương trình trên một nền tảng, hoặc đưa bài toán thực tế đến cộng đồng để tìm kiếm nhân tài, ý tưởng và giải pháp phù hợp."
      />
      <Rail label="Chương trình" rest={0.455}>
        {PROGRAMMES.map((p) => (
          <li key={p.title} className={cards.programme} data-tone={p.tone}>
            <p className={cards.pills}>
              <span className={cards.status} data-tone={p.statusTone}>
                {p.status}
              </span>
              <span className={cards.blank} style={{ width: p.blank }} aria-hidden="true" />
            </p>
            <h3 className={cards.programmeTitle}>{p.title}</h3>
            <dl className={cards.facts}>
              <dt>ĐƠN VỊ TỔ CHỨC</dt>
              <dd>{p.organiser}</dd>
              <dt>LĨNH VỰC</dt>
              <dd>{p.field}</dd>
              <dt>HẠN ĐĂNG KÝ</dt>
              <dd>chưa công bố</dd>
            </dl>
            <Cta
              action={{ inert: 'NO_P0_SCREEN' }}
              label={`Chi tiết — ${p.title}`}
              className={cards.programmeMore}
            >
              Chi tiết <Arrow />
            </Cta>
          </li>
        ))}
      </Rail>
    </section>
  )
}

export function Pipeline() {
  return (
    <section className={styles.section} data-section="pipeline" aria-labelledby="pipeline-title">
      <Head
        id="pipeline-title"
        title="Tiếp cận trực tiếp Pipeline đầu tư"
        text="Quỹ đầu tư trực tiếp tìm kiếm giải pháp, startup và cá nhân theo lĩnh vực, năng lực, giai đoạn phát triển và lịch sử hoạt động."
        rule={false}
        narrow
      />
      <Rail label="Pipeline đầu tư" rest={0.5056}>
        <li className={cards.fund}>
          <div className={cards.browser} aria-hidden="true">
            <span className={cards.browserBar}>ihub.ventures</span>
            <span className={cards.browserNote}>
              <span className={cards.browserMark} />
              ẢNH CHỤP TRANG CHỦ IHUB.VENTURES · CHỜ ẢNH THẬT
            </span>
          </div>
          <p className={cards.fundMeta}>TRANG QUỸ</p>
          <h3 className={cards.fundTitle}>iHUB Ventures</h3>
          <p className={cards.fundText}>Mô tả quỹ · chờ nội dung chính thức</p>
          <Cta
            action={{ inert: 'FUTURE' }}
            label="Truy cập ihub.ventures"
            className={cards.fundMore}
          >
            Truy cập ihub.ventures <Arrow className={cards.out} />
          </Cta>
        </li>
        <li className={cards.asset}>
          <div className={cards.panel} aria-hidden="true">
            <span className={cards.sheet} data-sheet="1" />
            <span className={cards.sheet} data-sheet="2" />
            <span className={cards.sheet} data-sheet="3" />
          </div>
          <p className={cards.meta}>DECK</p>
          <h3 className={cards.cardTitle}>Deck giới thiệu</h3>
          <p className={cards.cardText}>Tên và phiên bản deck · chờ cập nhật</p>
          <Cta action={{ inert: 'FUTURE' }} label="Xem deck" className={cards.more}>
            Xem deck <Arrow />
          </Cta>
        </li>
        <li className={cards.asset}>
          <div className={`${cards.panel} ${cards.panelCentre}`} aria-hidden="true">
            <span className={cards.vault} />
          </div>
          <p className={cards.meta}>DATA ROOM</p>
          <h3 className={cards.cardTitle}>Phòng dữ liệu nhà đầu tư</h3>
          <p className={cards.cardText}>
            Tài liệu mở theo quyền truy cập; mọi lượt xem được ghi nhật ký.
          </p>
          <Cta action={{ inert: 'FUTURE' }} label="Yêu cầu truy cập" className={cards.more}>
            Yêu cầu truy cập <Arrow />
          </Cta>
        </li>
      </Rail>
    </section>
  )
}
