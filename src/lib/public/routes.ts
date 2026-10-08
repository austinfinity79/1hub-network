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
  'home' | 'about' | 'products' | 'talents' | 'programmes' | 'problems' | 'events' | 'news'

export const PUBLIC_ROUTES: Readonly<Record<PublicRouteKey, string | null>> = {
  home: '/',
  about: '/about',
  /** DM08 Sản phẩm (DEMO-DIR2-01). */
  products: '/products',
  /** DM09 Nhân tài (THAO-05, DEC-THAO-DIR-D3): a guest sees the sign-in gate. */
  talents: '/talents',
  /** DM06 Chương trình, cuộc thi (THAO-05, DEC-THAO-DIR-D1): the public list. */
  programmes: '/programmes',
  /** DIR1 Bài toán (THAO-05, DEC-THAO-DIR-D2): no nav entry; linked from /programmes. */
  problems: '/problems',
  /** DM07 Sự kiện (S2-PROGRAMME-EVENT-CONTENT-01): the PO's event sheet. */
  events: '/events',
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
