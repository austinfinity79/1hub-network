import type { ReactNode } from 'react'

/**
 * M0-T04 — helper and error message primitive.
 *
 * An error carries role="alert" so it is announced when validation fails.
 * Helper text is static and needs no live region.
 */
export type FieldMessageProps = {
  id: string
  tone: 'helper' | 'error'
  children: ReactNode
}

export function FieldMessage({ id, tone, children }: FieldMessageProps) {
  return (
    <p
      id={id}
      className="ui-field-message"
      data-tone={tone}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {children}
    </p>
  )
}
