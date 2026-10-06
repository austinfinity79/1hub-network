/**
 * DEMO-HOME-ABOUT-01 — the public destinations of the new public shell
 * (docs/demo-0710/SCREEN_ROUTE_MAP.md, DEMO-D2 / DEMO-D6).
 *
 * A destination is a route only once its screen ships; until then it is
 * `null` and every header, footer or page entry pointing at it renders as a
 * plain label (no dead link, the DEC-AIG-D1 rule). The task that builds a
 * screen sets its route here, and every entry follows.
 */
export type PublicRouteKey =
  'home' | 'about' | 'products' | 'talents' | 'programmes' | 'events' | 'news'

export const PUBLIC_ROUTES: Readonly<Record<PublicRouteKey, string | null>> = {
  home: '/',
  about: '/about',
  /** DM08 Sản phẩm, DEMO-DIR2-01. */
  products: null,
  /** DM09 Nhân tài (reference / P1). */
  talents: null,
  /** DM06 Chương trình, cuộc thi (reference). */
  programmes: null,
  /** DM07 Sự kiện (reference). */
  events: null,
  /** Tin tức: no screen is supplied (Thảo, 06/10). */
  news: null,
}

export function publicRoute(key: PublicRouteKey): string | null {
  return PUBLIC_ROUTES[key]
}

/** The official HUB Network Facebook channel (Thảo, About hero). */
export const FACEBOOK_URL = 'https://www.facebook.com/1hubnetwork'

/**
 * External sites of the HUB ecosystem, as Thảo's table gives them (06/10).
 * `null`: no link supplied, the entry renders without one (SOT conflict C2:
 * the PO is to confirm these URLs; none is invented).
 */
type EcosystemKey =
  | 'oneHub'
  | 'aiCofounder'
  | 'ihubIncubator'
  | 'builderCamp'
  | 'ihubVentures'
  | 'vnv'
  | 'apecInnovationChallenge'

export const ECOSYSTEM_LINKS: Readonly<Record<EcosystemKey, string | null>> = {
  oneHub: 'https://1hub.global/en',
  aiCofounder: 'https://ihub.dream-lab.ai/',
  ihubIncubator: null,
  builderCamp: 'https://ihub.ventures/',
  ihubVentures: 'https://deck.ihub.ventures/',
  vnv: 'https://vnv.ihub.ventures/',
  apecInnovationChallenge: null,
}
