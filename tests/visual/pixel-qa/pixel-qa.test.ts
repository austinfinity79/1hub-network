import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { stringify } from 'yaml'

import { compareImages } from './compare'
import {
  findScreen,
  loadManifest,
  ManifestError,
  parseManifest,
  validateManifest,
  type ManifestScreen,
} from './manifest'
import {
  assertWritable,
  DESIGN_FINAL_DIR,
  DESIGN_REFERENCE_DIR,
  HARNESS_BASELINE_DIR,
  MANIFEST_PATH,
  OUTPUT_DIRS,
  PathPolicyError,
  REPO_ROOT,
  resolveOutputPath,
  resolveReferencePath,
} from './paths'
import { readPng, readPngSize } from './png'
import { dryRun, QA_SCREENS, resolveRoute } from './qa-screens'
import { buildReport } from './report'
import { compareSegments } from './segments'

/**
 * M0-T11 — unit tests for the Pixel QA engine. Node only; the browser half is
 * proven by tests/visual/specs/pixel-qa-harness.spec.ts.
 */

const realManifest = () => loadManifest()

/** A minimal valid manifest pointing at one real approved reference. */
function manifestWith(screens: Partial<ManifestScreen>[]) {
  const base: ManifestScreen = {
    screen_id: 'WF01-S01',
    slug: 'auth-entry',
    source: 'design-reference/source-thao/WF01/WF01-S01__auth-entry__SOURCE.png',
    source_size: [1440, 900],
    reference_mode: 'strict',
    viewport_baseline: 'design-reference/final/WF01/WF01-S01__auth-entry__1440x900.png',
    full_page_baseline: null,
    typography_override: 'APEC_FONT_STACK_v1',
  }
  return {
    version: '1.0',
    viewport: '1440x900',
    dpr: 1,
    typography: 'APEC_FONT_STACK_v1',
    screens: screens.map((s) => ({ ...base, ...s })),
  }
}

function issuesOf(fn: () => unknown): string[] {
  try {
    fn()
  } catch (error) {
    if (error instanceof ManifestError) return error.issues
    throw error
  }
  throw new Error('expected ManifestError')
}

function solid(width: number, height: number, rgb: [number, number, number]): PNG {
  const png = new PNG({ width, height })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgb[0]
    png.data[i + 1] = rgb[1]
    png.data[i + 2] = rgb[2]
    png.data[i + 3] = 255
  }
  return png
}

function paintRect(png: PNG, x: number, y: number, w: number, h: number) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * png.width + xx) * 4
      png.data[i] = 0
      png.data[i + 1] = 0
      png.data[i + 2] = 0
    }
  }
}

function hashTree(dir: string): string {
  const hash = createHash('sha256')
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = path.join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else hash.update(p).update(readFileSync(p))
    }
  }
  walk(dir)
  return hash.digest('hex')
}

