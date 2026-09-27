import { Arrow, Cta, Eyebrow, type Action } from './landing-parts'
import type { LandingLinks } from './landing'
import shared from './landing.module.css'
import styles from './story.module.css'

/**
 * TASK 22.1 — homepage (H1) story sections, in reference order: pain,
 * solution, opportunities (bars 01–03), events. Omitted placeholder / mock
 * blocks (HD-01) are noted where they sat.
 */

const PAIN = [
  {
    title: 'Cơ hội phân tán',
    text: 'Các nhà sáng lập tìm kiếm chương trình, sự kiện và nguồn lực trên nhiều kênh khác nhau.',
  },
  {
    title: 'Mỗi chương trình gần như bắt đầu lại từ đầu',
    text: 'Đơn vị tổ chức xây dựng các biểu mẫu, bộ dữ liệu, quy trình mới.',
  },
  {
    title: 'Giá trị sau chương trình khó được tiếp nối',
    text: 'Dữ liệu người tham gia, đội ngũ tiềm năng và các mối quan hệ hình thành trong chương trình khó được theo dõi và khai thác cho các cơ hội tiếp theo.',
  },
  {
    title: 'Khó tìm đúng người, đúng giải pháp',
    text: 'Doanh nghiệp và nhà đầu tư vẫn mất nhiều thời gian để tìm kiếm, sàng lọc và kết nối với startup phù hợp, hầu hết phụ thuộc mạng lưới mối quan hệ cá nhân.',
  },
]

