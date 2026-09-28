/**
 * Deterministic geometry for the About page diagrams. Pure functions of their
 * inputs, rounded to 0.01 px, so server and client render identical SVG
 * (hydration-safe: no Math.random, no layout reads).
 */

export type Point = { x: number; y: number }

const r2 = (n: number) => Math.round(n * 100) / 100

/** `count` points evenly on a circle, the first at the top, clockwise. */
export function ring(
  cx: number,
  cy: number,
  radius: number,
  count: number,
  startDeg = -90,
): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const a = ((startDeg + (360 / count) * i) * Math.PI) / 180
    return { x: r2(cx + radius * Math.cos(a)), y: r2(cy + radius * Math.sin(a)) }
  })
}

/** Point at `dist` from `from`, continuing the direction centre → from, rotated by `deg`. */
export function outward(center: Point, from: Point, dist: number, deg: number): Point {
  const base = Math.atan2(from.y - center.y, from.x - center.x) + (deg * Math.PI) / 180
  return { x: r2(from.x + dist * Math.cos(base)), y: r2(from.y + dist * Math.sin(base)) }
}

/** Small seeded PRNG (mulberry32) for the illustrative outer dust ring. */
function prng(seed: number) {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

/** Illustrative dots scattered in an annulus (the pack's "vòng ngoài mang tính minh hoạ"). */
export function dust(
  cx: number,
  cy: number,
  inner: number,
  outer: number,
  count: number,
  seed: number,
) {
  const rnd = prng(seed)
  return Array.from({ length: count }, () => {
    const a = rnd() * Math.PI * 2
    const d = inner + (outer - inner) * rnd()
    return { x: r2(cx + d * Math.cos(a)), y: r2(cy + d * Math.sin(a)), r: r2(0.8 + rnd() * 1.1) }
  })
}
