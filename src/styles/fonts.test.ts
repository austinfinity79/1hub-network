import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  PINNED_FONTS,
  SUBSETS,
  buildFontCss,
  expectedFontFiles,
} from '../../scripts/sync-fonts.mjs'

const ROOT = process.cwd()

describe('M0-T02 font foundation', () => {
  it('pins exactly the families and weights frozen by Design SOT 2.3', () => {
    expect(PINNED_FONTS).toEqual([
      { family: 'Be Vietnam Pro', pkg: 'be-vietnam-pro', weights: [400, 500, 600] },
      { family: 'Archivo', pkg: 'archivo', weights: [700] },
      { family: 'IBM Plex Mono', pkg: 'ibm-plex-mono', weights: [500] },
    ])
  })

  it('ships the vietnamese subset, since the product locale is vi-VN', () => {
    expect(SUBSETS).toContain('vietnamese')
  })

  it('resolves every declared font asset on disk and none is empty', () => {
    const files = expectedFontFiles()
    expect(files).toHaveLength(15)

    for (const file of files) {
      const path = join(ROOT, 'public', 'fonts', file)
      expect(existsSync(path), `missing font asset: ${file}`).toBe(true)
      expect(statSync(path).size, `empty font asset: ${file}`).toBeGreaterThan(0)
    }
  })

  it('has a committed fonts.css that matches the generator exactly', () => {
    const committed = readFileSync(join(ROOT, 'src', 'styles', 'fonts.css'), 'utf8')
    expect(committed).toBe(buildFontCss())
  })

  it('serves every face from our own origin with no CDN reference', () => {
    const css = readFileSync(join(ROOT, 'src', 'styles', 'fonts.css'), 'utf8')
    const sources = [...css.matchAll(/src:\s*url\('([^']+)'\)/g)].flatMap((m) => m[1] ?? [])

    expect(sources).toHaveLength(15)
    for (const src of sources) {
      expect(src.startsWith('/fonts/'), `non-local font src: ${src}`).toBe(true)
    }
    expect(css).not.toMatch(/https?:/)
  })

  it('uses a non-shifting font-display for deterministic capture', () => {
    const css = readFileSync(join(ROOT, 'src', 'styles', 'fonts.css'), 'utf8')
    expect([...css.matchAll(/font-display:\s*block;/g)]).toHaveLength(15)
    expect(css).not.toMatch(/font-display:\s*swap/)
  })
})
