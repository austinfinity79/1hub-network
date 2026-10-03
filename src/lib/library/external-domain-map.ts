import type { VocabRef } from './canonical-source'
import type { Category } from './startup-adapter'

/**
 * WF06-PROD-02 (DEC-W6P-D02) — the reviewed map from the external feed's filter
 * categories to canonical DOMAIN vocabulary slugs. An entry applies only when an
 * ACTIVE DOMAIN item with exactly this slug exists in the database the server
 * reads; otherwise the external record carries no domain value and matches no
 * domain filter. Nothing here creates, renames or guesses vocabulary.
 *
 * DOMAIN values are configuration (Data Freeze D5): the production slug list is
 * confirmed by the HUB / PO before promotion; until then unmatched entries stay
 * inert. IT and OTHER have no single DOMAIN equivalent and are left unmapped.
 */
export const EXTERNAL_CATEGORY_DOMAIN_SLUG: Readonly<Partial<Record<Category, string>>> = {
  LOGISTICS: 'logistics',
  FINTECH: 'fintech',
  HEALTH: 'healthtech',
  AGRI: 'agritech',
  EDU: 'edtech',
  AI: 'ai',
  ENV: 'climate-tech',
}

/** The canonical DOMAIN items an external record's categories map to (deduplicated, in order). */
export function externalDomains(
  categories: readonly Category[],
  domainsBySlug: ReadonlyMap<string, VocabRef>,
): VocabRef[] {
  const out: VocabRef[] = []
  for (const category of categories) {
    const slug = EXTERNAL_CATEGORY_DOMAIN_SLUG[category]
    const domain = slug ? domainsBySlug.get(slug) : undefined
    if (domain && !out.some((d) => d.id === domain.id)) out.push(domain)
  }
  return out
}
