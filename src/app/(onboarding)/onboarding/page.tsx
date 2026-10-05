import Link from 'next/link'

import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { Surface } from '@/components/ui'
import { requireOnboardingStage } from '@/lib/onboarding/guard'

import styles from './intro.module.css'
import stage from './stage.module.css'
import { Spark } from './spark'

/**
 * ACC-05 — /onboarding. The entry to the four-stage onboarding (BA workbook
 * rows 55–56; DEC-L1R-D3). Next: ACC-06 /onboarding/profile.
 * Reference: design-reference/final/revision/L1/ACC-05__onboarding-intro__SOURCE.png
 *
 * The page writes nothing. "Bắt đầu" opens stage 1; "Để sau" leaves to the
 * public homepage, and member pages bring an unfinished account back here.
 * The AI block is drawn as on the board and has nothing to press: no provider
 * is configured (D-A1), and the manual flow is complete without it.
 */
export const dynamic = 'force-dynamic'

const STAGES = ['Thông tin cơ bản', 'Chuyên môn', 'Vai trò trong hệ sinh thái', 'Hoàn tất'] as const

const AI_TOPICS = [
  'Giới thiệu ngắn',
  'Vai trò hiện tại',
  'Lĩnh vực hoạt động',
  'Chuyên môn',
  'Kinh nghiệm nổi bật',
  'Liên kết nghề nghiệp',
] as const

export default async function Page() {
  await requireOnboardingStage('INTRO')

  return (
    <OnboardingShell
      stage={0}
      action={
        <Link href="/" data-nav="onboarding-later">
          Để sau
        </Link>
      }
    >
      <div className={styles.card} data-screen="ACC-05">
        <Surface as="section">
          <h1 className={styles.title}>Hoàn thiện hồ sơ để bắt đầu</h1>
          <p className={styles.lede}>
            Hồ sơ giúp bạn đăng ký chương trình nhanh hơn, giới thiệu năng lực và kết nối với những
            cá nhân, tổ chức phù hợp trong hệ sinh thái.
          </p>

          <ol className={styles.stages} data-anchor="stages">
            {STAGES.map((name, i) => (
              <li key={name} className={styles.stage}>
                <span className={styles.stageIndex}>{String(i + 1).padStart(2, '0')}</span>
                <span className={styles.stageName}>{name}</span>
              </li>
            ))}
          </ol>
          <p className={styles.note}>
            Chỉ cần thông tin tối thiểu để bắt đầu. Bạn có thể lưu ở bất kỳ bước nào và hoàn thiện
            hồ sơ dần.
          </p>

          <section className={styles.ai} data-anchor="ai" aria-labelledby="ai-title">
            <div className={styles.aiHead}>
              <span className={styles.aiBadge} aria-hidden="true">
                <Spark className={styles.spark} />
                AI
              </span>
              <h2 id="ai-title" className={styles.aiTitle}>
                Hoàn thiện hồ sơ nhanh hơn với AI
              </h2>
            </div>
            <p className={styles.aiBody}>
              Tải CV hoặc cung cấp thông tin hiện có. AI sẽ gợi ý nội dung cho hồ sơ để bạn rà soát
              và chỉnh sửa.
            </p>
            <p className={styles.aiCaption}>AI CÓ THỂ HỖ TRỢ GỢI Ý</p>
            <ul className={styles.aiChips}>
              {AI_TOPICS.map((topic) => (
                <li key={topic} className={styles.aiChip}>
                  <Spark className={styles.spark} />
                  {topic}
                </li>
              ))}
            </ul>
            <p className={styles.aiNote}>
              <span className={styles.aiNoteLabel}>GHI CHÚ</span>
              Thông tin do AI đề xuất sẽ không được lưu hoặc công khai cho đến khi bạn xác nhận.
            </p>
          </section>

          <div className={styles.footer} data-anchor="footer">
            <Link href="/" className="ui-button" data-variant="secondary" data-nav="later">
              <span>Để sau</span>
            </Link>
            <span className={stage.spacer} />
            <Link
              href="/onboarding/profile"
              className="ui-button"
              data-variant="primary"
              data-nav="start"
            >
              <span>Bắt đầu</span>
            </Link>
          </div>
        </Surface>
      </div>
    </OnboardingShell>
  )
}