describe('manifest loading', () => {
  it('loads the frozen manifest: 24 unique screens, all references resolved', () => {
    const { manifest, screens } = realManifest()
    expect(manifest.viewport).toBe('1440x900')
    expect(manifest.dpr).toBe(1)
    expect(screens).toHaveLength(24)
    expect(new Set(screens.map((s) => s.screen_id)).size).toBe(24)
    for (const s of screens) {
      expect(existsSync(s.viewportPath), s.screen_id).toBe(true)
      if (s.full_page_baseline) expect(existsSync(s.fullPagePath!), s.screen_id).toBe(true)
    }
  })

  it('matches its sibling manifest.json, so the two registries cannot drift', () => {
    const json = JSON.parse(
      readFileSync(path.join(DESIGN_FINAL_DIR, 'manifest.json'), 'utf8'),
    ) as unknown[]
    const { manifest } = realManifest()
    expect(json).toEqual(manifest.screens)
  })

  it('finds a screen by id and rejects an unknown id', () => {
    const { screens } = realManifest()
    expect(findScreen(screens, 'WF03-S07').reference_mode).toBe('derived-crop')
    expect(() => findScreen(screens, 'WF09-S01')).toThrow(ManifestError)
  })

  it('rejects malformed YAML and malformed structure', () => {
    expect(issuesOf(() => parseManifest('screens: [unclosed'))[0]).toMatch(/YAML parse error/)
    expect(issuesOf(() => validateManifest(['not', 'a', 'mapping']))).toEqual([
      'manifest root must be a mapping',
    ])
    expect(issuesOf(() => validateManifest({ ...manifestWith([]), screens: [] }))).toContain(
      'screens must be a non-empty list',
    )
    const bad = issuesOf(() =>
      validateManifest(
        manifestWith([
          {
            screen_id: 'WF1-01',
            slug: 'Bad Slug',
            reference_mode: 'fuzzy' as never,
            source_size: [0, 900],
          },
        ]),
      ),
    )
    expect(bad.join('\n')).toMatch(/screen_id must match/)
    expect(bad.join('\n')).toMatch(/slug must be kebab-case/)
    expect(bad.join('\n')).toMatch(/unknown reference_mode/)
    expect(bad.join('\n')).toMatch(/source_size/)
  })

  it('rejects a manifest that changes the frozen viewport or DPR', () => {
    const issues = issuesOf(() =>
      validateManifest({ ...manifestWith([{}]), viewport: '1280x800', dpr: 2 }),
    )
    expect(issues).toContain('viewport must be 1440x900, got 1280x800')
    expect(issues).toContain('dpr must be 1, got 2')
  })

  it('rejects duplicate screen ids', () => {
    const issues = issuesOf(() => validateManifest(manifestWith([{}, {}])))
    expect(issues).toContain('WF01-S01: duplicate screen_id')
  })

  it('rejects a missing reference image', () => {
    const issues = issuesOf(() =>
      validateManifest(
        manifestWith([{ viewport_baseline: 'design-reference/final/WF01/does-not-exist.png' }]),
      ),
    )
    expect(issues.join('\n')).toMatch(/viewport_baseline missing/)
  })

  it('rejects a long-page entry without a full-page reference', () => {
    const issues = issuesOf(() =>
      validateManifest(manifestWith([{ reference_mode: 'long-page', full_page_baseline: null }])),
    )
    expect(issues.join('\n')).toMatch(/long-page reference_mode requires full_page_baseline/)
  })

  it('rejects a reference whose dimensions are not the frozen viewport', () => {
    const issues = issuesOf(() =>
      validateManifest(
        manifestWith([
          // A real full-page reference is 1440 wide but taller than 900.
          {
            viewport_baseline: 'design-reference/final/WF03/WF03-S09__public-unit-page__full.png',
          },
        ]),
      ),
    )
    expect(issues.join('\n')).toMatch(/expected 1440x900/)
  })

  it.each([
    ['parent escape', '../../etc/passwd'],
    ['escape via final/..', 'design-reference/final/../source-thao/WF01/x.png'],
    ['absolute path', '/etc/passwd'],
    ['outside final', 'design-reference/source-thao/WF01/WF01-S01__auth-entry__SOURCE.png'],
    ['backslash', 'design-reference\\final\\x.png'],
  ])('rejects reference path traversal: %s', (_, bad) => {
    expect(() => resolveReferencePath(bad)).toThrow(PathPolicyError)
    const issues = issuesOf(() => validateManifest(manifestWith([{ viewport_baseline: bad }])))
    expect(issues.join('\n')).toMatch(/viewport_baseline/)
  })
})

describe('reference dimensions', () => {
  it('reads PNG dimensions from every reference without decoding', () => {
    const { screens } = realManifest()
    for (const s of screens) {
      expect(readPngSize(s.viewportPath), s.screen_id).toEqual({ width: 1440, height: 900 })
      if (s.fullPagePath) {
        // Width is frozen; height follows the normalised source, taller or
        // shorter than 900 (design-reference/final/README.md).
        const size = readPngSize(s.fullPagePath)
        expect(size.width, s.screen_id).toBe(1440)
        expect(size.height, s.screen_id).toBeGreaterThan(0)
        expect(s.fullPageSize, s.screen_id).toEqual(size)
      }
    }
  })

  it('rejects a file that is not a PNG', () => {
    expect(() => readPngSize(MANIFEST_PATH)).toThrow(/not a PNG/)
  })
})

describe('comparison engine', () => {
  it('passes an identical comparison and still writes the diff image', () => {
    const diffPath = resolveOutputPath('diff', 'unit-identical.diff.png')
    const result = compareImages(solid(40, 30, [239, 239, 239]), solid(40, 30, [239, 239, 239]), {
      diffPath,
    })
    expect(result.status).toBe('IDENTICAL')
    expect(result.diff_pixels).toBe(0)
    expect(result.diff_bbox).toBeNull()
    expect(existsSync(diffPath)).toBe(true)
  })

  it('fails an intentional change and locates it', () => {
    const diffPath = resolveOutputPath('diff', 'unit-changed.diff.png')
    const changed = solid(40, 30, [239, 239, 239])
    paintRect(changed, 10, 5, 8, 6)
    const result = compareImages(solid(40, 30, [239, 239, 239]), changed, { diffPath })
    expect(result.status).toBe('DIFFERENT')
    expect(result.diff_pixels).toBe(48)
    expect(result.diff_bbox).toEqual({ x: 10, y: 5, width: 8, height: 6 })
    expect(readPng(diffPath).width).toBe(40)
  })

  it('tolerates differences only up to max_diff_pixels', () => {
    const changed = solid(10, 10, [255, 255, 255])
    paintRect(changed, 0, 0, 2, 1)
    const white = solid(10, 10, [255, 255, 255])
    expect(compareImages(white, changed, { maxDiffPixels: 2 }).status).toBe('IDENTICAL')
    expect(compareImages(white, changed, { maxDiffPixels: 1 }).status).toBe('DIFFERENT')
  })

  it('reports different dimensions as a geometry mismatch, never as equivalence', () => {
    const result = compareImages(solid(1440, 900, [0, 0, 0]), solid(1440, 1200, [0, 0, 0]))
    expect(result.status).toBe('DIMENSION_MISMATCH')
    expect(result.diff_pixels).toBeNull()
  })
})

