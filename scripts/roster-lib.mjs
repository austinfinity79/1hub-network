/**
 * WF01-REMEDIATION-01 (GAP-ROSTER) — launch roster import, Data Freeze D2.
 *
 * Pure parsing/validation plus an import routine that runs against any
 * `exec(sql, params) -> rows` executor, so the CLI (scripts/roster.mjs) and the
 * DB tests share exactly one implementation. Attaching relationships is the
 * database function roster_reconcile_account (migration 004), the same routine
 * sign-in uses.
 *
 * Rules:
 * - input is the frozen template db/seed/production_roster_template.csv;
 * - identity is the normalized email only (trim + lower-case, identical to
 *   src/lib/auth/email.ts); no name, domain or organisation-text matching;
 * - a roster row is a CONFIRMED relationship, so membership_state must be
 *   ACTIVE; leadership exists only when leadership_role_label is present;
 * - any invalid row aborts the whole import (nothing is silently skipped);
 * - reports never print a full email address or the file contents.
 */

export const ROSTER_HEADER = [
  'email',
  'organization_slug',
  'membership_state',
  'leadership_role_label',
  'source_batch',
]

const COMMUNITY_TYPES = new Set(['HUB', 'CHAPTER', 'CLB'])
const BATCH = /^[A-Za-z0-9._-]{1,64}$/
const MAX_LABEL = 120

/** Same rule as src/lib/auth/email.ts normalizeEmail / isPlausibleEmail. */
export function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export function isPlausibleEmail(email) {
  const value = normalizeEmail(email)
  if (value.length < 3 || value.length > 254) return false
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value)
}

/** "leader@example.org" -> "l***@example.org": enough to find the row, no more. */
export function maskEmail(email) {
  const [local = '', domain = ''] = normalizeEmail(email).split('@')
  return `${local.slice(0, 1)}***@${domain}`
}

/** RFC 4180 CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  const input = text.replace(/^﻿/, '')
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"' && field === '') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && input[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''))
}

/**
 * Shape validation (no database). Returns `{ rows, errors, duplicates }`;
 * `line` is the 1-based file line, header = line 1.
 */
export function validateShape(text) {
  const table = parseCsv(text)
  const errors = []
  if (table.length === 0)
    return { rows: [], errors: [{ line: 1, reason: 'empty file' }], duplicates: 0 }
  const header = table[0].map((h) => h.trim())
  if (header.join(',') !== ROSTER_HEADER.join(',')) {
    return {
      rows: [],
      errors: [{ line: 1, reason: `header must be exactly: ${ROSTER_HEADER.join(',')}` }],
      duplicates: 0,
    }
  }
  const rows = []
  const seen = new Map()
  let duplicates = 0
  table.slice(1).forEach((cells, index) => {
    const line = index + 2
    if (cells.length !== ROSTER_HEADER.length) {
      errors.push({ line, reason: `expected ${ROSTER_HEADER.length} columns, got ${cells.length}` })
      return
    }
    const [emailRaw, slugRaw, stateRaw, labelRaw, batchRaw] = cells.map((c) => c.trim())
    const reasons = []
    if (!isPlausibleEmail(emailRaw)) reasons.push('email is not a valid address')
    if (!slugRaw) reasons.push('organization_slug is required')
    if (stateRaw !== 'ACTIVE') {
      reasons.push('membership_state must be ACTIVE (a roster row is a confirmed relationship)')
    }
    if (labelRaw.length > MAX_LABEL)
      reasons.push(`leadership_role_label over ${MAX_LABEL} characters`)
    if (!BATCH.test(batchRaw)) reasons.push('source_batch must be 1-64 of A-Z a-z 0-9 . _ -')
    const who = emailRaw ? maskEmail(emailRaw) : '(no email)'
    if (reasons.length > 0) {
      errors.push({ line, who, reason: reasons.join('; ') })
      return
    }
    const row = {
      line,
      email: normalizeEmail(emailRaw),
      organization_slug: slugRaw,
      leadership_role_label: labelRaw || null,
      source_batch: batchRaw,
    }
    const key = `${row.email}|${row.organization_slug}|${row.source_batch}`
    const first = seen.get(key)
    if (first) {
      if (first.leadership_role_label !== row.leadership_role_label) {
        errors.push({
          line,
          who,
          reason: `conflicts with line ${first.line} (different leadership)`,
        })
      } else {
        duplicates++
      }
      return
    }
    seen.set(key, row)
    rows.push(row)
  })
  return { rows, errors, duplicates }
}

/**
 * Validates against the database, then (unless dryRun) inserts new bootstrap
 * rows and reconciles every existing account they match. Call inside ONE
 * transaction: any error must roll the whole import back.
 */
