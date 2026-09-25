/**
 * M0-T04 — the boundary between frozen design values and unresolved ones.
 *
 * Design SOT section 2.5 freezes five colour anchors and section 2.4 freezes the
 * type scale. It explicitly defers everything else: "Other neutral/border/text
 * shades remain screen-baseline-driven until extracted into a broader component
 * token library."
 *
 * A Button still needs a radius and a padding to exist. Rather than quietly
 * adopting a framework default and letting it harden into an unapproved design
 * decision, every such value is declared in the `--unresolved-` namespace,
 * listed here, and asserted by `design-tokens.test.ts`. The prefix makes them
 * greppable, the manifest makes them reviewable, and the test stops one being
 * promoted into the frozen namespace without a SOT change.
 *
 * Each entry names the screen whose approved baseline should settle it.
 */

export type UnresolvedToken = {
  /** CSS custom property name, always `--unresolved-` prefixed. */
  token: string
  /** What the value controls. */
  purpose: string
  /** Provisional value shipped so primitives can render at all. NOT approved. */
  provisional: string
  /** The first approved screen that must settle this value. */
  resolvedBy: string
}

export const UNRESOLVED_TOKEN_PREFIX = '--unresolved-'

export const UNRESOLVED_DESIGN_TOKENS: readonly UnresolvedToken[] = [
  {
    token: '--unresolved-radius-control',
    purpose: 'Corner radius of buttons and text inputs',
    provisional: '0px',
    resolvedBy: 'WF01-S01 auth entry (email field and submit button)',
  },
  {
    token: '--unresolved-radius-surface',
    purpose: 'Corner radius of cards, panels and notices',
    provisional: '0px',
    resolvedBy: 'WF01-S01 auth entry (auth card)',
  },
  {
    token: '--unresolved-shadow-surface',
    purpose: 'Elevation of raised surfaces',
    provisional: 'none',
    resolvedBy: 'WF01-S01 auth entry (auth card)',
  },
  {
    token: '--unresolved-space-control-x',
    purpose: 'Horizontal padding inside controls',
    provisional: '1rem',
    resolvedBy: 'WF01-S01 auth entry',
  },
  {
    token: '--unresolved-space-control-y',
    purpose: 'Vertical padding inside controls',
    provisional: '0.75rem',
    resolvedBy: 'WF01-S01 auth entry',
  },
  {
    token: '--unresolved-space-stack',
    purpose: 'Vertical gap between a label, its control and its message',
    provisional: '0.5rem',
    resolvedBy: 'WF01-S06 onboarding profile (first real form)',
  },
  {
    token: '--unresolved-space-surface',
    purpose: 'Padding inside cards, panels and notices',
    provisional: '1.5rem',
    resolvedBy: 'WF01-S01 auth entry (auth card)',
  },
]

/**
 * Values the Design SOT genuinely froze. Primitives may use these freely.
 * Anything not here and not in the unresolved manifest must not appear as a
 * literal in primitive CSS.
 */
export const FROZEN_COLOR_TOKENS = [
  '--hub-primary',
  '--hub-primary-soft',
  '--hub-burgundy',
  '--hub-canvas',
  '--hub-surface',
] as const

export const SEMANTIC_COLOR_TOKENS = [
  '--color-bg-canvas',
  '--color-bg-surface',
  '--color-bg-accent',
  '--color-bg-accent-soft',
  '--color-fg-default',
  '--color-fg-accent',
  '--color-fg-on-accent',
] as const

export function unresolvedTokenNames(): string[] {
  return UNRESOLVED_DESIGN_TOKENS.map((entry) => entry.token)
}
