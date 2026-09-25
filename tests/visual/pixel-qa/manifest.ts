import { existsSync, readFileSync } from 'node:fs'

import { parse } from 'yaml'

import {
  DESIGN_FINAL_DIR,
  DESIGN_REFERENCE_DIR,
  MANIFEST_PATH,
  PathPolicyError,
  resolveReferencePath,
} from './paths'
import { readPngSize, type Size } from './png'

/**
 * M0-T11 — loader and validator for design-reference/final/manifest.yaml.
 *
 * The manifest is frozen Design SOT. This module reads it and never writes it.
 * Field names are the manifest's own; nothing is added to its semantics. Route,
 * actor and fixture live in the tests-owned mapping (qa-screens.ts), because the
 * manifest does not define them.
 */

/** Frozen capture conditions, Design SOT section 3. */
export const FROZEN_VIEWPORT = { width: 1440, height: 900 } as const
export const FROZEN_DPR = 1

/** Design SOT section 4. */
export const REFERENCE_MODES = ['strict', 'long-page', 'state-board', 'derived-crop'] as const
export type ReferenceMode = (typeof REFERENCE_MODES)[number]

export type ManifestScreen = {
  screen_id: string
  slug: string
  source: string
  source_size: [number, number]
  reference_mode: ReferenceMode
  viewport_baseline: string
  full_page_baseline: string | null
  typography_override: string
}

export type Manifest = {
  version: string
  viewport: string
  dpr: number
  typography: string
  screens: ManifestScreen[]
}

export type ResolvedScreen = ManifestScreen & {
  workflow: string
  viewportPath: string
  fullPagePath: string | null
  viewportSize: Size | null
  fullPageSize: Size | null
}

export class ManifestError extends Error {
  override name = 'ManifestError'
  constructor(readonly issues: string[]) {
    super(`manifest invalid:\n- ${issues.join('\n- ')}`)
  }
}

const SCREEN_ID = /^WF0[1-6]-S\d{2}$/
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

