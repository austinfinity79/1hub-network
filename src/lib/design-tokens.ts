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
  // `provisional` now carries the value MEASURED from the approved WF01-S01
  // baseline for every token that screen settles. They stay in the
  // `--unresolved-` namespace because no SOT document froze them.
  {
    token: '--unresolved-radius-control',
    purpose: 'Corner radius of buttons, text inputs and notices',
    provisional: '0.5rem (8px, measured WF01-S01 email field, submit button, notice)',
    resolvedBy: 'WF01-S01 auth entry (email field and submit button)',
  },
  {
    token: '--unresolved-radius-surface',
    purpose: 'Corner radius of cards and panels',
    provisional: '0.875rem (14px, measured WF01-S01 auth card)',
    resolvedBy: 'WF01-S01 auth entry (auth card)',
  },
  {
    token: '--unresolved-shadow-surface',
    purpose: 'Elevation of raised surfaces',
    provisional: '0 0.5rem 1.875rem burgundy 7% (measured WF01-S01 auth card falloff)',
    resolvedBy: 'WF01-S01 auth entry (auth card)',
  },
  {
    token: '--unresolved-space-control-x',
    purpose: 'Horizontal padding inside controls',
    provisional: '1rem (measured WF01-S01 email field text inset)',
    resolvedBy: 'WF01-S01 auth entry',
  },
  {
    token: '--unresolved-space-control-y',
    purpose: 'Vertical padding inside buttons and notices',
    provisional: '0.78125rem (gives the 47px WF01-S01 submit button)',
    resolvedBy: 'WF01-S01 auth entry',
  },
  {
    token: '--unresolved-space-input-y',
    purpose: 'Vertical padding inside text inputs',
    provisional: '0.59375rem (gives the 49px WF01-S01 email field)',
    resolvedBy: 'WF01-S01 auth entry (email field)',
  },
  {
    token: '--unresolved-space-stack',
    purpose: 'Vertical gap between a label, its control and its message',
    provisional: '0.3125rem (measured WF01-S01 email label to field; reconfirm on WF01-S06)',
    resolvedBy: 'WF01-S01 auth entry (email field); reconfirmed by WF01-S06',
  },
  {
    token: '--unresolved-space-surface',
    purpose: 'Padding inside cards and panels',
    provisional: '2.25rem (36px, measured WF01-S01 auth card)',
    resolvedBy: 'WF01-S01 auth entry (auth card)',
  },
  {
    token: '--unresolved-space-notice-x',
    purpose: 'Horizontal padding inside notices',
    provisional: '0.8125rem (measured WF01-S01 one-time link notice)',
    resolvedBy: 'WF01-S01 auth entry (notice)',
  },
  {
    token: '--unresolved-border-control',
    purpose: 'Border of text inputs',
    provisional: 'burgundy 23% over surface (measured WF01-S01 email field)',
    resolvedBy: 'WF01-S01 auth entry (email field)',
  },
  {
    token: '--unresolved-border-surface',
    purpose: 'Hairline border of cards and panels',
    provisional: 'burgundy 12% over surface (measured WF01-S01 auth card)',
    resolvedBy: 'WF01-S01 auth entry (auth card)',
  },
  {
    token: '--unresolved-fill-control',
    purpose: 'Fill of text inputs',
    provisional: 'burgundy 2% over surface (measured WF01-S01 email field)',
    resolvedBy: 'WF01-S01 auth entry (email field)',
  },
  {
    token: '--unresolved-fill-notice',
    purpose: 'Fill of informational notices',
    provisional: 'burgundy 4% over surface (measured WF01-S01 one-time link notice)',
    resolvedBy: 'WF01-S01 auth entry (notice)',
  },
  {
    token: '--unresolved-fg-muted',
    purpose: 'Secondary text: supporting copy, notices, legal lines',
    provisional: 'burgundy 74% over surface (measured WF01-S01 subtitle, notice, legal)',
    resolvedBy: 'WF01-S01 auth entry',
  },
  {
    token: '--unresolved-fg-placeholder',
    purpose: 'Placeholder text in inputs',
    provisional: 'burgundy 38% over surface (measured WF01-S01 email placeholder)',
    resolvedBy: 'WF01-S01 auth entry (email field)',
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
