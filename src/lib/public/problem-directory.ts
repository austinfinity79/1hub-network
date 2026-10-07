import { LIBRARY_PROBLEMS } from '@/lib/library/problem-source'
import type { LibraryProblem } from '@/lib/library/problem-adapter'
import { fold } from '@/lib/library/startup-adapter'

/**
 * THAO-05 DIR1 — `/problems` reads the PO static dataset
 * `src/lib/library/dir-bai-toan.json` through the Library adapter
 * (DEC-THAO-DIR-D2, DEC-L15-D9), the same records as the Library's "Bài toán"
 * tab. It is never merged with, deduplicated against or linked to
 * `programmes.metadata.challenge`: the dataset's own `challenge_id` is
 * dropped here, so no programme relation can reach the page. Cards have no
 * destination (READ_ONLY): the dataset has no detail page.
 */

export type DirectoryProblem = {
  /** Dataset id: React key only. */
  key: string
  title: string
  summary: string | null
  org: string | null
  stage: string
  stageLabel: string | null
  prize: string | null
  prizeValue: number | null
  deadline: number | null
  time: string | null
  teams: string | null
  domains: string[]
  areas: string[]
  cover: number | null
  /** Position in the dataset: the tie-break of every order. */
  order: number
  /** Folded search text: title, short title, summary, organisation, domains (the Library's fields). */
  text: string
}

const shape = (p: LibraryProblem, order: number): DirectoryProblem => ({
  key: p.id,
  title: p.title,
  summary: p.summary,
  org: p.org,
  stage: p.stage,
  stageLabel: p.stageLabel,
  prize: p.prize,
  prizeValue: p.prizeValue,
  deadline: p.deadline,
  time: p.time,
  teams: p.teams,
  domains: p.domains,
  areas: p.areas,
  cover: p.cover,
  order,
  text: fold([p.title, p.shortTitle, p.summary, p.org, ...p.domains].filter(Boolean).join(' ')),
})

export function listPublicProblems(): DirectoryProblem[] {
  return LIBRARY_PROBLEMS.map(shape)
}
