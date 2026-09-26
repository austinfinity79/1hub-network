/**
 * WF01-REMEDIATION-01 (GAP-ROSTER) — launch roster import CLI.
 *
 * Usage:
 *   pnpm roster:import <file.csv> [--dry-run]
 *
 * Validates the whole file (header, email, organization, state, leadership,
 * batch) and aborts on ANY invalid row. Otherwise, in one transaction, adds new
 * membership_bootstrap rows (duplicates are no-ops) and reconciles accounts
 * that already exist, through the same database routine sign-in uses.
 * --dry-run reports the same counts and changes nothing.
 *
 * Output is counts plus masked row references; the file contents and full
 * email addresses are never printed.
 */
import { readFileSync } from 'node:fs'

import pg from 'pg'

import { importRoster } from './roster-lib.mjs'

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://hubnetwork:hubnetwork_local_dev@localhost:55432/hubnetwork_p0'

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const file = args.find((a) => !a.startsWith('--'))
  if (!file) {
    console.error('Usage: pnpm roster:import <file.csv> [--dry-run]')
    process.exit(2)
  }
  const text = readFileSync(file, 'utf8')
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  const exec = async (sql, params = []) => (await client.query(sql, params)).rows
  let report
  try {
    await client.query('BEGIN')
    report = await importRoster(exec, text, { dryRun })
    if (report.errors.length > 0 || dryRun) await client.query('ROLLBACK')
    else await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    console.error(`roster import failed: ${error.code ?? error.name}`)
    process.exitCode = 1
    return
  } finally {
    await client.end()
  }
  const { errors, conflicts, ...counts } = report
  console.log(JSON.stringify(counts, null, 2))
  for (const e of errors) console.error(`line ${e.line}${e.who ? ` (${e.who})` : ''}: ${e.reason}`)
  for (const c of conflicts)
    console.warn(`conflict ${c.who} @ ${c.organization_slug}: ${c.outcome}`)
  if (errors.length > 0) {
    console.error(`import ABORTED: ${errors.length} invalid row(s); nothing was written`)
    process.exitCode = 1
  } else if (dryRun) {
    console.log('dry run: nothing was written')
  }
}

main()
