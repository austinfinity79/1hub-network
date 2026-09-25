import type { InputHTMLAttributes } from 'react'

/**
 * M0-T04 — text input primitive.
 *
 * A native <input>. `invalid` drives aria-invalid rather than colour alone, so
 * the error state is conveyed non-visually as well. `describedBy` is wired by
 * Field to point at the helper and error text.
 */
export type TextInputProps = {
  id: string
  invalid?: boolean
  describedBy?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id' | 'aria-invalid'>

export function TextInput({
  id,
  invalid = false,
  describedBy,
  type = 'text',
  ...rest
}: TextInputProps) {
  return (
    <input
      {...rest}
      id={id}
      type={type}
      className="ui-input"
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
    />
  )
}
