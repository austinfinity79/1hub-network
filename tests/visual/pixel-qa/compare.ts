import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import { writePng, type Size } from './png'

/**
 * M0-T11 — pixel/geometry comparison.
 *
 * Produces quantitative evidence only. It never decides a V0-V4 class: raw diff
 * percentage is diagnostic, not the pass criterion (Pixel QA section 7), and
 * the approved references pre-date the typography freeze, so text raster
 * differences are expected. Classification is a reviewer step.
 */

export type BoundingBox = { x: number; y: number; width: number; height: number }

export type ComparisonStatus = 'IDENTICAL' | 'DIFFERENT' | 'DIMENSION_MISMATCH'

export type Comparison = {
  status: ComparisonStatus
  reference_size: Size
  actual_size: Size
  /** Pixels that differ beyond the colour threshold. Null on size mismatch. */
  diff_pixels: number | null
  diff_ratio: number | null
  /** Smallest box containing every differing pixel: geometry evidence. */
  diff_bbox: BoundingBox | null
  threshold: number
  max_diff_pixels: number
}

export type CompareOptions = {
  /** pixelmatch colour threshold, 0..1. 0.1 is pixelmatch's own default. */
  threshold?: number
  /** Differing pixels tolerated before the status becomes DIFFERENT. */
  maxDiffPixels?: number
  /** Where to write the diff image. Written whenever sizes match. */
  diffPath?: string
}

// pixelmatch paints differing pixels with this colour by default.
const DIFF_RGB = [255, 0, 0] as const

export function compareImages(
  reference: PNG,
  actual: PNG,
  { threshold = 0.1, maxDiffPixels = 0, diffPath }: CompareOptions = {},
): Comparison {
  const reference_size = { width: reference.width, height: reference.height }
  const actual_size = { width: actual.width, height: actual.height }

  // Different dimensions are a geometry failure in their own right; comparing
  // a cropped overlap would hide exactly that.
  if (reference.width !== actual.width || reference.height !== actual.height) {
    return {
      status: 'DIMENSION_MISMATCH',
      reference_size,
      actual_size,
      diff_pixels: null,
      diff_ratio: null,
      diff_bbox: null,
      threshold,
      max_diff_pixels: maxDiffPixels,
    }
  }

  const { width, height } = reference
  const diff = new PNG({ width, height })
  const diff_pixels = pixelmatch(reference.data, actual.data, diff.data, width, height, {
    threshold,
    diffColor: DIFF_RGB as unknown as [number, number, number],
    includeAA: false,
  })

  const diff_bbox = diff_pixels > 0 ? boundingBoxOfDiff(diff) : null
  if (diffPath) writePng(diffPath, diff)

  return {
    status: diff_pixels <= maxDiffPixels ? 'IDENTICAL' : 'DIFFERENT',
    reference_size,
    actual_size,
    diff_pixels,
    diff_ratio: diff_pixels / (width * height),
    diff_bbox,
    threshold,
    max_diff_pixels: maxDiffPixels,
  }
}

function boundingBoxOfDiff(diff: PNG): BoundingBox | null {
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  const { data, width, height } = diff
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i] === DIFF_RGB[0] && data[i + 1] === DIFF_RGB[1] && data[i + 2] === DIFF_RGB[2]) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** Top `height` rows of `png` (DEC-WF02-H12 step 4: crop, never scale). */
export function cropToHeight(png: PNG, height: number): PNG {
  const out = new PNG({ width: png.width, height })
  PNG.bitblt(png, out, 0, 0, png.width, height, 0, 0)
  return out
}

export type ContinuationCheck = {
  /** First capture row below the reference height. */
  from_y: number
  rows: number
  /** Pixels that differ from the reference's last row in the same column. */
  unexpected_pixels: number
  unexpected_ratio: number
  unexpected_bbox: BoundingBox | null
}

/**
 * DEC-WF02-H12 step 5: below the reference height the capture may only
 * continue the page background. Each pixel there is compared with the
 * reference's LAST row in the same column; any channel differing by more than
 * `tolerance` is unexpected UI.
 */
export function checkContinuation(reference: PNG, actual: PNG, tolerance = 3): ContinuationCheck {
  const from = reference.height
  const rows = Math.max(0, actual.height - from)
  let unexpected = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  for (let y = from; y < actual.height; y++) {
    for (let x = 0; x < actual.width; x++) {
      const a = (y * actual.width + x) * 4
      const r = ((from - 1) * reference.width + x) * 4
      let off = false
      for (let c = 0; c < 3; c++) {
        if (Math.abs(actual.data[a + c]! - reference.data[r + c]!) > tolerance) off = true
      }
      if (off) {
        unexpected++
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return {
    from_y: from,
    rows,
    unexpected_pixels: unexpected,
    unexpected_ratio: rows === 0 ? 0 : unexpected / (rows * actual.width),
    unexpected_bbox:
      maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 },
  }
}
