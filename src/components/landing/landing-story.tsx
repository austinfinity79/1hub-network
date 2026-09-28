import { Eyebrow } from './landing-parts'
import shared from './landing.module.css'
import styles from './story.module.css'

/**
 * Homepage story sections, in reference order: pain, solution, opportunities.
 * Copy follows the latest Homepage export (DEC-H1-R2).
 */

const PAIN = [
  {
    title: 'Cơ hội phân tán',
    text: 'Các nhà sáng lập tìm kiếm chương trình, nguồn lực qua nhiều kênh.',
  },
  {
    title: 'Mỗi chương trình gần như bắt đầu lại từ đầu',
    text: 'Đơn vị tổ chức phải tạo lại biểu mẫu và quy trình.',
  },
  {
    title: 'Giá trị sau chương trình khó được tiếp nối',
    text: 'Dữ liệu người tham gia, các mối quan hệ hình thành trong chương trình khó được theo dõi và khai thác cho các cơ hội tiếp theo.',
  },
  {
    title: 'Khó tìm đúng người, đúng giải pháp',
    text: 'Doanh nghiệp, nhà đầu tư và tổ chức hỗ trợ thiếu dữ liệu để tìm đúng người, đúng giải pháp.',
  },
]

export function Pain() {
  return (
    <section className={styles.pain} data-section="pain" aria-labelledby="pain-title">
      <div className={styles.painLeft}>
        <Eyebrow className={shared.red}>ĐIỂM NGHẼN</Eyebrow>
        <h2 id="pain-title" className={styles.painTitle}>
          Hệ sinh thái <br />
          không thiếu <br />
          hoạt động. Điều <br />
          còn thiếu là sự <br />
          kết nối.
        </h2>
        <p className={styles.painText}>
          1hub.network kết nối từng hoạt động thành một hành trình liên tục —{' '}
          <span className={shared.redText}>
            nơi dữ liệu được kế thừa, năng lực được ghi nhận và các kết nối tiếp tục phát triển.
          </span>
        </p>
      </div>
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
    </section>
  )
}

const AUDIENCES = [
  { title: 'Nhà đổi mới sáng tạo, Nhà sáng lập và Startup', tag: 'SỰ KIỆN' },
  { title: 'Đơn vị tổ chức, Doanh nghiệp và Đơn vị đặt đề', tag: 'CHƯƠNG TRÌNH' },
  { title: 'Quỹ đầu tư, Đơn vị ươm tạo và Nhà tuyển dụng', tag: 'IHUB VENTURES' },
]

export function Opportunities() {
  return (
    <section
      className={styles.opportunities}
      id="co-hoi"
      data-section="opportunities"
      aria-labelledby="opportunities-title"
    >
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
    </section>
  )
}
