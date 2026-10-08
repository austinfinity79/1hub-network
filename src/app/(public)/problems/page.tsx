import type { Metadata } from 'next'

import { ProblemDirectory } from '@/components/discovery/problem-directory'
import { PublicFooter } from '@/components/public-shell/public-footer'
import { PublicHeader } from '@/components/public-shell/public-header'
import type { SearchParams } from '@/lib/public/discovery-query'
import { readProblemView } from '@/lib/public/discovery-views'
import { listPublicProblems } from '@/lib/public/problem-directory'
import { publicShellData } from '@/lib/public/shell-data'

import styles from '@/components/discovery/discovery.module.css'

/**
 * THAO-05 DIR1 — `/problems`, the public problem list (DEC-THAO-DIR-D2): the
 * PO static dataset only, read on the server. Public for every visitor; query
 * parameters seed the view, values the dataset does not hold are dropped.
 */
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bài toán — HUB Network',
  description: 'Bài toán đổi mới sáng tạo đang tìm giải pháp trong mạng lưới HUB Network.',
}

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const [params, shell] = await Promise.all([searchParams, publicShellData()])
  const problems = listPublicProblems()
  return (
    <div className={styles.page} data-screen="PUBLIC-PROBLEMS">
      <div className={styles.top}>
        <PublicHeader viewer={shell.viewer} clubCount={shell.clubCount} />
        <ProblemDirectory
          problems={problems}
          initial={readProblemView(params, {
            domains: [...new Set(problems.flatMap((p) => p.domains))],
            areas: [...new Set(problems.flatMap((p) => p.areas))],
          })}
        />
      </div>
      <PublicFooter variant="home" legal={shell.legal} />
    </div>
  )
}
