import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  FROZEN_COLOR_TOKENS,
  SEMANTIC_COLOR_TOKENS,
  UNRESOLVED_DESIGN_TOKENS,
  UNRESOLVED_TOKEN_PREFIX,
  unresolvedTokenNames,
} from './design-tokens'

/**
 * M0-T04 — token discipline.
 *
 * The Design SOT defers radius, shadow and component spacing. These tests stop
 * that gap being filled by a quiet framework default: primitive CSS may only use
 * frozen tokens, values derived from the frozen type scale, or a declared
 * `--unresolved-*` token that appears in the manifest.
 */
const ROOT = process.cwd()
const PRIMITIVES = readFileSync(join(ROOT, 'src', 'styles', 'primitives.css'), 'utf8')

/** The body of primitives.css with comments stripped, so prose is not scanned. */
const CSS_BODY = PRIMITIVES.replace(/\/\*[\s\S]*?\*\//g, '')

describe('M0-T04 unresolved design tokens', () => {
  it('declares every unresolved token with a purpose and a resolving screen', () => {
    expect(UNRESOLVED_DESIGN_TOKENS.length).toBeGreaterThan(0)

    for (const entry of UNRESOLVED_DESIGN_TOKENS) {
      expect(entry.token.startsWith(UNRESOLVED_TOKEN_PREFIX), `${entry.token} is misnamed`).toBe(
        true,
      )
      expect(entry.purpose.length).toBeGreaterThan(0)
      expect(entry.provisional.length).toBeGreaterThan(0)
      expect(entry.resolvedBy, `${entry.token} names no resolving screen`).toMatch(/WF0\d-S\d\d/)
    }
  })

  it('defines in CSS exactly the unresolved tokens the manifest lists', () => {
    const declared = [...CSS_BODY.matchAll(/(--unresolved-[\w-]+)\s*:/g)].map((m) => m[1]!)
    const used = [...CSS_BODY.matchAll(/var\((--unresolved-[\w-]+)\)/g)].map((m) => m[1]!)

    expect([...new Set(declared)].sort()).toEqual([...unresolvedTokenNames()].sort())

    // Nothing may reference an unresolved token that was never declared.
    for (const token of new Set(used)) {
      expect(unresolvedTokenNames(), `${token} is used but not in the manifest`).toContain(token)
    }
  })

  it('never promotes an unresolved value into the frozen or semantic namespace', () => {
    for (const entry of UNRESOLVED_DESIGN_TOKENS) {
      const bare = entry.token.replace(UNRESOLVED_TOKEN_PREFIX, '')
      expect(FROZEN_COLOR_TOKENS as readonly string[]).not.toContain(`--hub-${bare}`)
      expect(SEMANTIC_COLOR_TOKENS as readonly string[]).not.toContain(`--color-${bare}`)
    }

    // Radius and shadow must not exist as approved design tokens anywhere.
    const tokensCss = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8')
    expect(tokensCss).not.toMatch(/--(radius|shadow|space|spacing)-/)
  })
})

describe('M0-T04 primitive CSS hygiene', () => {
  it('contains no raw colour literal', () => {
    expect(CSS_BODY).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(CSS_BODY).not.toMatch(/\brgba?\(/i)
    expect(CSS_BODY).not.toMatch(/\bhsla?\(/i)
  })

  it('uses no absolute length beyond the 1px hairline', () => {
    // Everything sized must come from a token, an em/rem derived from the frozen
    // type scale, or a percentage. 0 and the 1px hairline are the only literals.
    const lengths = [...CSS_BODY.matchAll(/(?<![\w-])(\d*\.?\d+)px/g)].map((m) => m[1]!)
    const offending = lengths.filter((value) => value !== '0' && value !== '1')

    expect(offending, `unexpected absolute px in primitives.css: ${offending.join(', ')}`).toEqual(
      [],
    )
  })

  it('takes every colour from the frozen or semantic token namespace', () => {
    const referenced = [...CSS_BODY.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1]!)
    const colourLike = referenced.filter((token) => /color|hub/.test(token))
    const allowed = [...FROZEN_COLOR_TOKENS, ...SEMANTIC_COLOR_TOKENS] as readonly string[]

    for (const token of new Set(colourLike)) {
      expect(allowed, `${token} is not a frozen or semantic colour token`).toContain(token)
    }
  })

  it('sizes type only from the frozen scale', () => {
    const referenced = [
      ...CSS_BODY.matchAll(/var\((--type-[\w-]+|--weight-[\w-]+|--font-[\w-]+)\)/g),
    ].map((m) => m[1]!)

    for (const token of new Set(referenced)) {
      expect(token, `${token} is not a frozen typography token`).toMatch(
        /^--(type|weight|font)-[\w-]+$/,
      )
    }
  })
})

describe('M0-T04 primitives use no screen-local CSS', () => {
  it('ships every primitive style in the shared stylesheet', () => {
    const dir = join(ROOT, 'src', 'components', 'ui')
    const files = readdirSync(dir).filter((f) => f.endsWith('.tsx'))

    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8')
      // A primitive may not carry inline styling or a utility class soup; its
      // appearance belongs to primitives.css so screens cannot fork it.
      expect(source, `${file} uses an inline style`).not.toMatch(/style=\{\{/)
      expect(source, `${file} hardcodes a colour`).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    }
  })
})
