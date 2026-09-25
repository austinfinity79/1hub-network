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