describe('report', () => {
  it('names the reference, actual and diff paths explicitly', () => {
    const report = buildReport({
      screen_id: 'WF01-S01',
      capture: 'viewport',
      route: '/auth',
      actor: 'guest',
      reference_kind: 'APPROVED_DESIGN',
      conditions: { viewport: { width: 1440, height: 900 }, dpr: 1, fonts: 'loaded' },
      comparison: compareImages(solid(2, 2, [0, 0, 0]), solid(2, 2, [255, 255, 255])),
      typography: { checked: 3, violations: [] },
      referencePath: path.join(DESIGN_FINAL_DIR, 'WF01/WF01-S01__auth-entry__1440x900.png'),
      actualPath: resolveOutputPath('actual', 'WF01-S01.viewport.png'),
      diffPath: resolveOutputPath('diff', 'WF01-S01.viewport.diff.png'),
    })
    expect(report.images).toEqual({
      REFERENCE: 'design-reference/final/WF01/WF01-S01__auth-entry__1440x900.png',
      ACTUAL: 'tests/visual/actual/pixel-qa/WF01-S01.viewport.png',
      DIFF: 'tests/visual/diff/pixel-qa/WF01-S01.viewport.diff.png',
    })
    expect(report.classification.status).toBe('PENDING_REVIEW')
    expect(report.classification.taxonomy).toContain('V1_STRUCTURAL')
    expect(report.product_pixel_pass_claimed).toBe(false)
  })
})

describe('baseline ownership and write safety', () => {
  it('never resolves an output inside design-reference/', () => {
    expect(() => assertWritable(path.join(DESIGN_FINAL_DIR, 'WF01', 'x.png'))).toThrow(
      /design-reference/,
    )
    expect(() => assertWritable(MANIFEST_PATH)).toThrow(PathPolicyError)
    expect(() => assertWritable(path.join(REPO_ROOT, 'src', 'x.png'))).toThrow(PathPolicyError)
    for (const dir of Object.values(OUTPUT_DIRS)) {
      expect(path.relative(DESIGN_REFERENCE_DIR, dir).startsWith('..')).toBe(true)
    }
  })

  it.each(['../x.png', '../../design-reference/final/x.png', 'a/b.png', '', '.hidden'])(
    'rejects an unsafe output name: %s',
    (name) => {
      expect(() => resolveOutputPath('actual', name)).toThrow(PathPolicyError)
    },
  )

  it('keeps the harness baseline separate from the approved design baseline', () => {
    expect(HARNESS_BASELINE_DIR).toBe(path.join(REPO_ROOT, 'tests', 'visual', 'baseline'))
    expect(path.relative(DESIGN_REFERENCE_DIR, HARNESS_BASELINE_DIR).startsWith('..')).toBe(true)
    // No approved reference has been copied into the harness baseline.
    const approved = new Set(realManifest().screens.map((s) => path.basename(s.viewport_baseline)))
    for (const file of readdirSync(HARNESS_BASELINE_DIR)) {
      expect(approved.has(file), file).toBe(false)
    }
  })

  it('leaves every approved reference byte-identical after audit and comparison', () => {
    const before = hashTree(DESIGN_FINAL_DIR)
    const { screens } = realManifest()
    const ref = findScreen(screens, 'WF01-S01')
    compareImages(readPng(ref.viewportPath), readPng(ref.viewportPath), {
      diffPath: resolveOutputPath('diff', 'unit-reference-self.diff.png'),
    })
    expect(hashTree(DESIGN_FINAL_DIR)).toBe(before)
  })
})

