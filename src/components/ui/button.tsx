import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * M0-T04 — Button primitive.
 *
 * A native <button>. Never a clickable div: keyboard activation, focus order
 * and the disabled semantic all come free from the element.
 *
 * Loading implies disabled so a form cannot be submitted twice, and sets
 * aria-busy so assistive technology announces the pending state. The visible
 * label is never swapped out, because changing copy mid-action is disorienting.
 */
export type ButtonProps = {
  variant?: 'primary' | 'secondary'
  loading?: boolean
  children: ReactNode
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'>

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className="ui-button"
      data-variant={variant}
      data-loading={loading ? 'true' : undefined}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? (
        <span className="ui-button__spinner" data-testid="button-spinner" aria-hidden="true" />
      ) : null}
      <span>{children}</span>
    </button>
  )
}
