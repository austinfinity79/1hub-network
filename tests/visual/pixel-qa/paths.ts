import path from 'node:path'

/**
 * M0-T11 — path policy for the Pixel QA runner.
 *
 * Two baseline concepts exist and must never mix:
 *
 *   design-reference/final/**   APPROVED design baseline. Read-only input.
 *   tests/visual/baseline/**    Harness-owned regression snapshots.
 *
 * Every path the runner reads or writes goes through this module, so the rules
 * live in one place: references resolve only inside design-reference/final, and
 * outputs resolve only inside the QA output directories. Nothing here can
 * produce a write target under design-reference/.
 */

export const REPO_ROOT = path.resolve(__dirname, '..', '..', '..')

export const DESIGN_REFERENCE_DIR = path.join(REPO_ROOT, 'design-reference')
export const DESIGN_FINAL_DIR = path.join(DESIGN_REFERENCE_DIR, 'final')
export const MANIFEST_PATH = path.join(DESIGN_FINAL_DIR, 'manifest.yaml')

export const VISUAL_DIR = path.join(REPO_ROOT, 'tests', 'visual')
export const HARNESS_BASELINE_DIR = path.join(VISUAL_DIR, 'baseline')

/** Pixel QA outputs are namespaced so they never collide with other specs. */
export const OUTPUT_DIRS = {
  actual: path.join(VISUAL_DIR, 'actual', 'pixel-qa'),
  diff: path.join(VISUAL_DIR, 'diff', 'pixel-qa'),
  reports: path.join(VISUAL_DIR, 'reports', 'pixel-qa'),
} as const

export type OutputKind = keyof typeof OUTPUT_DIRS

export class PathPolicyError extends Error {
  override name = 'PathPolicyError'
}

function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/** Repo-relative, forward-slash form used in reports. */
export function toRepoPath(absolute: string): string {
  return path.relative(REPO_ROOT, absolute).split(path.sep).join('/')
}

/**
 * Resolves a manifest reference path. It must be repo-relative and land inside
 * `allowedDir` (design-reference/final for baselines). Absolute paths, `..`
 * escapes and anything outside the allowed tree are rejected.
 */
export function resolveReferencePath(repoRelative: string, allowedDir = DESIGN_FINAL_DIR): string {
  if (typeof repoRelative !== 'string' || repoRelative.length === 0) {
    throw new PathPolicyError('reference path must be a non-empty string')
  }
  if (path.isAbsolute(repoRelative) || repoRelative.includes('\\')) {
    throw new PathPolicyError(`reference path must be repo-relative: ${repoRelative}`)
  }
  if (repoRelative.split('/').includes('..')) {
    throw new PathPolicyError(`reference path escapes its directory: ${repoRelative}`)
  }
  const absolute = path.resolve(REPO_ROOT, repoRelative)
  if (!isInside(absolute, allowedDir)) {
    throw new PathPolicyError(
      `reference path ${repoRelative} is outside ${toRepoPath(allowedDir) || '.'}`,
    )
  }
  return absolute
}

/** Output file names are derived from ids, never from manifest paths. */
const SAFE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/

/**
 * Resolves a Pixel QA output file. The name is validated as a single safe path
 * segment, the result must land inside the output directory, and it must never
 * fall under design-reference/ or the harness baseline directory.
 */
export function resolveOutputPath(kind: OutputKind, fileName: string): string {
  if (!SAFE_NAME.test(fileName) || fileName.includes('..')) {
    throw new PathPolicyError(`unsafe output file name: ${fileName}`)
  }
  const dir = OUTPUT_DIRS[kind]
  const absolute = path.resolve(dir, fileName)
  assertWritable(absolute)
  if (!isInside(absolute, dir)) {
    throw new PathPolicyError(`output ${fileName} escapes ${toRepoPath(dir)}`)
  }
  return absolute
}

/** Final guard applied to every write the runner performs. */
export function assertWritable(absolute: string): void {
  const resolved = path.resolve(absolute)
  if (resolved === DESIGN_REFERENCE_DIR || isInside(resolved, DESIGN_REFERENCE_DIR)) {
    throw new PathPolicyError(`refusing to write inside design-reference/: ${resolved}`)
  }
  const allowed = [...Object.values(OUTPUT_DIRS), HARNESS_BASELINE_DIR]
  if (!allowed.some((dir) => isInside(resolved, dir))) {
    throw new PathPolicyError(`refusing to write outside Pixel QA output dirs: ${resolved}`)
  }
}

/** Harness-owned baseline file. Never an approved design reference. */
export function harnessBaselinePath(fileName: string): string {
  if (!SAFE_NAME.test(fileName)) throw new PathPolicyError(`unsafe baseline name: ${fileName}`)
  return path.join(HARNESS_BASELINE_DIR, fileName)
}
