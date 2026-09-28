import path from 'node:path'

import { expect, type Page } from '@playwright/test'

import {
  REVISION_FACES,
  assertConditions,
  assertTypography,
  readConditions,
  settle,
} from './capture'
import { REPO_ROOT, resolveOutputPath, resolveReferencePath } from './paths'
import { decodePng, readPng, writePng } from './png'
import { writeJsonReport } from './report'
import { compareSegments, type Rect, type Segment, type SegmentResult } from './segments'

/**
 * TASK 22.2 — pixel audit for a Corrected Design Revision screen whose state
 * the spec has already put on the page (route, persona, fixture, clock).
 *
 * Unlike the M0-T11 manifest runner, text is compared for real: the revision
 * references are set in Space Grotesk and the screen renders it (DEC-HD-12), so
 * a typography mismatch is a defect. Each segment passes when the diff outside
 * text stays under MAX_OUTSIDE and the diff that survives a ±2 px shift stays
 * under MAX_BEYOND_SHIFT (the P0-LANDING rule, DEC-H1-D5).
 */

export const SHIFT_TOLERANCE = 2
export const MAX_OUTSIDE = 0.015
export const MAX_BEYOND_SHIFT = 0.02

export type RevisionAudit = {
  /** Output name, e.g. `WF01-S01.AUTH1`. */
  name: string
  /** Repo-relative reference under design-reference/final/revision. */
  reference: string
  segments: Segment[]
  /** Capture-space regions left out of the comparison (intentional omissions). */
  exclude?: Rect[]
  /** Intentional differences, recorded in the report. */
  intentional?: Array<{ class: string; reason: string }>
  /** Capture the full page, for references taller than the viewport. */
  full?: boolean
}

/** Every visible text box on the page, in capture coordinates. */
export async function textRects(page: Page): Promise<Rect[]> {
  return page.evaluate(() => {
    const rects: { x: number; y: number; width: number; height: number }[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      if (!walker.currentNode.textContent!.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(walker.currentNode)
      for (const r of range.getClientRects())
        rects.push({ x: r.x - 2, y: r.y + scrollY - 2, width: r.width + 4, height: r.height + 4 })
    }
    for (const input of document.querySelectorAll('input')) {
      const r = input.getBoundingClientRect()
      rects.push({ x: r.x + 8, y: r.y + scrollY + 6, width: r.width - 16, height: r.height - 12 })
    }
    return rects
  })
}

export async function auditRevision(page: Page, audit: RevisionAudit): Promise<SegmentResult[]> {
  await settle(page)
  const conditions = await readConditions(page)
  assertConditions(conditions)
  const typography = await assertTypography(page, REVISION_FACES)
  expect(typography.violations, `${audit.name} typography`).toEqual([])

  const actual = decodePng(await page.screenshot({ fullPage: audit.full ?? false }))
  const actualPath = resolveOutputPath(
    'actual',
    `${audit.name}.${audit.full ? 'full' : 'viewport'}.png`,
  )
  writePng(actualPath, actual)
  const reference = readPng(resolveReferencePath(audit.reference))
  const results = compareSegments(reference, actual, audit.segments, await textRects(page), {
    diffPath: resolveOutputPath('diff', `${audit.name}.segments.diff.png`),
    shiftTolerance: SHIFT_TOLERANCE,
    exclude: audit.exclude ?? [],
  })

  writeJsonReport(`${audit.name}.revision.json`, {
    screen: audit.name,
    reference: audit.reference,
    actual: path.relative(REPO_ROOT, actualPath),
    conditions,
    typography,
    shift_tolerance_px: SHIFT_TOLERANCE,
    thresholds: { outside_ratio: MAX_OUTSIDE, beyond_shift_ratio: MAX_BEYOND_SHIFT },
    intentional: audit.intentional ?? [],
    segments: results,
  })
  for (const r of results) {
    expect(r.outside_ratio, `${audit.name} ${r.name} outside-text drift`).toBeLessThan(MAX_OUTSIDE)
    expect(r.beyond_shift_ratio!, `${audit.name} ${r.name} beyond ±2px`).toBeLessThan(
      MAX_BEYOND_SHIFT,
    )
  }
  return results
}

/** Top edge of the first element matching `selector`, in page coordinates. */
export async function topOf(page: Page, selector: string): Promise<number> {
  const box = (await page.locator(selector).first().boundingBox())!
  return Math.round(box.y)
}

/** Left edge of the first element matching `selector`. */
export async function leftOf(page: Page, selector: string): Promise<number> {
  const box = (await page.locator(selector).first().boundingBox())!
  return Math.round(box.x)
}
