import type { Comparison } from './compare'
import { resolveOutputPath, toRepoPath } from './paths'
import { writeBuffer } from './png'

/**
 * M0-T11 — structured per-screen QA report.
 *
 * Every report names its three images explicitly, so a reviewer can never
 * confuse which file is the approved reference and which is the capture.
 * Classification is left PENDING_REVIEW: the automated run supplies evidence,
 * and a reviewer applies the Pixel QA section 6 taxonomy.
 */

/** Pixel QA section 6 taxonomy, recorded in every report for the reviewer. */
export const MISMATCH_TAXONOMY = [
  'V0_WRONG_STATE_OR_SOURCE',
  'V1_STRUCTURAL',
  'V2_MAJOR_VISUAL',
  'V3_COMPONENT',
  'V4_RASTER_NOISE',
  'INTENTIONAL_TYPOGRAPHY_MIGRATION',
  'INTENTIONAL_BUSINESS',
] as const

export type CaptureKind = 'viewport' | 'full_page'

export type ReferenceKind = 'APPROVED_DESIGN' | 'HARNESS_REGRESSION'

export type TypographyResult = {
  checked: number
  violations: string[]
}

export type ScreenReport = {
  screen_id: string
  capture: CaptureKind
  route: string | null
  actor: string | null
  /** Which baseline concept the reference belongs to. Never mixed. */
  reference_kind: ReferenceKind
  images: {
    REFERENCE: string
    ACTUAL: string
    DIFF: string | null
  }
  conditions: { viewport: { width: number; height: number }; dpr: number; fonts: string }
  comparison: Comparison
  typography: TypographyResult | null
  classification: {
    status: 'PENDING_REVIEW' | 'NOT_APPLICABLE'
    taxonomy: typeof MISMATCH_TAXONOMY
  }
  product_pixel_pass_claimed: false
}

export type ReportInput = Omit<
  ScreenReport,
  'images' | 'classification' | 'product_pixel_pass_claimed'
> & {
  referencePath: string
  actualPath: string
  diffPath: string | null
}

export function buildReport(input: ReportInput): ScreenReport {
  const { referencePath, actualPath, diffPath, ...rest } = input
  return {
    ...rest,
    images: {
      REFERENCE: toRepoPath(referencePath),
      ACTUAL: toRepoPath(actualPath),
      DIFF: diffPath ? toRepoPath(diffPath) : null,
    },
    classification: {
      status: input.comparison.status === 'IDENTICAL' ? 'NOT_APPLICABLE' : 'PENDING_REVIEW',
      taxonomy: MISMATCH_TAXONOMY,
    },
    product_pixel_pass_claimed: false,
  }
}

export function reportFileName(screenId: string, capture: CaptureKind): string {
  return `${screenId}.${capture}.json`
}

export function writeJsonReport(fileName: string, data: unknown): string {
  const file = resolveOutputPath('reports', fileName)
  writeBuffer(file, `${JSON.stringify(data, null, 2)}\n`)
  return file
}
