import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import styles from '@/components/application/application.module.css'
import { QuickTeam } from '@/components/application/quick-team'
import { isApiError } from '@/lib/api/errors'
import { getApplyOptions } from '@/lib/application/application'
import { APPLICATION_COPY as COPY } from '@/lib/application/copy'
import { applicationRoutes } from '@/lib/application/routes'
import { requireMember } from '@/lib/member/guard'

import { ventureOptions } from '../../../projects/venture-options'

/**
 * TASK 24.4 — /programmes/:programmeId/apply, the L5 entry (DEC-L5-D4). Guest →
 * /auth; onboarding not done → its resolver step. Without a venture that may
 * apply: SUB0 quick team (L37). With one: straight to its form, or to its
 * submitted view. With several: a choice. A closed or unknown programme is 404.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ programmeId: string }> }) {
  const member = await requireMember()
  const { programmeId } = await params
  let data
  try {
    data = await getApplyOptions(member.accountId, programmeId)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
  const { form, options } = data
  const programme = form.programme
  const target = (o: (typeof options)[number]) =>
    o.application?.status === 'SUBMITTED'
      ? applicationRoutes.submitted(o.venture.id, programme.id)
      : applicationRoutes.form(o.venture.id, programme.id)

  if (options.length === 0) {
    const { domains, stages } = await ventureOptions()
    return (
      <QuickTeam
        programmeId={programme.id}
        displayName={member.displayName}
        applicantTypes={form.applicant_types}
        domains={domains}
        stages={stages}
      />
    )
  }
  if (options.length === 1) redirect(target(options[0]!))

  return (
    <div className={styles.page} data-screen="L5-CHOOSE">
      <header className={`${styles.bar} ${styles.barSlim}`}>
        <span className={styles.brand}>HUB NETWORK</span>
        <span className={styles.who}>{member.displayName}</span>
      </header>
      <main className={styles.quick}>
        <span className={styles.chip}>{programme.name}</span>
        <h1 className={styles.quickTitle}>{COPY.chooseTitle}</h1>
        <p className={styles.quickLead}>{COPY.chooseLead}</p>
        <ul className={styles.options}>
          {options.map((o) => (
            <li key={o.venture.id} className={styles.option} data-venture={o.venture.id}>
              <span>
                <span className={styles.ventureName}>{o.venture.name}</span>
                <span className={styles.ventureMeta}>
                  <br />
                  {COPY.types[o.venture.type]}
                  {o.application ? ` · ${COPY.status[o.application.status]}` : ''}
                </span>
              </span>
              <Link href={target(o)} className={styles.ghost}>
                {!o.application
                  ? COPY.open
                  : o.application.status === 'DRAFT'
                    ? COPY.continue
                    : COPY.view}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