describe('dry run', () => {
  const entries = dryRun(realManifest().screens)

  it('covers every production manifest entry exactly once', () => {
    expect(entries.map((e) => e.screen_id)).toEqual(QA_SCREENS.map((c) => c.screen_id))
  })

  it('marks state-board and short full-page references as configuration gaps, nothing else', () => {
    const { screens } = realManifest()
    const expected = screens
      .filter(
        (s) =>
          // Both WF01 state boards (S03, S04) now have approved mappings.
          (s.reference_mode === 'state-board' && !['WF01-S03', 'WF01-S04'].includes(s.screen_id)) ||
          (s.fullPageSize && s.fullPageSize.height < 900),
      )
      .map((s) => s.screen_id)
    const gaps = entries.filter((e) => e.status === 'REFERENCE_CONFIGURATION_GAP')
    expect(gaps.map((e) => e.screen_id)).toEqual(expected)
    expect(expected).toEqual([
      'WF02-S01',
      'WF02-S02',
      'WF02-S05',
      'WF02-S06',
      'WF03-S01',
      'WF03-S02',
      'WF03-S03',
      'WF03-S05',
      'WF03-S08',
    ])
    for (const gap of gaps) {
      expect(gap.reasons.length, gap.screen_id).toBeGreaterThan(0)
      expect(gap.reasons.join(' '), gap.screen_id).toMatch(/shorter than the 900px/)
    }
    expect(entries.filter((e) => e.status === 'READY_FOR_SCREEN_IMPLEMENTATION')).toHaveLength(15)
  })

  it('resolves every route to concrete fixture values', () => {
    for (const config of QA_SCREENS) {
      expect(resolveRoute(config), config.screen_id).not.toMatch(/:/)
    }
    expect(resolveRoute(QA_SCREENS.find((c) => c.screen_id === 'WF03-S09')!)).toBe(
      '/organizations/chapter-01',
    )
  })

  it('serialises to YAML-safe data', () => {
    expect(() => stringify(entries)).not.toThrow()
  })
})

describe('segment comparison (WF01-S01)', () => {
  it('aligns a segment by dy, so content moved by an intentional removal still compares strictly', () => {
    const reference = solid(40, 60, [239, 239, 239])
    paintRect(reference, 5, 40, 10, 5)
    const actual = solid(40, 60, [239, 239, 239])
    paintRect(actual, 5, 30, 10, 5) // same block, 10px higher

    const [aligned] = compareSegments(
      reference,
      actual,
      [{ name: 'lower', reference: { x: 0, y: 35, width: 40, height: 20 }, dy: -10 }],
      [],
    )
    expect(aligned!.diff_total).toBe(0)

    const [unaligned] = compareSegments(
      reference,
      actual,
      [{ name: 'lower', reference: { x: 0, y: 35, width: 40, height: 20 }, dy: 0 }],
      [],
    )
    expect(unaligned!.diff_outside_text).toBeGreaterThan(0)
  })

  it('splits differences inside text boxes from geometry drift outside them', () => {
    const reference = solid(40, 20, [255, 255, 255])
    const actual = solid(40, 20, [255, 255, 255])
    paintRect(actual, 2, 2, 4, 4) // "glyph" change inside the text box
    paintRect(actual, 30, 10, 3, 3) // drift outside any text
    const [r] = compareSegments(
      reference,
      actual,
      [{ name: 'all', reference: { x: 0, y: 0, width: 40, height: 20 }, dy: 0 }],
      [{ x: 0, y: 0, width: 10, height: 10 }],
      { diffPath: resolveOutputPath('diff', 'unit-segments.diff.png') },
    )
    expect(r).toMatchObject({ diff_total: 25, diff_in_text: 16, diff_outside_text: 9 })
    expect(existsSync(resolveOutputPath('diff', 'unit-segments.diff.png'))).toBe(true)
  })

  it('aligns horizontally by dx, as a state-board panel against a centred runtime card', () => {
    const reference = solid(60, 20, [255, 255, 255])
    paintRect(reference, 5, 5, 6, 6)
    const actual = solid(60, 20, [255, 255, 255])
    paintRect(actual, 35, 5, 6, 6)
    const [r] = compareSegments(
      reference,
      actual,
      [{ name: 'panel', reference: { x: 0, y: 0, width: 20, height: 20 }, dy: 0, dx: 30 }],
      [],
    )
    expect(r).toMatchObject({ dx: 30, diff_total: 0 })
  })

  it('refuses a segment that falls outside either image', () => {
    const png = solid(10, 10, [0, 0, 0])
    expect(() =>
      compareSegments(
        png,
        png,
        [{ name: 'x', reference: { x: 0, y: 5, width: 10, height: 5 }, dy: 1 }],
        [],
      ),
    ).toThrow(/outside an image/)
  })
})
