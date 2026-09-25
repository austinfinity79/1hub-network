import type { LabelHTMLAttributes, ReactNode } from 'react'

/**
 * M0-T04 — Label primitive.
 *
 * A native <label>. `htmlFor` is required rather than optional so a label can
 * never ship unassociated; Field supplies it automatically.
 */
export type LabelProps = {
  htmlFor: string
  children: ReactNode
} & Omit<LabelHTMLAttributes<HTMLLabelElement>, 'className' | 'htmlFor'>

export function Label({ htmlFor, children, ...rest }: LabelProps) {
  return (
    <label {...rest} htmlFor={htmlFor} className="ui-label">
      {children}
    </label>
  )
}
