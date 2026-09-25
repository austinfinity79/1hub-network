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
  // WF01-S01 final audit: values measured on ONE screen are recorded here but
  // applied locally by that screen. Only neutrals shared by multiple approved
  // references are global. None of these is SOT-frozen.
  {
    token: '--unresolved-radius-control',
    purpose: 'Corner radius of buttons and text inputs',
    provisional: '0px (WF01-S01 local: 0.5rem)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-radius-surface',
    purpose: 'Corner radius of cards and panels',
    provisional: '0px (WF01-S01 local: 0.875rem; WF02 cards measure ~11px)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-radius-notice',
    purpose: 'Corner radius of notices',
    provisional: 'inherits radius-surface (WF01-S01 local: 0.5rem)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-shadow-surface',
    purpose: 'Elevation of raised surfaces',
    provisional: 'none (WF01-S01 local: 0 0.5rem 1.875rem burgundy 7%)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-space-control-x',
    purpose: 'Horizontal padding inside controls',
    provisional: '1rem (unchanged; WF01-S01 measures the same)',
    resolvedBy: 'WF01-S01 auth entry',
  },
  {
    token: '--unresolved-space-control-y',
    purpose: 'Vertical padding inside buttons and notices',
    provisional: '0.75rem (WF01-S01 local: 0.78125rem; buttons measure 42-47px across references)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-space-input-y',
    purpose: 'Vertical padding inside text inputs',
    provisional:
      'inherits control-y (WF01-S01 local: 0.59375rem; WF02-S02/S05 inputs are 44px, not 49px)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-space-notice-x',
    purpose: 'Horizontal padding inside notices',
    provisional: 'inherits control-x (WF01-S01 local: 0.8125rem)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-space-stack',
    purpose: 'Vertical gap between a label, its control and its message',
    provisional: '0.5rem (WF01-S01 local: 0.3125rem)',
    resolvedBy: 'WF01-S06 onboarding profile (first real form); WF01-S01 measured locally',
  },
  {
    token: '--unresolved-space-surface',
    purpose: 'Padding inside cards and panels',
    provisional: '1.5rem (WF01-S01 local: 2.25rem)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-border-control',
    purpose: 'Border of text inputs',
    provisional: 'canvas, as M0-T04 (WF01-S01 local: burgundy 23% over surface)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-fill-control',
    purpose: 'Fill of text inputs',
    provisional: 'surface, as M0-T04 (WF01-S01 local: burgundy 2% over surface)',
    resolvedBy:
      'WF01-S01 measured locally (auth-entry.module.css); a global value needs multi-reference evidence',
  },
  {
    token: '--unresolved-border-surface',
    purpose: 'Hairline border of cards and panels',
    provisional:
      'burgundy 12% over surface: GLOBAL, the #e4dede hairline occurs in all 24 approved references',
    resolvedBy: 'WF01-S01 auth entry; confirmed across WF01-WF03 references',
  },
  {
    token: '--unresolved-fill-notice',
    purpose: 'Fill of informational notices',
    provisional: 'burgundy 4% over surface: GLOBAL, #f7f4f4 occurs in ~15 approved references',
    resolvedBy: 'WF01-S01 auth entry; confirmed across WF01-WF03 references',
  },
  {
    token: '--unresolved-fg-muted',
    purpose: 'Secondary text: supporting copy, notices, legal lines',
    provisional: 'burgundy 74% over surface: GLOBAL, #534041 occurs in all 24 approved references',
    resolvedBy: 'WF01-S01 auth entry; confirmed across WF01-WF03 references',
  },
  {
    token: '--unresolved-fg-placeholder',
    purpose: 'Placeholder text in inputs',
    provisional:
      'burgundy 38% over surface: GLOBAL, #a79b9b occurs in WF01-S02, S05-S08 and WF03 references',
    resolvedBy: 'WF01-S01 auth entry; confirmed across WF01-WF03 references',
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