type Options = {
  /** Check that every referenced file exists and read its dimensions. */
  checkFiles?: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Validates parsed manifest data. Collects every issue rather than stopping at
 * the first, so an audit reports the whole picture.
 */
export function validateManifest(
  raw: unknown,
  { checkFiles = true }: Options = {},
): { manifest: Manifest; screens: ResolvedScreen[] } {
  const issues: string[] = []

  if (!isRecord(raw)) throw new ManifestError(['manifest root must be a mapping'])

  if (typeof raw.version !== 'string') issues.push('version must be a string')
  if (raw.viewport !== `${FROZEN_VIEWPORT.width}x${FROZEN_VIEWPORT.height}`) {
    issues.push(`viewport must be 1440x900, got ${String(raw.viewport)}`)
  }
  if (raw.dpr !== FROZEN_DPR) issues.push(`dpr must be 1, got ${String(raw.dpr)}`)
  if (typeof raw.typography !== 'string') issues.push('typography must be a string')
  if (!Array.isArray(raw.screens) || raw.screens.length === 0) {
    issues.push('screens must be a non-empty list')
    throw new ManifestError(issues)
  }

  const seen = new Set<string>()
  const screens: ResolvedScreen[] = []

  raw.screens.forEach((entry: unknown, index: number) => {
    const at = `screens[${index}]`
    if (!isRecord(entry)) {
      issues.push(`${at} must be a mapping`)
      return
    }
    const id = entry.screen_id
    const label = typeof id === 'string' ? id : at

    if (typeof id !== 'string' || !SCREEN_ID.test(id)) {
      issues.push(`${at}: screen_id must match WF0N-SNN, got ${String(id)}`)
    } else if (seen.has(id)) {
      issues.push(`${label}: duplicate screen_id`)
    } else {
      seen.add(id)
    }

    if (typeof entry.slug !== 'string' || !SLUG.test(entry.slug)) {
      issues.push(`${label}: slug must be kebab-case`)
    }
    if (!REFERENCE_MODES.includes(entry.reference_mode as ReferenceMode)) {
      issues.push(`${label}: unknown reference_mode ${String(entry.reference_mode)}`)
    }
    if (entry.typography_override !== raw.typography) {
      issues.push(`${label}: typography_override must equal manifest typography`)
    }
    const size = entry.source_size
    if (
      !Array.isArray(size) ||
      size.length !== 2 ||
      !size.every((n) => Number.isInteger(n) && (n as number) > 0)
    ) {
      issues.push(`${label}: source_size must be [width, height] positive integers`)
    }

    // Paths: baselines only inside design-reference/final, source evidence
    // only inside design-reference/.
    let viewportPath = ''
    let fullPagePath: string | null = null
    try {
      viewportPath = resolveReferencePath(entry.viewport_baseline as string, DESIGN_FINAL_DIR)
    } catch (error) {
      issues.push(`${label}: viewport_baseline ${(error as Error).message}`)
    }
    if (entry.full_page_baseline !== null) {
      try {
        fullPagePath = resolveReferencePath(entry.full_page_baseline as string, DESIGN_FINAL_DIR)
      } catch (error) {
        issues.push(`${label}: full_page_baseline ${(error as Error).message}`)
      }
    }
    try {
      const sourcePath = resolveReferencePath(entry.source as string, DESIGN_REFERENCE_DIR)
      if (checkFiles && !existsSync(sourcePath)) issues.push(`${label}: source missing`)
    } catch (error) {
      issues.push(`${label}: source ${(error as Error).message}`)
    }

    // Design SOT section 4 / Pixel QA section 9: long-page needs a full page.
    if (entry.reference_mode === 'long-page' && entry.full_page_baseline === null) {
      issues.push(`${label}: long-page reference_mode requires full_page_baseline`)
    }

    let viewportSize: Size | null = null
    let fullPageSize: Size | null = null
    if (checkFiles && viewportPath) {
      if (!existsSync(viewportPath)) {
        issues.push(`${label}: viewport_baseline missing: ${String(entry.viewport_baseline)}`)
      } else {
        viewportSize = readPngSize(viewportPath)
        if (
          viewportSize.width !== FROZEN_VIEWPORT.width ||
          viewportSize.height !== FROZEN_VIEWPORT.height
        ) {
          issues.push(
            `${label}: viewport_baseline is ${viewportSize.width}x${viewportSize.height}, expected 1440x900`,
          )
        }
      }
    }
    if (checkFiles && fullPagePath) {
      if (!existsSync(fullPagePath)) {
        issues.push(`${label}: full_page_baseline missing: ${String(entry.full_page_baseline)}`)
      } else {
        fullPageSize = readPngSize(fullPagePath)
        // Long pages keep 1440 width and are never squashed into 900. Height is
        // NOT constrained: design-reference/final/README.md states __full.png
        // preserves the normalised source height whether taller or shorter than
        // 900, and nine frozen references are shorter. The consequence for
        // comparison is reported by the dry run, not rejected here.
        if (fullPageSize.width !== FROZEN_VIEWPORT.width) {
          issues.push(`${label}: full_page_baseline width ${fullPageSize.width}, expected 1440`)
        }
      }
    }

    screens.push({
      ...(entry as ManifestScreen),
      workflow: typeof id === 'string' ? id.slice(0, 4) : '',
      viewportPath,
      fullPagePath,
      viewportSize,
      fullPageSize,
    })
  })

  if (issues.length > 0) throw new ManifestError(issues)
  return { manifest: raw as unknown as Manifest, screens }
}

export function parseManifest(text: string, options?: Options) {
  let raw: unknown
  try {
    raw = parse(text)
  } catch (error) {
    throw new ManifestError([`YAML parse error: ${(error as Error).message}`])
  }
  return validateManifest(raw, options)
}

export function loadManifest(file = MANIFEST_PATH, options?: Options) {
  return parseManifest(readFileSync(file, 'utf8'), options)
}

export function findScreen(screens: ResolvedScreen[], screenId: string): ResolvedScreen {
  const screen = screens.find((s) => s.screen_id === screenId)
  if (!screen) throw new ManifestError([`no manifest entry for ${screenId}`])
  return screen
}

export { PathPolicyError }
