import Link from 'next/link'

import type { WizardVenture } from './project-wizard'
import styles from './wizard.module.css'

/**
 * L13c PRJ3 subset (TASK 22.3, DEC-L2-D4). Facts only from the server: the
 * type, the status (a new venture is DRAFT, readable by its team only), and
 * the pending invitations. One next action, the existing editor. Not rendered:
 * the completeness count and the review-to-public line (Bucket B), and the
 * problem library and public-profile cards (Bucket C).
 */

const TYPE = { PROJECT: 'Dự án', STARTUP: 'Startup' } as const
const STATUS: Record<string, string> = { DRAFT: 'Nháp', ACTIVE: 'Đang hoạt động' }

const COPY = {
  created: 'đã được tạo',
  teamOnly: 'chỉ đội thấy',
  pending: 'lời mời đang chờ',
  lede: 'Hồ sơ đang ở trạng thái nháp — chỉ đội của bạn nhìn thấy.',
  title: { PROJECT: 'Hoàn thiện hồ sơ dự án', STARTUP: 'Hoàn thiện hồ sơ startup' },
  body: 'Cập nhật tên, mô tả, lĩnh vực và tỉnh / thành phố bất cứ lúc nào.',
  action: 'Hoàn thiện hồ sơ',
} as const

export function WizardDone({ venture, pending }: { venture: WizardVenture; pending: number }) {
  const status = STATUS[venture.status]
  return (
    <div data-step-form="done">
      <div className={styles.doneDisc} aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M4.5 12.5 9.5 19 19.5 2.5" />
        </svg>
      </div>
      <h1 className={`${styles.title} ${styles.doneTitle}`}>
        {venture.name} {COPY.created}
      </h1>
      <p className={styles.doneChips}>
        <span className={styles.pill}>{TYPE[venture.type]}</span>
        {status ? (
          <span className={`${styles.pill} ${styles.pillStatus}`}>
            {status} · {COPY.teamOnly}
          </span>
        ) : null}
        {pending > 0 ? (
          <span className={`${styles.pill} ${styles.pillAlert}`}>
            {pending} {COPY.pending}
          </span>
        ) : null}
      </p>
      {venture.status === 'DRAFT' ? <p className={styles.lede}>{COPY.lede}</p> : null}
      <ol className={styles.nextList}>
        <li className={styles.nextCard} data-next="edit">
          <span className={styles.nextIndex}>01</span>
          <div className={styles.nextText}>
            <p className={styles.nextTitle}>{COPY.title[venture.type]}</p>
            <p className={styles.nextBody}>{COPY.body}</p>
          </div>
          <Link
            href={`/projects/${venture.id}/edit`}
            className="ui-button"
            data-variant="primary"
            data-nav="venture-edit"
          >
            <span>{COPY.action}</span>
          </Link>
        </li>
      </ol>
    </div>
  )
}
