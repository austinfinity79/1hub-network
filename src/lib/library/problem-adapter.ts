import { cleanText } from './startup-adapter'

/**
 * LIBRARY DATA UPDATE — adapter for the "Bài toán" tab of /library. The source
 * is the supplied problem dataset (`dir-bai-toan.json`, its `problems` array);
 * nothing in the UI reads one of its field names:
 *
 *   id                        → LibraryProblem.id (required; record dropped without it, or if repeated)
 *   ten                       → title (required)
 *   ten_ngan, mo_ta_ngan      → shortTitle (search only), summary
 *   owner_org.ten             → org
 *   giai_doan                 → stage (canonical code); giai_doan_hien_thi → stageLabel
 *   giai_thuong(_hien_thi)    → prize, only when giai_thuong is set and the text is not "—"
 *   thoi_gian_hien_thi        → time (as supplied; no countdown is computed)
 *   han_nop                   → deadline (the "Sắp hết hạn" order only)
 *   so_doi_du_kien            → teams, only when set
 *   tags.linh_vuc / dia_ban   → domains / areas (filters)
 *   bia_dai_mau_id            → cover (1–6, the card colour band)
 *   challenge_id              → challengeId (kept for grouping; no filter yet)
 *
 * Not shown: owner_org.logo_url (no record has one; the card keeps its blank
 * mark), slug (no detail page), nguon and the other bookkeeping fields.
 * Nothing is invented for a missing value. Pure functions: no I/O here.
 */

export type ProblemStage = 'sap_dien_ra' | 'dang_mo_nop' | 'dang_cham' | 'cong_bo'

export type LibraryProblem = {
  id: string
  title: string
  shortTitle: string | null
  summary: string | null
  org: string | null
  /** Canonical `giai_doan`, as supplied. */
  stage: string
  stageLabel: string | null
  prize: string | null
  prizeValue: number | null
  /** `han_nop` as a day number, for ordering only; null when not set. */
  deadline: number | null
  time: string | null
  teams: string | null
  domains: string[]
  areas: string[]
  cover: number | null
  challengeId: string | null
}

/** The current Library labels, in the sidebar order. */
export const PROBLEM_STAGES: Array<{ value: ProblemStage; label: string }> = [
  { value: 'dang_mo_nop', label: 'Đang mở nộp' },
  { value: 'sap_dien_ra', label: 'Sắp diễn ra' },
  { value: 'dang_cham', label: 'Đang chấm' },
  { value: 'cong_bo', label: 'Đã công bố' },
]

/** A "no prize" display value is not a prize. */
const NO_VALUE = /^[\s—–-]*$/

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

const texts = (value: unknown, max: number): string[] =>
  Array.isArray(value)
    ? [...new Set(value.map((v) => cleanText(v, max)).filter((v): v is string => v !== null))]
    : []

function adaptProblem(raw: unknown): LibraryProblem | null {
  const p = record(raw)
  const id = cleanText(p.id, 120)
  const title = cleanText(p.ten, 240)
  if (!id || !title) return null
  const tags = record(p.tags)
  const prizeText = cleanText(p.giai_thuong_hien_thi, 60)
  const hasPrize = p.giai_thuong !== null && p.giai_thuong !== undefined
  const deadline = typeof p.han_nop === 'string' ? Date.parse(p.han_nop) : Number.NaN
  const teams = p.so_doi_du_kien
  const cover = p.bia_dai_mau_id
  return {
    id,
    title,
    shortTitle: cleanText(p.ten_ngan, 120),
    summary: cleanText(p.mo_ta_ngan, 400),
    org: cleanText(record(p.owner_org).ten, 120),
    stage: cleanText(p.giai_doan, 40) ?? '',
    stageLabel: cleanText(p.giai_doan_hien_thi, 40),
    prize: hasPrize && prizeText && !NO_VALUE.test(prizeText) ? prizeText : null,
    prizeValue: typeof p.giai_thuong === 'number' ? p.giai_thuong : null,
    deadline: Number.isFinite(deadline) ? Math.floor(deadline / 86_400_000) : null,
    time: cleanText(p.thoi_gian_hien_thi, 60),
    teams:
      typeof teams === 'number' && teams > 0
        ? `${teams} đội`
        : typeof teams === 'string'
          ? cleanText(teams, 40)
          : null,
    domains: texts(tags.linh_vuc, 60),
    areas: texts(tags.dia_ban, 80),
    cover: typeof cover === 'number' && Number.isInteger(cover) ? cover : null,
    challengeId: cleanText(p.challenge_id, 120),
  }
}

/** The dataset's `problems`, in the supplied order, minus unusable or repeated records. */
export function adaptProblems(payload: unknown): LibraryProblem[] {
  const list = record(payload).problems
  if (!Array.isArray(list)) return []
  const seen = new Set<string>()
  const out: LibraryProblem[] = []
  for (const raw of list) {
    const problem = adaptProblem(raw)
    if (!problem || seen.has(problem.id)) continue
    seen.add(problem.id)
    out.push(problem)
  }
  return out
}
