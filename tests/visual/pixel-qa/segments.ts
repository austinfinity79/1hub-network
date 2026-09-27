import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import { writePng } from './png'

/**
 * Segment comparison, added for WF01-S01, the first production screen.
 *
 * A whole-frame diff cannot separate an approved deviation from real drift.
 * When a documented intentional difference changes vertical geometry (WF01-S01
 * omits the unconfigured provider block, so the card is shorter), the screen is
 * compared as segments instead: each segment is a reference rectangle and a
 * vertical offset into the capture, so regions ABOVE and BELOW the intentional
 * region are still compared strictly, pixel for pixel.
 *
 * Inside each segment, differing pixels are split by a text mask. Differences
 * inside text boxes are expected from the approved font migration
 * (INTENTIONAL-TYPOGRAPHY-MIGRATION, verified separately by the DOM typography
 * contract). Differences OUTSIDE text are geometry, surface or colour drift and
 * must stay at raster-noise level.
 */

export type Rect = { x: number; y: number; width: number; height: number }

export type Segment = {
  name: string
  /** Rectangle in reference coordinates. */
  reference: Rect
  /** Capture y = reference y + dy. */
  dy: number
  /**
   * Capture x = reference x + dx (default 0). Added for WF01-S03, whose
   * state-board panels sit side by side while the runtime card is centred.
   */
  dx?: number
}

export type SegmentResult = {
  name: string
  reference: Rect
  dy: number
  dx: number
  pixels: number
  diff_total: number
  diff_in_text: number
  diff_outside_text: number
  outside_ratio: number
  /**
   * Set when `shiftTolerance` is given: pixels that still differ after allowing
   * each side to match any pixel within that many pixels. Anti-aliasing and
   * sub-pixel placement disappear; a wrong face, size, weight, colour or a
   * displaced block does not (TASK 22.1).
   */
  diff_beyond_shift?: number
  beyond_shift_ratio?: number
}

const crop = (png: PNG, r: Rect): PNG => {
  const out = new PNG({ width: r.width, height: r.height })
  PNG.bitblt(png, out, r.x, r.y, r.width, r.height, 0, 0)
  return out
}

const inside = (x: number, y: number, rects: Rect[]) =>
  rects.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height)

/** Channel distance under which two pixels count as the same colour for the shift check. */
const SAME_COLOUR = 48

function sameColour(a: Buffer | Uint8Array, i: number, b: Buffer | Uint8Array, j: number): boolean {
  return (
    Math.abs(a[i]! - b[j]!) <= SAME_COLOUR &&
    Math.abs(a[i + 1]! - b[j + 1]!) <= SAME_COLOUR &&
    Math.abs(a[i + 2]! - b[j + 2]!) <= SAME_COLOUR
  )
}

/** A pixel of `from` is matched when `to` has the same colour within `radius` pixels. */
function matchedWithin(from: PNG, to: PNG, x: number, y: number, radius: number): boolean {
  const i = (y * from.width + x) * 4
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = Math.min(to.height - 1, Math.max(0, y + dy))
    for (let dx = -radius; dx <= radius; dx++) {
      const xx = Math.min(to.width - 1, Math.max(0, x + dx))
      if (sameColour(from.data, i, to.data, (yy * to.width + xx) * 4)) return true
    }
  }
  return false
}

/** Pixels that differ even when each image may match the other within `radius` pixels. */
function beyondShift(
  ref: PNG,
  act: PNG,
  radius: number,
  skip: (x: number, y: number) => boolean,
): number {
  let count = 0
  for (let y = 0; y < ref.height; y++) {
    for (let x = 0; x < ref.width; x++) {
      if (skip(x, y)) continue
      const i = (y * ref.width + x) * 4
      if (sameColour(ref.data, i, act.data, i)) continue
      if (!matchedWithin(ref, act, x, y, radius) || !matchedWithin(act, ref, x, y, radius)) count++
    }
  }
  return count
}

/**
 * @param textMask rectangles in CAPTURE coordinates that contain text.
 * @param diffPath optional composite written as the segments stacked vertically.
 */
export function compareSegments(
  reference: PNG,
  actual: PNG,
  segments: Segment[],
  textMask: Rect[],
  {
    threshold = 0.1,
    diffPath,
    shiftTolerance,
    exclude = [],
  }: { threshold?: number; diffPath?: string; shiftTolerance?: number; exclude?: Rect[] } = {},
): SegmentResult[] {
  const excluded = exclude
  const results: SegmentResult[] = []
  const diffs: PNG[] = []

  for (const seg of segments) {
    const r = seg.reference
    const dx = seg.dx ?? 0
    const a: Rect = { ...r, x: r.x + dx, y: r.y + seg.dy }
    if (
      r.y < 0 ||
      r.y + r.height > reference.height ||
      a.y < 0 ||
      a.y + a.height > actual.height ||
      r.x < 0 ||
      r.x + r.width > reference.width ||
      a.x < 0 ||
      a.x + a.width > actual.width
    ) {
      throw new Error(`segment ${seg.name} falls outside an image`)
    }
    const ref = crop(reference, r)
    const act = crop(actual, a)
    const diff = new PNG({ width: r.width, height: r.height })
    const total = pixelmatch(ref.data, act.data, diff.data, r.width, r.height, {
      threshold,
      includeAA: false,
    })

    let inText = 0
    for (let y = 0; y < r.height; y++) {
      for (let x = 0; x < r.width; x++) {
        const i = (y * r.width + x) * 4
        const red = diff.data[i] === 255 && diff.data[i + 1] === 0 && diff.data[i + 2] === 0
        if (red && inside(a.x + x, a.y + y, textMask)) inText++
      }
    }
    const outside = total - inText
    const result: SegmentResult = {
      name: seg.name,
      reference: r,
      dy: seg.dy,
      dx,
      pixels: r.width * r.height,
      diff_total: total,
      diff_in_text: inText,
      diff_outside_text: outside,
      outside_ratio: outside / (r.width * r.height),
    }
    if (shiftTolerance !== undefined) {
      const beyond = beyondShift(ref, act, shiftTolerance, (x, y) =>
        inside(a.x + x, a.y + y, excluded),
      )
      result.diff_beyond_shift = beyond
      result.beyond_shift_ratio = beyond / (r.width * r.height)
    }
    results.push(result)
    diffs.push(diff)
  }

  if (diffPath && diffs.length > 0) {
    const width = Math.max(...diffs.map((d) => d.width))
    const height = diffs.reduce((h, d) => h + d.height + 8, 0)
    const sheet = new PNG({ width, height })
    let y = 0
    for (const d of diffs) {
      PNG.bitblt(d, sheet, 0, 0, d.width, d.height, 0, y)
      y += d.height + 8
    }
    writePng(diffPath, sheet)
  }
  return results
}
