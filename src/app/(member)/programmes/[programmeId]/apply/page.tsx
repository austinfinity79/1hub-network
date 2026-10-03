import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import styles from '@/components/application/application.module.css'
import { QuickTeam } from '@/components/application/quick-team'
import { isApiError } from '@/lib/api/errors'
import { getApplyOptions } from '@/lib/application/application'
import { APPLICATION_COPY as COPY } from '@/lib/application/copy'
import { applicationRoutes, type ApplicationOrigin } from '@/lib/application/routes'
import { requireMember } from '@/lib/member/guard'

import { ventureOptions } from '../../../projects/venture-options'

/**
 * TASK 24.4 — /programmes/:programmeId/apply, the L5 entry (DEC-L5-D4). Guest →
 * /auth, back here after sign-in (WF05-PROD-04, G23); onboarding not done → its
 * resolver step. Without a venture that may apply: SUB0 quick team (L37). With
 * one: straight to its form, or to its submitted view. With several: a choice.
 * A closed or unknown programme is 404.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ programmeId: string }> }) {
  const { programmeId } = await params
  const member = await requireMember(applicationRoutes.apply(programmeId))
  let data
  try {
    data = await getApplyOptions(member.accountId, programmeId)
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound()
    throw error
  }
  const { form, options } = data
  const programme = form.programme
  // The form's back link returns where this entry was used from (WF05-PROD-04, G24):
  // the S01 list when the entry goes straight to the form, else this choice.
  const target = (o: (typeof options)[number], from: ApplicationOrigin) =>
    o.application?.status === 'SUBMITTED'
      ? applicationRoutes.submitted(o.venture.id, programme.id)
      : applicationRoutes.form(o.venture.id, programme.id, undefined, from)

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
  if (options.length === 1) redirect(target(options[0]!, 'list'))

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
              <Link href={target(o, 'choose')} className={styles.ghost}>
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