export async function importRoster(exec, text, { dryRun = false } = {}) {
  const shape = validateShape(text)
  const errors = [...shape.errors]
  const report = {
    rows_total: shape.rows.length + shape.duplicates + shape.errors.length,
    rows_valid: 0,
    rows_invalid: 0,
    duplicate_rows_in_file: shape.duplicates,
    bootstrap_new: 0,
    bootstrap_existing: 0,
    accounts_matched: 0,
    memberships_to_attach: 0,
    leadership_to_attach: 0,
    attached: 0,
    already_active: 0,
    conflicts: [],
    errors,
    dry_run: dryRun,
  }

  const slugs = [...new Set(shape.rows.map((r) => r.organization_slug))]
  const orgs = slugs.length
    ? await exec(
        `SELECT id::text, slug, type::text AS type, status::text AS status
           FROM organizations WHERE slug = ANY($1::text[])`,
        [slugs],
      )
    : []
  const bySlug = new Map(orgs.map((o) => [o.slug, o]))

  const valid = []
  for (const row of shape.rows) {
    const org = bySlug.get(row.organization_slug)
    const who = maskEmail(row.email)
    if (!org) {
      errors.push({ line: row.line, who, reason: 'organization_slug does not exist' })
    } else if (!COMMUNITY_TYPES.has(org.type)) {
      errors.push({
        line: row.line,
        who,
        reason: `organization type ${org.type} takes no community membership`,
      })
    } else if (org.status === 'ARCHIVED') {
      errors.push({ line: row.line, who, reason: 'organization is archived' })
    } else {
      valid.push({ ...row, organization_id: org.id })
    }
  }
  report.rows_valid = valid.length
  report.rows_invalid = errors.length
  if (errors.length > 0) return report

  for (const row of valid) {
    const [existing] = await exec(
      `SELECT leadership_role_label, membership_state::text AS state
         FROM membership_bootstrap
        WHERE email_normalized = $1 AND organization_id = $2 AND source_batch = $3`,
      [row.email, row.organization_id, row.source_batch],
    )
    if (existing) {
      if ((existing.leadership_role_label ?? null) !== row.leadership_role_label) {
        errors.push({
          line: row.line,
          who: maskEmail(row.email),
          reason: 'differs from the already imported row of the same batch; use a new source_batch',
        })
      }
      report.bootstrap_existing++
    } else {
      report.bootstrap_new++
    }
  }
  report.rows_invalid = errors.length
  if (errors.length > 0) return report

  // What reconciliation would do for accounts that already exist.
  const emails = [...new Set(valid.map((r) => r.email))]
  const accounts = await exec(
    `SELECT a.id::text, a.email_normalized FROM user_accounts a
      WHERE a.email_normalized = ANY($1::text[]) AND a.status = 'ACTIVE'`,
    [emails],
  )
  report.accounts_matched = accounts.length
  const matched = new Set(accounts.map((a) => a.email_normalized))
  for (const row of valid.filter((r) => matched.has(r.email))) {
    const [open] = await exec(
      `SELECT 1 FROM community_memberships m JOIN individual_profiles p ON p.id = m.profile_id
         JOIN user_accounts a ON a.id = p.account_id
        WHERE a.email_normalized = $1 AND m.organization_id = $2 AND m.state = 'ACTIVE'`,
      [row.email, row.organization_id],
    )
    if (!open) report.memberships_to_attach++
    if (row.leadership_role_label) report.leadership_to_attach++
  }

  if (dryRun) return report

  for (const row of valid) {
    await exec(
      `INSERT INTO membership_bootstrap
         (email_normalized, organization_id, membership_state, leadership_role_label, source_batch)
       VALUES ($1, $2, 'ACTIVE', $3, $4)
       ON CONFLICT (email_normalized, organization_id, source_batch) DO NOTHING`,
      [row.email, row.organization_id, row.leadership_role_label, row.source_batch],
    )
  }
  for (const account of accounts) {
    const outcomes = await exec(
      `SELECT bootstrap_id::text, organization_id::text, outcome FROM roster_reconcile_account($1)`,
      [account.id],
    )
    for (const o of outcomes) {
      if (o.outcome === 'ATTACHED') report.attached++
      else if (o.outcome === 'ALREADY_ACTIVE') report.already_active++
      else {
        const slug = orgs.find((g) => g.id === o.organization_id)?.slug
        report.conflicts.push({
          who: maskEmail(account.email_normalized),
          organization_slug: slug,
          outcome: o.outcome,
        })
      }
    }
  }
  return report
}
