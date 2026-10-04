import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

import { compareImages } from '../pixel-qa/compare'
import { OUTPUT_DIRS, resolveOutputPath, resolveReferencePath } from '../pixel-qa/paths'
import { readPng } from '../pixel-qa/png'

/**
 * ADMIN-PROD-08 — pixel comparison of the Admin Portal against the PO-approved
 * baseline (ADMIN-DESIGN-01, `design-reference/final/ADMIN/`). Opt-in, like
 * `pixel-qa-screens`: the actual side is produced on a freshly reset database
 * by the capture spec in the same run,
 *
 *   ADMIN_DESIGN_CAPTURE=1 ADMIN_DESIGN_OUT=tests/visual/actual/pixel-qa \
 *   ADMIN_PIXEL_QA=1 pnpm visual admin-design-01-capture admin-prod-08-pixel
 *
 * Classes: MATCH (identical at pixelmatch 0.1), MINOR (≤ 0.1 % of pixels —
 * raster noise), REGRESSION (dimension change or more than that), KNOWN_DEBT
 * (every 390 frame: compared and reported, never blocking). A REGRESSION frame
 * fails unless a reviewer lists it in STRUCTURAL_APPROVED with the decision
 * that approved the change. Raw diff images and the matrix are written under
 * the Pixel QA output dirs; nothing is ever written to design-reference/.
 */

test.skip(!process.env.ADMIN_PIXEL_QA, 'ADMIN_PIXEL_QA not set')

const REFERENCE_DIR = 'design-reference/final/ADMIN'
const MINOR_RATIO = 0.001
/** Frame file → decision that approved a structural difference. None so far. */
const STRUCTURAL_APPROVED: Record<string, string> = {}

type Row = {
  file: string
  viewport: string
  status: string
  class: 'MATCH' | 'MINOR' | 'STRUCTURAL_APPROVED' | 'REGRESSION' | 'KNOWN_DEBT'
  diff_pixels: number | null
  diff_ratio: number | null
  diff_bbox: unknown
}

test('every approved Admin frame matches the baseline (REAL_VISUAL_REGRESSION = 0)', () => {
  const sums = readFileSync(resolveReferencePath(`${REFERENCE_DIR}/SHA256SUMS`), 'utf8')
  const files = sums
    .trim()
    .split('\n')
    .map((line) => line.split(/\s+/)[1]!)
  expect(files.length).toBe(82)
  const frames = (
    JSON.parse(
      readFileSync(resolveReferencePath(`${REFERENCE_DIR}/capture-matrix.json`), 'utf8'),
    ) as {
      frames: { file: string; viewport: string; status: string }[]
    }
  ).frames

  const rows: Row[] = []
  for (const file of files) {
    const meta = frames.find((f) => f.file === file)!
    const actualPath = path.join(OUTPUT_DIRS.actual, file)
    expect(existsSync(actualPath), `${file}: capture it first (see header)`).toBe(true)
    const result = compareImages(
      readPng(resolveReferencePath(`${REFERENCE_DIR}/${file}`)),
      readPng(actualPath),
      { diffPath: resolveOutputPath('diff', file.replace(/\.png$/, '__diff.png')) },
    )
    const ratio = result.diff_ratio
    const cls: Row['class'] =
      meta.status === 'KNOWN_DEBT'
        ? 'KNOWN_DEBT'
        : result.status === 'IDENTICAL'
          ? 'MATCH'
          : ratio !== null && ratio <= MINOR_RATIO
            ? 'MINOR'
            : STRUCTURAL_APPROVED[file]
              ? 'STRUCTURAL_APPROVED'
              : 'REGRESSION'
    rows.push({
      file,
      viewport: meta.viewport,
      status: meta.status,
      class: cls,
      diff_pixels: result.diff_pixels,
      diff_ratio: ratio,
      diff_bbox: result.diff_bbox,
    })
  }

  mkdirSync(OUTPUT_DIRS.reports, { recursive: true })
  writeFileSync(
    resolveOutputPath('reports', 'admin-prod-08-pixel.json'),
    JSON.stringify({ reference: REFERENCE_DIR, rows }, null, 2),
  )
  const regressions = rows.filter((r) => r.class === 'REGRESSION').map((r) => r.file)
  expect(regressions, 'REAL_VISUAL_REGRESSION').toEqual([])
})