export function Pain() {
  return (
    <section className={styles.pain} data-section="pain" aria-labelledby="pain-title">
      <div className={styles.painLeft}>
        <Eyebrow className={shared.red}>ĐIỂM NGHẼN</Eyebrow>
        <h2 id="pain-title" className={styles.painTitle}>
          Hệ sinh thái không thiếu hoạt động. Điều còn thiếu là một hành trình được kết nối.
        </h2>
        <p className={styles.painText}>
          Mỗi năm có nhiều cuộc thi, sự kiện và chương trình đổi mới sáng tạo diễn ra. Nhưng người
          tham gia, dự án, dữ liệu và các mối quan hệ thường bị phân tán sau từng hoạt động.
        </p>
      </div>
      <div className={styles.painRight}>
        <ol className={styles.painList}>
          {PAIN.map((p, i) => (
            <li key={p.title} className={styles.painItem}>
              <span className={`${styles.painIndex} ${i === 0 ? styles.painIndexActive : ''}`}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <h3 className={styles.painItemTitle}>{p.title}</h3>
                <p className={styles.painItemText}>{p.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className={styles.painClosing}>
          1hub.network{' '}
          <span className={shared.redText}>
            kết nối các điểm rời rạc này
            <br />
            thành một hành trình liên tục
          </span>
        </p>
      </div>
    </section>
  )
}

const SOLUTION = [
  {
    title: 'Hoạt động thật tạo dữ liệu',
    text: 'Vai trò, năng lực, giải pháp, đánh giá và thành tích được ghi nhận trong quá trình tham gia.',
  },
  {
    title: 'Dữ liệu tạo hồ sơ có chiều sâu',
    text: 'Hồ sơ được cập nhật qua nhiều hoạt động, thay vì chỉ dựa trên thông tin tự khai.',
  },
  {
    title: 'Hồ sơ hình thành mạng lưới chất lượng',
    text: 'Cá nhân, đội ngũ và startup được phân loại theo lĩnh vực, năng lực, giai đoạn và mức độ sẵn sàng.',
  },
  {
    title: 'Mạng lưới kết nối đúng nguồn lực',
    text: 'Những hồ sơ phù hợp được kết nối với cơ hội tuyển dụng, cố vấn, ươm tạo, hợp tác, thử nghiệm, đầu tư và mở rộng thị trường.',
  },
]

export function Solution() {
  return (
    <section className={styles.solution} data-section="solution" aria-labelledby="solution-title">
      <Eyebrow className={shared.red}>GIẢI PHÁP</Eyebrow>
      <h2 id="solution-title" className={styles.solutionTitle}>
        Mỗi hoạt động đều để lại giá trị
        <br />
        cho hành trình tiếp theo
      </h2>
      <p className={styles.solutionText}>
        1hub.network kết nối toàn bộ hành trình trên một hạ tầng chung.
      </p>
      <ol className={styles.cards}>
        {SOLUTION.map((c, i) => (
          <li
            key={c.title}
            className={`${styles.card} ${i === SOLUTION.length - 1 ? styles.cardDark : ''}`}
            data-card={i + 1}
          >
            <span className={styles.cardIndex} aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{c.title}</h3>
              <p className={styles.cardText}>{c.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className={styles.solutionClosing}>Biến hoạt động thành dữ liệu, dữ liệu thành cơ hội.</p>
    </section>
  )
}

const AUDIENCES = [
  { title: 'Nhà đổi mới sáng tạo, Nhà sáng lập và Startup', tag: 'BÀI TOÁN' },
  { title: 'Đơn vị tổ chức, Doanh nghiệp và Đơn vị đặt đề', tag: 'CHƯƠNG TRÌNH' },
  { title: 'Quỹ đầu tư, Đơn vị ươm tạo và Nhà tuyển dụng', tag: 'IHUB VENTURES' },
]

function Bar({
  index,
  title,
  label,
  action,
  actionLabel,
  cta,
}: {
  index: string
  title: string
  label: string
  action: Action
  actionLabel: string
  cta?: string
}) {
  return (
    <div className={styles.bar2}>
      <span className={styles.barIndex}>{index}</span>
      <h3 className={styles.barTitle}>{title}</h3>
      <span className={styles.barLabel}>{label}</span>
      <Cta action={action} label={actionLabel} className={shared.darkPill} cta={cta}>
        {actionLabel} <Arrow />
      </Cta>
      <span className={styles.barProgress} aria-hidden="true" />
    </div>
  )
}

export function Opportunities({ links, network }: { links: LandingLinks; network: Action }) {
  return (
    <section
      className={styles.opportunities}
      id="co-hoi"
      data-section="opportunities"
      aria-labelledby="opportunities-title"
    >
      <div className={styles.oppHead}>
        <div>
          <Eyebrow className={shared.red}>GIÁ TRỊ ĐA TẦNG</Eyebrow>
          <h2 id="opportunities-title" className={styles.oppTitle}>
            Hệ sinh thái cơ hội
          </h2>
          <p className={styles.oppText}>Khi dữ liệu đủ tin cậy, nguồn lực có thể đến đúng nơi.</p>
        </div>
        <ol className={styles.audiences}>
          {AUDIENCES.map((a, i) => (
            <li key={a.title} className={styles.audience}>
              <span className={styles.audienceIndex}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.audienceTitle}>{a.title}</span>
              <span className={styles.audienceTag}>{a.tag}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.sub} data-section="sub-1">
        <Bar
          index="01 / 03"
          title="Nhà đổi mới sáng tạo, Nhà sáng lập và Startup"
          label="KHÁM PHÁ BÀI TOÁN"
          action={{ href: links.entry }}
          actionLabel="Tham gia mạng lưới"
          cta="join"
        />
        <p className={styles.subText}>
          Khám phá chương trình, xây dựng hồ sơ, ghi nhận hành trình và tiếp cận các nguồn lực phát
          triển phù hợp.
        </p>
        {/* Omitted: problem tabs, chips and carousel, source note (placeholder, HD-01). */}
      </div>

      <div className={styles.sub} data-section="sub-2">
        <Bar
          index="02 / 03"
          title="Đơn vị tổ chức, Doanh nghiệp và Đơn vị đặt đề"
          label="CHƯƠNG TRÌNH ĐỔI MỚI SÁNG TẠO"
          action={{ inert: 'NO_P0_SCREEN' }}
          actionLabel="Triển khai chương trình"
        />
        <p className={styles.subText}>
          Vận hành toàn bộ chương trình trên một nền tảng, hoặc đưa bài toán thực tế đến cộng đồng
          để tìm kiếm nhân tài, ý tưởng và giải pháp phù hợp.
        </p>
        {/* Omitted: programme heading and carousel (mock programmes, HD-01). */}
        <OrgBox
          anchor="org-programme"
          eyebrow="DÀNH CHO CÁC TỔ CHỨC, DOANH NGHIỆP"
          title={
            <>
              Dự định tổ chức chương trình đổi mới sáng tạo
              <br />
              hoặc cuộc thi khởi nghiệp?
            </>
          }
          text={
            <>
              Đăng tải và vận hành chương trình trên 1hub.network
              <br />
              để kết nối với các nhà đổi mới sáng tạo, nhà nghiên cứu, đội ngũ công nghệ và startup
              tiềm năng.
            </>
          }
          actionLabel="Tạo chương trình"
        />
      </div>

      <div className={styles.sub} data-section="sub-3">
        <Bar
          index="03 / 03"
          title="Quỹ đầu tư, Đơn vị ươm tạo và Nhà tuyển dụng"
          label="IHUB VENTURES · SẢN PHẨM VỆ TINH"
          action={network}
          actionLabel="Khám phá mạng lưới"
          cta="network-investors"
        />
        <p className={styles.subText}>
          Tìm kiếm giải pháp, startup và cá nhân theo lĩnh vực, năng lực, giai đoạn phát triển và
          lịch sử hoạt động.
        </p>
        {/* Omitted: iHUB Ventures, deck and data-room cards (placeholder, HD-01). */}
      </div>
    </section>
  )
}

function OrgBox({
  anchor,
  eyebrow,
  title,
  text,
  actionLabel,
}: {
  anchor: string
  eyebrow: string
  title: React.ReactNode
  text: React.ReactNode
  actionLabel: string
}) {
  return (
    <div className={styles.orgBox} data-anchor={anchor}>
      <div>
        <Eyebrow className={styles.orgEyebrow}>{eyebrow}</Eyebrow>
        <h3 className={styles.orgTitle}>{title}</h3>
        <p className={styles.orgText}>{text}</p>
      </div>
      <Cta action={{ inert: 'NO_P0_SCREEN' }} label={actionLabel} className={shared.coralPill}>
        {actionLabel} <Arrow />
      </Cta>
    </div>
  )
}

export function Events() {
  return (
    <section className={styles.events} data-section="events" aria-labelledby="events-title">
      <Eyebrow className={shared.red}>KHÁM PHÁ HOẠT ĐỘNG</Eyebrow>
      <h2 id="events-title" className={styles.eventsTitle}>
        Sự kiện
      </h2>
      {/* Omitted: mock event rows and "Xem tất cả sự kiện" (no event discovery, HD-09). */}
      <OrgBox
        anchor="org-events"
        eyebrow="DÀNH CHO ĐƠN VỊ TỔ CHỨC SỰ KIỆN"
        title="Bạn muốn tổ chức một sự kiện?"
        text={
          <>
            Đăng tải sự kiện và kết nối với nhà đổi mới sáng tạo, nhà nghiên cứu, đội ngũ công nghệ
            <br />
            và startup có khả năng phát triển và thử nghiệm giải pháp.
          </>
        }
        actionLabel="Tạo sự kiện"
      />
    </section>
  )
}
