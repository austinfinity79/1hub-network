import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  DECISION_ERROR_CODES,
  FROZEN_ERROR_CODES,
  HTTP_STATUS_MEANING,
  UNCONTRACTED_ERROR_CODES,
  isFrozenErrorCode,
} from './error-codes'
import { IDEMPOTENT_OPERATIONS } from './idempotency'

/**
 * M0-T05 — contract drift guard.
 *
 * Parses the authoritative Markdown contract and fails if the implementation's
 * frozen code list, HTTP mapping or idempotency list stops matching it.
 *
 * The YAML is deliberately not parsed here: it declares itself a skeleton, types
 * `code` as a bare string, and omits 21 endpoints. A drift test against it would
 * pass while the implementation diverged from the real contract.
 */
const ROOT = process.cwd()
const ARCH = join(ROOT, 'docs', 'architecture')
const CONTRACT = readFileSync(join(ARCH, '05_API_CONTRACT_P0_v1.0.md'), 'utf8')
const CONTRACT_YAML = readFileSync(join(ARCH, '05_API_CONTRACT_P0_v1.0.yaml'), 'utf8')

/** Codes the contract declares on `Errors:` lines. */
function errorCodesFromErrorLines(): string[] {
  return CONTRACT.split('\n')
    .filter((line) => /^\s*(\*\*)?Errors?(\*\*)?:/.test(line))
    .flatMap((line) => [...line.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]!))
}

/** Codes under the auth callback's "Known business error codes" list. */
function errorCodesFromKnownList(): string[] {
  const section = CONTRACT.split('Known business error codes:')[1] ?? ''
  const upToNextHeading = section.split('\n#')[0] ?? ''

  return [...upToNextHeading.matchAll(/^-\s+`([A-Z][A-Z0-9_]+)`/gm)].map((m) => m[1]!)
}

describe('M0-T05 frozen error codes', () => {
  const declared = [...new Set([...errorCodesFromErrorLines(), ...errorCodesFromKnownList()])]

  it('finds the codes the contract actually declares', () => {
    expect(declared.length).toBe(14)
  })

  it('implements exactly the declared set, with nothing invented or missing', () => {
    expect([...FROZEN_ERROR_CODES].sort()).toEqual([...declared].sort())
  })

  it('never treats a contract-gap code as frozen', () => {
    for (const code of UNCONTRACTED_ERROR_CODES) {
      expect(isFrozenErrorCode(code), `${code} must not be frozen`).toBe(false)
      expect(CONTRACT, `${code} must not appear in the contract`).not.toContain(code)
    }
  })

  it('marks every gap code with the UNCONTRACTED prefix so it is obvious on the wire', () => {
    for (const code of UNCONTRACTED_ERROR_CODES) {
      expect(code.startsWith('UNCONTRACTED_')).toBe(true)
    }
  })

  it('records why the gap exists: the contract maps 401, 404 and 500 but names no code', () => {
    for (const status of [401, 404, 500] as const) {
      expect(HTTP_STATUS_MEANING[status]).toBeTruthy()
    }
    // No `Errors:` line anywhere attaches a code to these statuses.
    expect(declared).not.toContain('UNAUTHENTICATED')
    expect(declared).not.toContain('NOT_FOUND')
    expect(declared).not.toContain('INTERNAL_ERROR')
  })
})

describe('decision-frozen error codes', () => {
  const LOG = readFileSync(join(ROOT, 'docs', 'decisions', 'DECISION_LOG.md'), 'utf8')

  it('are neither contract codes nor gap codes, and each is recorded in the decision log', () => {
    for (const code of DECISION_ERROR_CODES) {
      expect(isFrozenErrorCode(code), code).toBe(false)
      expect(code.startsWith('UNCONTRACTED_'), code).toBe(false)
      expect(LOG, `${code} must be recorded in DECISION_LOG.md`).toContain(code)
    }
  })
})

describe('M0-T05 HTTP mapping', () => {
  it('implements exactly the statuses in the contract table', () => {
    // The table's own separator row contains ---, so the section cannot be cut
    // on a horizontal rule. Match the status rows directly instead.
    const statuses = [...CONTRACT.matchAll(/^\|\s*(\d{3})\s*\|/gm)].map((m) => Number(m[1]))

    expect(statuses.length).toBeGreaterThan(0)
    expect([...new Set(statuses)].sort((a, b) => a - b)).toEqual(
      Object.keys(HTTP_STATUS_MEANING)
        .map(Number)
        .sort((a, b) => a - b),
    )
  })
})

describe('M0-T05 idempotency', () => {
  it('covers the seven operation classes the contract requires', () => {
    const section = CONTRACT.split('Required for:')[1]?.split('##')[0] ?? ''
    const bullets = [...section.matchAll(/^-\s+(.+?);?$/gm)].map((m) => m[1]!)

    expect(bullets).toHaveLength(7)
    // The seven of 05:56-63, `venture.create` of amendment A2 (05 §19) and the
    // two application operations of amendment A4 (05 §21).
    expect(IDEMPOTENT_OPERATIONS).toHaveLength(10)
    expect(CONTRACT.split('# 19. Amendment A2')[1]).toContain('venture.create')
    const a4 = CONTRACT.split('# 21. Amendment A4')[1] ?? ''
    expect(a4).toContain('application.create')
    expect(a4).toContain('application.submit')
  })
})

describe('M0-T05 contract source discipline', () => {
  it('confirms the YAML is a skeleton and so cannot be the source of truth', () => {
    // Recorded as evidence for choosing the Markdown, not as a style preference.
    expect(CONTRACT_YAML).toMatch(/implementation skeleton/i)
    expect(CONTRACT_YAML).toMatch(/Markdown contract is authoritative/i)
    // It types the error code with no enum, so it cannot pin the code list.
    expect(CONTRACT_YAML).not.toMatch(/AUTH_LINK_EXPIRED/)
  })

  it('finds the YAML defines fewer paths than the Markdown defines endpoints', () => {
    const yamlPaths = [...CONTRACT_YAML.matchAll(/^ {2}\/[\w{}/-]+:/gm)].length
    const markdownEndpoints = [...CONTRACT.matchAll(/^#{2,3}\s+(GET|POST|PATCH|PUT|DELETE)\s+`/gm)]
      .length

    expect(yamlPaths).toBeGreaterThan(0)
    expect(markdownEndpoints).toBeGreaterThan(yamlPaths)
  })
})
