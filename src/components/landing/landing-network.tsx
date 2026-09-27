import { Arrow, Cta, Eyebrow, type Action } from './landing-parts'
import type { LandingLinks } from './landing'
import shared from './landing.module.css'
import styles from './network.module.css'

/**
 * TASK 22.1 — homepage (H1) sections from all-in-one to closing, in reference
 * order. Omitted placeholder / mock blocks (HD-01) are noted where they sat.
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
      {/* Omitted: the unfinished quote "Hồ sơ các dự án, giải pháp ……" (placeholder, HD-01). */}
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
      <div className={styles.networkNotes}>
        <p>“Đã xác thực” nghĩa là có nguồn đủ thẩm quyền xác nhận — không phải tự khai.</p>
        <p>Người dùng chủ động kiểm soát thông tin công khai và phạm vi chia sẻ dữ liệu.</p>
      </div>
    </section>
  )
}

const CLUSTERS = [
  {
    label: 'CỤM 01',
    title: 'Dựng & thu hồ sơ',
    items: [
      'Landing page và nhận diện riêng',
      'Biểu mẫu đăng ký và tiếp nhận hồ sơ',
      'Quy trình nhiều vòng linh hoạt',
    ],
  },
  {
    label: 'CỤM 02',
    title: 'Vận hành & đánh giá',
    items: [
      'Quản lý người tham gia và đội thi',
      'Quản lý các sự kiện thuộc chương trình',
      'Phân công hội đồng đánh giá và cố vấn',
      'Chấm điểm, nhận xét và lựa chọn',
      'Thông báo và cập nhật trạng thái',
    ],
  },
  {
    label: 'CỤM 03',
    title: 'Sau chương trình',
    items: ['Báo cáo dữ liệu tập trung', 'Theo dõi cố vấn, thử nghiệm và kết quả sau chương trình'],
  },
]

