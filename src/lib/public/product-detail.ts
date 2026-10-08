import { PUBLIC_ROUTES } from './routes'

/**
 * S2-PRODUCT-CATALOG-CLEANUP-01 — the products whose card may open a product
 * detail page: only those with an approved detail (PRODUCT-DETAIL-SMART-CAMPUS-01).
 * Every other card is shown as is, with no detail link or affordance. One
 * rule for the homepage and /products, so the two cannot drift. Direct routes
 * are unchanged.
 */
export const DETAIL_PRODUCT_SLUGS: readonly string[] = ['1hub-smart-campus-solution']

/** The homepage's highlighted product (the investor carousel's first card). */
export const HIGHLIGHT_PRODUCT_SLUG = '1hub-smart-campus-solution'

export function productDetailHref(slug: string | null | undefined): string | null {
  return slug && DETAIL_PRODUCT_SLUGS.includes(slug) ? `${PUBLIC_ROUTES.products}/${slug}` : null
}
