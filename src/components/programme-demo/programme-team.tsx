'use client'

import { TEAM_ROLE_LABEL } from '@/lib/programme-demo/copy'
import { demoRoutes } from '@/lib/programme-demo/routes'
import type { ProgrammeDemoDetailDTO } from '@/lib/programme-demo/types'

import styles from './journey.module.css'
import { SetupScreen } from './setup-screen'
import pill from './status-pill.module.css'

/**
 * WF04-S06 — operating team (DEC-WF04-H2, DEC-WF04-S06-D1..D3). DISPLAY ONLY:
 * the programme's team rows from the fixture / session copy — display name
 * and the PROGRAMME_ORGANIZER display label, nothing else. No invite, add,
 * remove, role or permission control: this page changes no RoleAssignment,
 * membership, leadership or profile, and a label grants nothing. Back →
 * registration; "Tiếp theo" waits for WF04-S07.
 */

const COPY = {
  back: '← Đăng ký',
  title: 'Đội vận hành',
  hint: 'Những người vận hành chương trình này. Trang này chỉ hiển thị, không thay đổi quyền truy cập.',
  count: (n: number) => `${n} thành viên`,
  empty: 'Chưa có thành viên trong đội vận hành.',
  role: 'Vai trò',
} as const

export function ProgrammeTeam({
  id,
  server,
}: {
  id: string
  server: ProgrammeDemoDetailDTO | null
}) {
  return (
    <SetupScreen
      id={id}
      server={server}
      step="team"
      screen="WF04-S06"
      back={{ href: demoRoutes.setup(id, 'registration'), label: COPY.back, nav: 'team-back' }}
      next={null}
    >
      {({ detail }) => <TeamBody detail={detail} />}
    </SetupScreen>
  )
}

function TeamBody({ detail }: { detail: ProgrammeDemoDetailDTO }) {
  const team = detail.team
  return (
    <section className={styles.card} aria-labelledby="operating-team" data-operating-team>
      <header className={styles.cardHead}>
        <div>
          <h2 id="operating-team" className={`weight-semibold ${styles.cardTitle}`}>
            {COPY.title}
          </h2>
          <p className={`type-meta-xs ${styles.cardHint}`}>{COPY.hint}</p>
          {team.length > 0 ? (
            <p className={`type-meta-xs ${styles.teamCount}`} data-team-count>
              {COPY.count(team.length)}
            </p>
          ) : null}
        </div>
      </header>
      {team.length === 0 ? (
        <p className={`type-body-sm ${styles.empty}`} data-state="team-empty">
          {COPY.empty}
        </p>
      ) : (
        <ul className={styles.list} aria-label={COPY.title}>
          {team.map((member) => (
            <li key={member.id} className={styles.item} data-team-member={member.id}>
              <div className={styles.member}>
                <span className={styles.avatar} aria-hidden="true" />
                <p className={`type-body-sm weight-medium ${styles.memberName}`}>
                  {member.display_name}
                </p>
              </div>
              <span
                className={`weight-medium ${pill.pill} ${styles.role}`}
                aria-label={`${COPY.role}: ${TEAM_ROLE_LABEL[member.role_label] ?? member.role_label}`}
                data-role={member.role_label}
              >
                {TEAM_ROLE_LABEL[member.role_label] ?? member.role_label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
