import type { ReactNode } from 'react'

/**
 * M0-T04 — surface primitive.
 *
 * Structural only: a background, padding and elevation slot for cards and
 * panels. Radius and shadow are unresolved design tokens, so it currently
 * renders flat and square on purpose.
 *
 * `as` lets a caller pick the correct semantic element instead of nesting a
 * div inside a section purely for styling.
 */
export type SurfaceProps = {
  as?: 'div' | 'section' | 'article' | 'aside'
  children: ReactNode
}

export function Surface({ as: Tag = 'div', children }: SurfaceProps) {
  return (
    <Tag className="ui-surface" data-ui="surface">
      {children}
    </Tag>
  )
}
