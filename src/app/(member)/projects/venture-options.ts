import { listActiveItems } from '@/lib/vocabulary/vocabulary'

type Option = { id: string; label: string }
type Linked = { id: string; label: string } | null

/**
 * Selector options for the venture form: ACTIVE items only, plus any archived
 * item the venture already links, kept visible and selected but never offered
 * anew (DEC-WF02-VENTURE-TAXONOMY-STORAGE; as WF01-S06/WF02-S02).
 */
export async function ventureOptions(region: Linked = null, domains: Option[] = []) {
  const [regions, active] = await Promise.all([
    listActiveItems(['REGION']),
    listActiveItems(['DOMAIN']),
  ])
  const regionOptions: Option[] = regions.map((r) => ({ id: r.id, label: r.label }))
  if (region && !regionOptions.some((r) => r.id === region.id)) regionOptions.unshift(region)
  const linked = new Set(domains.map((d) => d.id))
  const domainOptions: Option[] = [
    ...domains,
    ...active.filter((d) => !linked.has(d.id)).map((d) => ({ id: d.id, label: d.label })),
  ]
  return { regions: regionOptions, domains: domainOptions }
}
