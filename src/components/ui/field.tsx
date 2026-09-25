'use client'

import { useId, type ReactNode } from 'react'

import { FieldMessage } from './field-message'
import { Label } from './label'

/**
 * M0-T04 — field wrapper.
 *
 * Owns the accessibility wiring that is easy to get wrong by hand: it generates
 * stable ids, associates the label with the control, and points
 * aria-describedby at whichever of helper/error is present.
 *
 * The control is supplied through a render prop so the wrapper stays agnostic
 * about which control it wraps, and so no control can be rendered without the
 * ids it needs.
 */
export type FieldControlProps = {
  id: string
  invalid: boolean
  describedBy: string | undefined
}

export type FieldProps = {
  label: ReactNode
  /** Rendered as role="alert" and marks the control invalid. */
  error?: string
  /** Static guidance, suppressed while an error is showing. */
  helper?: string
  children: (props: FieldControlProps) => ReactNode
}

export function Field({ label, error, helper, children }: FieldProps) {
  const base = useId()
  const controlId = `${base}-control`
  const errorId = `${base}-error`
  const helperId = `${base}-helper`

  const invalid = Boolean(error)
  // An error replaces the helper rather than stacking with it, so the control
  // is described by exactly one message at a time.
  const describedBy = invalid ? errorId : helper ? helperId : undefined

  return (
    <div className="ui-field" data-invalid={invalid ? 'true' : undefined}>
      <Label htmlFor={controlId}>{label}</Label>
      {children({ id: controlId, invalid, describedBy })}
      {error ? (
        <FieldMessage id={errorId} tone="error">
          {error}
        </FieldMessage>
      ) : helper ? (
        <FieldMessage id={helperId} tone="helper">
          {helper}
        </FieldMessage>
      ) : null}
    </div>
  )
}
