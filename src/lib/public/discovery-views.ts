import { PROBLEM_STAGES } from '@/lib/library/problem-adapter'
import type { StartupStage } from '@/lib/library/startup-adapter'

import {
  PARAM,
  many,
  one,
  readLocation,
  type Location,
  type Places,
  type SearchParams,
} from './discovery-query'
import {
  PROBLEM_SORTS,
  PRODUCT_SORTS,
  PROGRAMME_SORTS,
  TALENT_SORTS,
  pickSort,
  type ProblemSort,
  type ProductSort,
  type ProgrammeSort,
  type TalentSort,
} from './discovery-sorts'
import { PHASES, type ProgrammePhase } from './programme-phase'

/**
 * THAO-05 — what each directory's address means (DEC-THAO-DIR). One pure
 * reader per directory, used by the page on the server (first render, refresh,
 * shared link) and by the view in the browser (Back restores the address the
 * view wrote). A value the data does not hold is dropped, never guessed.
 */

/** `location.search` as the record a page receives. */
export function paramsOf(search: string): SearchParams {
  const out: SearchParams = {}
  for (const [key, value] of new URLSearchParams(search)) {
    const prev = out[key]
    out[key] = prev === undefined ? value : [...many(prev), value]
  }
  return out
}

export type ProductView = {
  q: string
  domains: string[]
  stages: StartupStage[]
  location: Location
  sort: ProductSort
}

export function readProductView(
  params: SearchParams,
  data: { domains: string[]; stages: readonly StartupStage[]; places: Places },
): ProductView {
  return {
    q: one(params[PARAM.q]),
    domains: many(params['linh-vuc']).filter((d) => data.domains.includes(d)),
    stages: many(params['giai-doan']).filter((s): s is StartupStage =>
      (data.stages as readonly string[]).includes(s),
    ),
    location: readLocation(params, data.places),
    sort: pickSort(one(params[PARAM.sort], 20), PRODUCT_SORTS, 'hoat-dong'),
  }
}

export type ProgrammeView = {
  q: string
  phases: ProgrammePhase[]
  sort: ProgrammeSort
}

/** S2-PROGRAMME-EVENT-CONTENT-01: no type / host filter; `?loai=` and `?don-vi=` are ignored. */
export function readProgrammeView(params: SearchParams): ProgrammeView {
  return {
    q: one(params[PARAM.q]),
    phases: many(params['trang-thai']).filter((v): v is ProgrammePhase =>
      PHASES.some((p) => p.key === v),
    ),
    sort: pickSort(one(params[PARAM.sort], 20), PROGRAMME_SORTS, 'sap-dien-ra'),
  }
}

export type ProblemView = {
  q: string
  domains: string[]
  stages: string[]
  areas: string[]
  sort: ProblemSort
}

export function readProblemView(
  params: SearchParams,
  data: { domains: string[]; areas: string[] },
): ProblemView {
  return {
    q: one(params[PARAM.q]),
    domains: many(params['linh-vuc']).filter((d) => data.domains.includes(d)),
    stages: many(params['giai-doan']).filter((s) => PROBLEM_STAGES.some((x) => x.value === s)),
    areas: many(params['dia-ban']).filter((a) => data.areas.includes(a)),
    sort: pickSort(one(params[PARAM.sort], 20), PROBLEM_SORTS, 'sap-het-han'),
  }
}

export type TalentView = {
  q: string
  domains: string[]
  location: Location
  sort: TalentSort
}

export function readTalentView(
  params: SearchParams,
  data: { domains: string[]; places: Places },
): TalentView {
  return {
    q: one(params[PARAM.q]),
    domains: many(params['linh-vuc']).filter((d) => data.domains.includes(d)),
    location: readLocation(params, data.places),
    sort: pickSort(one(params[PARAM.sort], 20), TALENT_SORTS, 'ten-a-z'),
  }
}
