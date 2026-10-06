/**
 * DEMO-HOME-ABOUT-01 — the Miller projection of the two About map views, the
 * same constants that generated `public/about/map-world.svg` and
 * `map-vietnam.svg` (Natural Earth, public domain, via world-atlas 2.0.2).
 * The world view is fitted to the DM02 map card (1312 × 640): the frame's
 * London, New York, Dubai, Singapore and Sydney markers land within 2 px.
 */

export const MAP_W = 1312
export const MAP_H = 640

type View = { k: number; x0: number; y0: number }

const rad = Math.PI / 180
const millerY = (lat: number) => 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * rad))

export const WORLD_VIEW: View = { k: 208.8, x0: 613.4, y0: 412.9 }
export const VIETNAM_VIEW: View = {
  k: 1834.5431563648606,
  x0: -2866.0700183345584,
  y0: 800.2242969559821,
}

/** The point as a percentage of the map card, or null outside it. */
export function project(view: View, lon: number, lat: number): { x: number; y: number } | null {
  const x = view.x0 + lon * rad * view.k
  const y = view.y0 - millerY(lat) * view.k
  if (x < 0 || x > MAP_W || y < 0 || y > MAP_H) return null
  return { x: (x / MAP_W) * 100, y: (y / MAP_H) * 100 }
}
