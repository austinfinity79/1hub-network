/**
 * S2-NAV-DROPDOWN-V2-01 (NAV-DD) — the navigation usage events nav_menu_open
 * and nav_menu_select, raised in the browser as a `hub:analytics` CustomEvent
 * (no third-party SDK). Persisting them would need a client ingestion endpoint
 * the frozen API contract (05 §10) does not have yet: that is a contract gap,
 * left to an amendment, so nothing is sent off the page here. No personal data.
 */

export type NavMenuKey = 'about' | 'programmes'

export type NavAnalyticsEvent =
  | { name: 'nav_menu_open'; menu: NavMenuKey; via: 'hover' | 'click' | 'keyboard' }
  | {
      name: 'nav_menu_select'
      menu: NavMenuKey
      item: string
      type: 'page' | 'anchor' | 'external'
      href: string
    }

export const NAV_ANALYTICS_EVENT = 'hub:analytics'

export function emitNavEvent(event: NavAnalyticsEvent): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(NAV_ANALYTICS_EVENT, { detail: { ...event, at: new Date().toISOString() } }),
  )
}
