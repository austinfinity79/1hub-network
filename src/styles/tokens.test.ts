import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SOT = readFileSync(join(ROOT, 'docs', 'design', 'DESIGN_TOKENS_v1.0.css'), 'utf8')
const TOKENS = readFileSync(join(ROOT, 'src', 'styles', 'tokens.css'), 'utf8')
const GLOBALS = readFileSync(join(ROOT, 'src', 'app', 'globals.css'), 'utf8')

/** The five colour anchors frozen by Design SOT section 2.5. */
const ANCHORS = {
  '--hub-primary': '#fc523c',
  '--hub-primary-soft': '#fff3f0',
  '--hub-burgundy': '#160002',
  '--hub-canvas': '#efefef',
  '--hub-surface': '#ffffff',
}

/** The eight scale steps frozen by Design SOT section 2.4, as size/line pairs. */
const TYPE_SCALE = [
  ['--type-meta-size', '13px', '--type-meta-line', '18px'],
  ['--type-sm-size', '14px', '--type-sm-line', '24px'],
  ['--type-body-size', '16px', '--type-body-line', '28px'],
  ['--type-section-size', '17px', '--type-section-line', '26px'],
  ['--type-subtitle-size', '20px', '--type-subtitle-line', '30px'],
  ['--type-h2-size', '26px', '--type-h2-line', '36px'],
  ['--type-display-size', '34px', '--type-display-line', '44px'],
  ['--type-button-size', '16px', '--type-button-line', '20px'],
]

describe('M0-T02 design tokens', () => {
  it('imports the frozen SOT token file directly, so it cannot drift', () => {
    expect(GLOBALS).toContain("@import '../../docs/design/DESIGN_TOKENS_v1.0.css';")
  })

  it('still carries all five frozen colour anchors', () => {
    for (const [token, value] of Object.entries(ANCHORS)) {
      expect(SOT.toLowerCase(), `anchor changed: ${token}`).toContain(`${token}: ${value};`)
    }
  })

  it('still carries the full frozen type scale', () => {
    for (const [sizeToken, size, lineToken, line] of TYPE_SCALE) {
      expect(SOT).toContain(`${sizeToken}: ${size};`)
      expect(SOT).toContain(`${lineToken}: ${line};`)
    }
  })

  it('keeps Be Vietnam Pro as the default UI family', () => {
    expect(SOT).toMatch(/--font-ui:\s*"Be Vietnam Pro"/)
  })

  it('never introduces APEC blue', () => {
    const blues = [...`${SOT}${TOKENS}`.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0].toLowerCase())
    for (const hex of blues) {
      const [r, , b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((c) =>
        parseInt(c, 16),
      )
      expect(b! > r! + 16, `blue-dominant colour found: ${hex}`).toBe(false)
    }
  })

  it('invents no raw colour of its own: the semantic layer only references anchors', () => {
    expect(TOKENS).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(TOKENS).not.toMatch(/\brgba?\(/i)
  })

  it('exposes Archivo and IBM Plex Mono only through explicit opt-in classes', () => {
    expect(TOKENS).toMatch(/\.type-display\s*\{[^}]*--font-display/)
    expect(TOKENS).toMatch(/\.type-mono-meta\s*\{[^}]*--font-mono/)

    // Neither face may be bound to a bare element or a global rule.
    expect(TOKENS).not.toMatch(/^\s*(html|body)[^{]*\{[^}]*--font-(display|mono)/m)
  })

  it('exposes only the three shipped Be Vietnam Pro weights, never a faux bold', () => {
    expect(TOKENS).toMatch(/\.weight-regular\s*\{/)
    expect(TOKENS).toMatch(/\.weight-medium\s*\{/)
    expect(TOKENS).toMatch(/\.weight-semibold\s*\{/)
    expect(TOKENS).not.toMatch(/\.weight-bold\s*\{/)
  })

  it('defines no spacing, radius or shadow scale, which the SOT defers', () => {
    expect(TOKENS).not.toMatch(/--(space|spacing|radius|shadow)-/)
  })
})
