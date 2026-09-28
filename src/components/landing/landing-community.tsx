import { Arrow, Cta } from './landing-parts'
import shared from './landing.module.css'
import styles from './community.module.css'

/**
 * Homepage community section: heading, community numbers, the HUB Network
 * card and the partner matrix (DEC-H1-R2).
 *
 * The matrix shows the reference's placeholder names, not partners: it carries
 * a visible "Dữ liệu minh hoạ" label and no logo or link. `echo` is the
 * decorative run the reference draws after the names; it is hidden from
 * assistive technology.
 */

const METRICS = [
  { value: '10.000+', label: 'thành viên' },
  { value: '13', label: 'mạng lưới khu vực' },
  { value: '~60', label: 'cộng đồng và câu lạc bộ' },
  { value: '200+', label: 'đối tác hệ sinh thái' },
  { value: '2.000+', label: 'startup được hỗ trợ và kết nối', accent: true },
]

type Chip = [name: string, width: number]

/** Names and their widths in the reference at 1440 px (the gap between chips is 14 px). */
const MATRIX: Array<{ label: string; names: Chip[]; echo: Chip[] }> = [
  {
    label: 'DOANH NGHIỆP',
    names: [
      ['Doanh nghiệp A', 177],
      ['Doanh nghiệp B', 178],
      ['Tập đoàn C', 146],
      ['Công ty D', 138],
      ['Doanh nghiệp E', 177],
    ],
    echo: [
      ['Doanh nghiệp A', 177],
      ['Doanh nghiệp B', 178],
    ],
  },
  {
    label: 'ĐƠN VỊ TỔ CHỨC',
    names: [
      ['Hiệp hội B', 139],
      ['Sở KH&CN', 137],
      ['Chapter Cần Thơ', 184],
      ['Chapter Đà Nẵng', 185],
      ['Chương trình A', 172],
    ],
    echo: [
      ['Chương trình A', 172],
      ['Hiệp hội B', 139],
    ],
  },
  {
    label: 'TRƯỜNG ĐẠI HỌC VÀ CÂU LẠC BỘ',
    names: [
      ['Đại học A', 134],
      ['Đại học B', 134],
      ['CLB Khởi nghiệp', 181],
      ['Viện C', 113],
      ['CLB Sáng tạo', 162],
    ],
    echo: [
      ['Đại học A', 134],
      ['Đại học B', 134],
    ],
  },
  {
    label: 'QUỸ ĐẦU TƯ VÀ ƯƠM TẠO',
    names: [
      ['Mạng lưới NĐT', 167],
      ['Quỹ D', 111],
      ['Vườn ươm C', 152],
      ['Quỹ B', 111],
      ['Quỹ A', 110],
    ],
    echo: [
      ['Quỹ A', 110],
      ['Quỹ B', 111],
      ['Vườn ươm C', 152],
    ],
  },
  {
    label: 'ĐỐI TÁC CÔNG NGHỆ',
    names: [
      ['Đối tác Cloud', 161],
      ['Đối tác AI', 135],
      ['Đối tác Dữ liệu', 169],
      ['Đối tác Bảo mật', 178],
      ['Đối tác Hạ tầng', 176],
    ],
    echo: [
      ['Đối tác Cloud', 161],
      ['Đối tác AI', 135],
    ],
  },
]

const chipWidth = (width: number) => ({ '--chip': `${width}px` }) as React.CSSProperties

export function Community() {
  return (
    <section
      className={styles.community}
      id="cong-dong"
      data-section="community"
      aria-labelledby="community-title"
    >
      <h2 id="community-title" className={styles.title}>
        Được xây dựng bởi cộng đồng
      </h2>
      <p className={styles.sub}>
        <span className={shared.redText}>
          Mạng lưới Khởi nghiệp, Đổi mới sáng <br />
          tạo và Chuyển đổi số
        </span>{' '}
        HUB Network
      </p>

      <ul className={styles.metrics} data-anchor="metrics">
        {METRICS.map((m) => (
          <li key={m.label} className={styles.metric}>
            <span className={`${styles.metricValue} ${m.accent ? shared.redText : ''}`}>
              {m.value}
            </span>
            <span className={styles.metricLabel}>{m.label}</span>
          </li>
        ))}
      </ul>

      <div className={styles.card} data-anchor="community-card">
        <div>
          <h3 className={styles.cardTitle}>Khám phá cộng đồng HUB Network toàn cầu</h3>
          <p className={styles.cardText}>
            13 chapter · 9 quốc gia và vùng lãnh thổ · gần 60 câu lạc bộ, và tiếp tục mở rộng.
          </p>
        </div>
        <Cta
          action={{ href: '/about' }}
          label="Tìm hiểu về HUB Network"
          className={`${shared.darkPill} ${shared.darkPillLarge} ${styles.cardCta}`}
          cta="about-community"
        >
          Tìm hiểu về HUB Network <Arrow />
        </Cta>
      </div>

      <div className={styles.matrix} data-anchor="matrix" data-section="partners">
        <p className={styles.demo} data-demo="true">
          DỮ LIỆU MINH HOẠ
        </p>
        {MATRIX.map((row) => (
          <div key={row.label} className={styles.matrixRow}>
            <h3 className={styles.matrixLabel}>{row.label}</h3>
            <div className={styles.matrixTrack} tabIndex={0} role="group" aria-label={row.label}>
              <ul className={styles.chips}>
                {row.names.map(([name, width]) => (
                  <li key={name} className={styles.chip} style={chipWidth(width)}>
                    {name}
                  </li>
                ))}
                {row.echo.map(([name, width]) => (
                  <li
                    key={`echo-${name}`}
                    className={styles.chip}
                    style={chipWidth(width)}
                    aria-hidden="true"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