export function ForOrganisers() {
  let n = 0
  return (
    <section className={styles.organisers} data-section="organisers" aria-labelledby="org-title">
      <Eyebrow className={shared.white}>/ DÀNH CHO ĐƠN VỊ TỔ CHỨC</Eyebrow>
      <h2 id="org-title" className={styles.organisersTitle}>
        Vận hành chương trình hôm nay, xây dựng nguồn dữ liệu cho ngày mai
      </h2>
      <p className={styles.organisersText}>
        1hub.network giúp doanh nghiệp, cơ quan, trường đại học, câu lạc bộ và tổ chức hỗ trợ vận
        hành toàn bộ chương trình trên một nền tảng.
      </p>
      <div className={styles.clusters}>
        {CLUSTERS.map((c) => (
          <div key={c.label} className={styles.cluster}>
            <p className={styles.clusterLabel}>{c.label}</p>
            <h3 className={styles.clusterTitle}>{c.title}</h3>
            <ul className={styles.clusterItems}>
              {c.items.map((item) => {
                n += 1
                return (
                  <li key={item}>
                    <span className={styles.clusterIndex}>{String(n).padStart(2, '0')}</span>
                    {item}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
      <p className={styles.dashedNote}>
        <svg className={styles.dashFrame} aria-hidden="true" focusable="false">
          <rect />
        </svg>
        Mỗi chương trình có thể sử dụng tên miền hoặc tên miền phụ riêng, đồng thời liên thông với
        hệ thống hồ sơ và dữ liệu chung của 1hub.network.
      </p>
      <div className={styles.organisersEnd}>
        <div>
          <h3 className={styles.organisersEndTitle}>
            Giá trị không kết thúc
            <br />
            cùng chương trình
          </h3>
          <p className={styles.organisersEndText}>
            Tiếp tục theo dõi, duy trì kết nối và chuyển tiếp những hồ sơ
            <br />
            phù hợp đến các cơ hội tiếp theo.
          </p>
        </div>
        <div className={styles.organisersActions}>
          <Cta
            action={{ inert: 'NO_P0_SCREEN' }}
            label="Triển khai chương trình"
            className={shared.coralPill}
          >
            Triển khai chương trình <Arrow />
          </Cta>
          <Cta
            action={{ inert: 'NO_P0_SCREEN' }}
            label="Trao đổi giải pháp"
            className={shared.outlinePill}
          >
            Trao đổi giải pháp
          </Cta>
        </div>
      </div>
    </section>
  )
}

const LOOP = [
  {
    title: 'Chương trình tạo người dùng',
    text: 'Các cuộc thi, thử thách và sự kiện tạo ra những điểm tiếp cận đầu tiên.',
  },
  {
    title: 'Hoạt động tạo dữ liệu',
    text: 'Quá trình tham gia ghi nhận năng lực, vai trò, giải pháp và kết quả.',
  },
  {
    title: 'Dữ liệu hình thành mạng lưới chất lượng',
    text: 'Hồ sơ giải pháp, startup và cá nhân được liên kết, phân loại, cập nhật và xác thực theo thời gian.',
  },
  {
    title: 'Mạng lưới thu hút nguồn lực',
    text: 'Doanh nghiệp, quỹ đầu tư, đơn vị ươm tạo, nhà tuyển dụng, cơ quan quản lý và đối tác tiếp cận đúng đối tượng.',
  },
  {
    title: 'Nguồn lực tạo ra kết quả mới',
    text: 'Tuyển dụng, cố vấn, ươm tạo, hợp tác, thử nghiệm, đầu tư và mở rộng tiếp tục làm giàu hệ thống dữ liệu.',
  },
]

const FLOW = ['Chương trình', 'Hoạt động', 'Dữ liệu', 'Mạng lưới', 'Kết nối', 'Kết quả mới']

export function Loop() {
  return (
    <section className={styles.loop} data-section="loop" aria-labelledby="loop-title">
      <div className={styles.loopLeft}>
        <Eyebrow className={shared.white}>/ TỪ DỮ LIỆU ĐẾN NHỮNG KẾT NỐI CÓ Ý NGHĨA</Eyebrow>
        <h2 id="loop-title" className={styles.loopTitle}>
          Càng nhiều hoạt động thực, dữ liệu càng có chiều sâu
        </h2>
        <ol className={styles.loopRows}>
          {LOOP.map((r, i) => (
            <li key={r.title} className={i > 1 ? styles.loopDim : undefined}>
              <h3 className={styles.loopRowTitle}>{r.title}</h3>
              <p className={styles.loopRowText}>{r.text}</p>
            </li>
          ))}
        </ol>
        <p className={styles.flow}>
          {FLOW.map((f, i) => (
            <span key={f} className={styles.flowStep}>
              {f}
              {i < FLOW.length - 1 ? <Arrow className={styles.flowArrow} /> : null}
            </span>
          ))}
          <svg className={styles.flowLoop} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path
              d="M10 6a4 4 0 1 1-1.2-2.85M9 1v2.5H6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
          </svg>
        </p>
        <Cta
          action={{ inert: 'FUTURE' }}
          label="Kết nối nguồn lực"
          className={`${shared.coralPill} ${styles.loopCta}`}
        >
          Kết nối nguồn lực <Arrow />
        </Cta>
      </div>
      <LoopDiagram />
    </section>
  )
}

function LoopDiagram() {
  // Static drawing of the reference loop: five numbered nodes on a circle, node 02 lit.
  const cx = 256
  const cy = 263
  const r = 236
  const nodes = [
    { n: '01', a: -90 },
    { n: '02', a: -18 },
    { n: '03', a: 54 },
    { n: '04', a: 126 },
    { n: '05', a: 198 },
  ].map((node) => {
    const rad = (node.a * Math.PI) / 180
    return { ...node, x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
  })
  return (
    <div className={styles.diagram} aria-hidden="true">
      <svg viewBox="0 0 520 530" width="520" height="530" focusable="false">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ffffff" strokeWidth="1" />
        <path
          d={`M ${nodes[0]!.x} ${nodes[0]!.y} A ${r} ${r} 0 0 1 ${nodes[2]!.x} ${nodes[2]!.y}`}
          fill="none"
          stroke="#fc523c"
          strokeWidth="1.5"
        />
        {nodes.map((node) => (
          <g key={node.n}>
            <circle
              cx={node.x}
              cy={node.y}
              r={node.n === '02' ? 38 : 31}
              fill={node.n === '02' ? '#fc523c' : '#160002'}
              stroke={node.n === '02' ? 'none' : '#ffffff'}
              strokeWidth="1"
            />
            <text x={node.x} y={node.y + 4.5} textAnchor="middle" className={styles.diagramNode}>
              {node.n}
            </text>
          </g>
        ))}
      </svg>
      <div className={styles.diagramCentre}>
        <p className={styles.diagramLabel}>VÒNG LẶP</p>
        <p className={styles.diagramTitle}>
          Hoạt động tạo
          <br />
          dữ liệu
        </p>
      </div>
    </div>
  )
}

export function Community({ network }: { network: Action }) {
  return (
    <section
      className={styles.community}
      id="cong-dong"
      data-section="community"
      aria-labelledby="community-title"
    >
      <h2 id="community-title" className={styles.communityTitle}>
        Được xây dựng bởi cộng đồng
      </h2>
      <p className={styles.communitySub}>
        HUB Network{' '}
        <span className={shared.redText}>
          Mạng lưới Khởi nghiệp,
          <br />
          Đổi mới sáng tạo và Chuyển đổi số.
        </span>
      </p>
      <p className={styles.communityText}>
        HUB Network đóng góp cộng đồng, kinh nghiệm vận hành chương trình, quan hệ với startup và
        mạng lưới đối tác hệ sinh thái làm nền móng để xây dựng 1hub.network. Từ đó, 1hub.network
        kiểm chứng mô hình, tích luỹ dữ liệu và phát triển nguồn nhà sáng lập, startup chất lượng
        cho hệ sinh thái.
      </p>
      {/* Omitted: community metrics (unverified numbers, HD-01). */}
      <div className={styles.communityCard} data-anchor="community-card">
        <h3 className={styles.communityCardTitle}>Khám phá cộng đồng HUB Network toàn cầu</h3>
        {/* Omitted: the "13 chapter · 9 quốc gia …" line (unverified numbers, HD-01). */}
        <Cta
          action={network}
          label="Tìm hiểu về HUB Network"
          className={`${shared.darkPill} ${shared.darkPillLarge} ${styles.communityCta}`}
          cta="network-community"
        >
          Tìm hiểu về HUB Network <Arrow />
        </Cta>
      </div>
      <p className={styles.communityMono}>1HUB.NETWORK — ĐƯỢC PHÁT TRIỂN BỞI HUB NETWORK</p>
    </section>
  )
}

export function Partners() {
  return (
    <section className={styles.partners} data-section="partners" aria-labelledby="partners-title">
      <h2 id="partners-title" className={styles.partnersTitle}>
        Cùng kết nối nguồn lực với
        <br />
        những tiềm năng mới
      </h2>
      <p className={styles.partnersQuote}>
        Doanh nghiệp, quỹ đầu tư, trường đại học, cơ quan và tổ chức hệ sinh thái cùng đóng
        <br />
        góp bài toán, chuyên môn, cố vấn, thị trường và nguồn lực cho hệ sinh thái.
      </p>
      {/* Omitted: placeholder partner wall and the "200+ đối tác" line (HD-01). */}
      <div className={styles.partnersEnd} data-anchor="partners-cta">
        <Cta
          action={{ inert: 'NO_P0_SCREEN' }}
          label="Kết nối hợp tác"
          className={`${shared.darkPill} ${shared.darkPillLarge}`}
        >
          Kết nối hợp tác <Arrow />
        </Cta>
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
