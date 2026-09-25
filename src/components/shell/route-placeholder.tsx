import { routeByPattern, type FrozenRoute } from '@/lib/routes'

/**
 * M0-T03 — scaffolding marker for a frozen route that has no screen yet.
 *
 * Deliberately NOT product UI. Every approved screen is implemented in M1-M3
 * against its own baseline in design-reference/final; nothing here is designed
 * from imagination, and none of this markup survives into those screens.
 *
 * Rendering is driven by the frozen route manifest so a placeholder cannot
 * claim a screen id or route the Screen Contract does not define.
 */
export function RoutePlaceholder({ pattern }: { pattern: string }) {
  const route: FrozenRoute | undefined = routeByPattern(pattern)

  if (!route) {
    throw new Error(`RoutePlaceholder: ${pattern} is not in the frozen route manifest`)
  }

  return (
    <section
      data-route-placeholder={route.screenId}
      data-route-pattern={route.pattern}
      data-placeholder-group={route.group}
      data-workflow={route.workflow}
    >
      <p className="type-mono-meta" style={{ color: 'var(--color-fg-accent)' }}>
        {route.screenId} · {route.workflow} · {route.group}
      </p>
      <h1 className="type-heading-2 mt-2">{route.contractRoute}</h1>
      <p className="type-body-md mt-2">
        Route reserved by the frozen Screen Contract. The screen itself is not implemented yet.
      </p>
    </section>
  )
}
