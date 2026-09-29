import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { OnboardingShell } from '@/components/shell/onboarding-shell'
import { Surface } from '@/components/ui'
import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { listPendingClaims } from '@/lib/onboarding/roles'
import { getOnboardingState, routeFor } from '@/lib/onboarding/state'
import { getProfileCompletion } from '@/lib/profile/completion'

import styles from './complete.module.css'

/**
 * ACC-10 — /onboarding/complete. Next: WF02-S01 /me.
 * Reference: design-reference/final/revision/L1/ACC-10__onboarding-complete__SOURCE.png
 * Decisions DEC-L1R-D6, D7; DEC-WF01-S08-D5..D7 still hold.
 *
 * The page completes nothing: "Hoàn tất hồ sơ" on ACC-09 does, and only a
 * completed account sees this screen (refresh and revisit included). No
 * session → /auth; onboarding still open → its current step.
 *
 * Next actions (BA workbook row 61) are drawn only for routes that exist:
 * "Lập hồ sơ đội" → /projects/new, and "Theo dõi xác minh chức vụ HUB" →
 * /me/roles when a membership request named in stage 3 waits for its unit.
 * The board's challenge card has no production route and is not drawn. The
 * percent is the server's.
 */
export const dynamic = 'force-dynamic'

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = await resolveSession(token)
  if (!session) redirect('/auth')

  const state = await getOnboardingState(session.accountId)
  if (!state.completed) redirect(routeFor(state))

  const [completion, claims] = await Promise.all([
    getProfileCompletion(session.accountId),
    listPendingClaims(session.accountId),
  ])
  const claim = claims[0]

  const actions = [
    {
      key: 'project',
      title: 'Lập hồ sơ đội',
      body: 'Hồ sơ dự án hoặc startup, dùng lại cho mọi chương trình.',
      href: '/projects/new',
      label: 'Lập hồ sơ đội',
      nav: 'create-project',
    },
    ...(claim
      ? [
          {
            key: 'hub-claim',
            title: 'Theo dõi xác minh chức vụ HUB',
            body: claim.position
              ? `Yêu cầu xác minh “${claim.position}” đã gửi đến ${claim.organization.name}. Vị trí ghi “Chờ xác minh” cho đến khi đơn vị xác nhận.`
              : `Yêu cầu tham gia đã gửi đến ${claim.organization.name}. Trạng thái ghi “Chờ xác minh” cho đến khi đơn vị xác nhận.`,
            href: '/me/roles',
            label: 'Xem trạng thái',
            nav: 'hub-claim',
          },
        ]
      : []),
  ]

  return (
    <OnboardingShell
      stage={5}
      caption="HỒ SƠ ĐÃ HOÀN TẤT"
      action={
        <Link href="/me" data-nav="exit-me">
          Vào Tài khoản của tôi
        </Link>
      }
    >
      <div className={styles.card} data-screen="ACC-10">
        <Surface as="section">
          <div className={styles.done} aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M6 12.5 10.5 17 18.5 7" />
            </svg>
          </div>
          <h1 className={styles.title}>Hồ sơ của bạn đã sẵn sàng</h1>
          <p className={styles.lede}>Không làm gì cũng được — mọi thứ vẫn ở đó.</p>
          <ol className={styles.cards}>
            {actions.map((action, i) => (
              <li key={action.key} className={styles.action} data-action-card={action.key}>
                <span className={styles.index}>{String(i + 1).padStart(2, '0')}</span>
                <div className={styles.actionText}>
                  <p className={styles.actionTitle}>{action.title}</p>
                  <p className={styles.actionBody}>{action.body}</p>
                </div>
                <Link
                  href={action.href}
                  className="ui-button"
                  data-variant="secondary"
                  data-nav={action.nav}
                >
                  <span>{action.label}</span>
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.info} data-completion>
            <span className={styles.icon} aria-hidden="true">
              i
            </span>
            <p className={styles.infoText}>
              Hồ sơ của bạn đang ở mức {completion.percent}%. Bạn có thể cập nhật hồ sơ bất cứ lúc
              nào.
            </p>
          </div>
        </Surface>
      </div>
    </OnboardingShell>
  )
}
