import { Arrow, Cta, Eyebrow, type Action } from './landing-parts'
import type { LandingLinks } from './landing'
import shared from './landing.module.css'
import styles from './network.module.css'

/**
 * Homepage dark sections (all-in-one, network) and the closing call to action,
 * in reference order (DEC-H1-R2).
 */

const STEPS = [
  {
    title: 'Hồ sơ dùng xuyên suốt nhiều chương trình',
    text: 'Thông tin đã có được lưu lại và tái sử dụng, giảm việc khai báo lặp lại.',
  },
  {
    title: 'Quản lý hồ sơ tham gia',
    text: 'Theo dõi chương trình đã đăng ký, trạng thái hồ sơ.',
  },
  {
    title: 'Ghi nhận hành trình hoạt động',
    text: 'Ghi nhận vai trò trong chương trình, nhận xét của hội đồng, hoạt động cố vấn, giải thưởng, dự án thử nghiệm khái niệm, pilot và kết quả triển khai.',
  },
  {
    title: 'Mở rộng cơ hội tiếp theo',
    text: 'Tăng khả năng được tìm thấy bởi đối tác phù hợp.',
    chips: [
      'Kết nối giải pháp',
      'Đầu tư',
      'Tuyển dụng',
      'Hợp tác thương mại',
      'Hỗ trợ mở rộng thị trường',
    ],
  },
]

export function AllInOne({
  links,
  memberLabel,
}: {
  links: LandingLinks
  memberLabel: string | null
}) {
  return (
    <section className={styles.allInOne} data-section="all-in-one" aria-labelledby="profile-title">
      <div className={styles.aioHead}>
        <div>
          <Eyebrow className={shared.white}>ALL-IN-ONE</Eyebrow>
          <h2 id="profile-title" className={styles.aioTitle}>
            One profile —<br />
            Endless
            <br />
            opportunities
          </h2>
        </div>
        <div className={styles.aioSide}>
          <p className={styles.aioText}>
            Tạo một hồ sơ cho bạn, đội ngũ và startup. Dùng lại thông tin khi tham gia chương trình,
            đồng thời ghi nhận những hoạt động và kết quả nổi bật theo thời gian.
          </p>
          <Cta
            action={{ href: links.entry }}
            label={memberLabel ?? 'Tạo tài khoản'}
            className={`${shared.coralPill} ${styles.aioCta}`}
            cta="primary"
          >
            {memberLabel ?? 'Tạo tài khoản'} <Arrow />
          </Cta>
        </div>
      </div>
      <div className={styles.aioProgress} aria-hidden="true" />
      <ol className={styles.steps}>
        {STEPS.map((s, i) => (
          <li key={s.title} className={`${styles.step} ${i > 1 ? styles.stepDim : ''}`}>
            <span className={styles.stepIndex}>{String(i + 1).padStart(2, '0')}</span>
            <h3 className={styles.stepTitle}>{s.title}</h3>
            <p className={styles.stepText}>{s.text}</p>
            {s.chips ? (
              <ul className={styles.stepChips}>
                {s.chips.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
      <p className={styles.aioNote}>
        Hồ sơ có thể tiếp tục hoàn thiện từ các hoạt động bạn tham gia trên 1hub.network.
      </p>
    </section>
  )
}

const DOORS = [
  {
    door: 'CỬA 01',
    title: 'Giải pháp & Startup',
    text: 'Khám phá các giải pháp và startup theo lĩnh vực, giai đoạn phát triển, thị trường và chương trình đã tham gia.',
    chips: [
      'Lĩnh vực',
      'Giai đoạn phát triển',
      'Thị trường mục tiêu',
      'Địa điểm',
      'Chương trình đã tham gia',
    ],
  },
  {
    door: 'CỬA 02',
    title: 'Nhà sáng lập & Nhà đổi mới sáng tạo',
    text: 'Khám phá các cá nhân theo vai trò, lĩnh vực, chuyên môn, địa điểm và hành trình hoạt động.',
    chips: ['Lĩnh vực', 'Vai trò hiện tại', 'Chuyên môn'],
  },
]

export function Network() {
  return (
    <section className={styles.network} data-section="network" aria-labelledby="network-title">
      <h2 id="network-title" className={styles.networkTitle}>
        Mạng lưới đổi mới sáng tạo
      </h2>
      <p className={styles.networkText}>
        Dữ liệu trên 1hub.network không chỉ dựa trên thông tin tự khai. Mỗi hồ sơ được bổ sung qua
        quá trình tham gia chương trình, xác thực vai trò, đánh giá năng lực, cố vấn, thử nghiệm và
        triển khai thực tế.
      </p>
      <div className={styles.doors} data-anchor="doors">
        {DOORS.map((d) => (
          <div key={d.door} className={styles.door}>
            <p className={styles.doorLabel}>{d.door}</p>
            <h3 className={styles.doorTitle}>{d.title}</h3>
            <p className={styles.doorText}>{d.text}</p>
            <ul className={styles.doorChips}>
              {d.chips.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <Cta
              action={{ inert: 'FUTURE' }}
              label="Khám phá mạng lưới"
              className={styles.doorLink}
            >
              Khám phá mạng lưới <Arrow />
            </Cta>
          </div>
        ))}
      </div>
    </section>
  )
}

export function Closing({ network }: { network: Action }) {
  const columns: Array<{
    title: string
    text: string
    action: Action
    label: string
    cta?: string
  }> = [
    {
      title: 'Khám phá cơ hội',
      text: 'Dành cho cá nhân, đội ngũ và startup muốn tham gia chương trình, sự kiện và tiếp cận nguồn lực.',
      action: { href: '#co-hoi' },
      label: 'Khám phá cơ hội',
      cta: 'closing-opportunities',
    },
    {
      title: 'Tổ chức chương trình',
      text: 'Xây dựng và quản lý các sự kiện, chương trình đổi mới sáng tạo',
      action: { inert: 'NO_P0_SCREEN' },
      label: 'Triển khai chương trình',
    },
    {
      title: 'Tìm kiếm nhân tài và giải pháp',
      text: 'Khám phá mạng lưới giải pháp, startup, nhà sáng lập và nhà đổi mới sáng tạo.',
      action: network,
      label: 'Khám phá mạng lưới',
      cta: 'closing-network',
    },
  ]
  return (
    <section className={styles.closing} data-section="closing" aria-labelledby="closing-title">
      <h2 id="closing-title" className={styles.closingTitle}>
        Let’s build what’s next.
        <br />
        Together, for Vietnam.
      </h2>
      <div className={styles.closingCols}>
        {columns.map((c) => (
          <div key={c.title} className={styles.closingCol}>
            <h3 className={styles.closingColTitle}>{c.title}</h3>
            <p className={styles.closingColText}>{c.text}</p>
            <Cta action={c.action} label={c.label} className={styles.closingLink} cta={c.cta}>
              {c.label} <Arrow />
            </Cta>
          </div>
        ))}
      </div>
    </section>
  )
}
