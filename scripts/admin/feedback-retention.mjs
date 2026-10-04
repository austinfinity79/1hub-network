#!/usr/bin/env node
/**
 * ADMIN-PROD-05 — PD-5 feedback screenshot retention for a scheduled run, e.g. a
 * daily VPS cron: `DATABASE_URL=… MEDIA_STORAGE_DIR=… node scripts/admin/feedback-retention.mjs`.
 *
 * The same statement as `runFeedbackScreenshotRetention` (src/lib/admin/feedback-ops.ts;
 * src/lib/admin/feedback-ops.db-test.ts keeps the two equal): screenshots of feedback
 * submitted 90 days ago or more lose their reference (`screenshot_deleted_at` set)
 * and their file, unless another record still uses the file. Files are removed
 * before the transaction commits. Prints a count only, never an id or a path.
 */
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import pg from 'pg'

export const RETENTION_DAYS = 90
const ASSET_ID = /^asset_[0-9a-f]{32}$/

export const SQL = `
  WITH due AS (
    SELECT id, screenshot_asset_id FROM feedback_submissions
     WHERE screenshot_asset_id IS NOT NULL
       AND created_at <= $1::timestamptz - make_interval(days => $2)
     ORDER BY created_at, id
     LIMIT $3
     FOR UPDATE SKIP LOCKED)
  UPDATE feedback_submissions f
     SET screenshot_asset_id = NULL, screenshot_deleted_at = $1::timestamptz, updated_at = now()
    FROM due WHERE f.id = due.id
  RETURNING due.screenshot_asset_id AS asset,
            -- A file still used elsewhere (an avatar, a logo, another feedback) is never removed.
            (EXISTS (SELECT 1 FROM individual_profiles WHERE avatar_asset_id = due.screenshot_asset_id)
             OR EXISTS (SELECT 1 FROM projects WHERE logo_asset_id = due.screenshot_asset_id)
             OR EXISTS (SELECT 1 FROM venture_reviews WHERE proposed->>'logo_asset_id' = due.screenshot_asset_id)
             OR EXISTS (SELECT 1 FROM feedback_submissions o
                         WHERE o.screenshot_asset_id = due.screenshot_asset_id AND o.id <> due.id)) AS shared`

/** One bounded pass; returns how many references were cleared. */
export async function runRetention({
  connectionString,
  storageDir,
  limit = 500,
  now = new Date(),
}) {
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(SQL, [now.toISOString(), RETENTION_DAYS, limit])
    for (const row of rows) {
      if (row.shared || !ASSET_ID.test(row.asset)) continue
      await rm(path.join(storageDir, row.asset), { force: true })
      await rm(path.join(storageDir, `${row.asset}.json`), { force: true })
    }
    await client.query('COMMIT')
    return rows.length
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    await client.end()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }
  const storageDir = path.resolve(process.cwd(), process.env.MEDIA_STORAGE_DIR ?? '.data/media')
  let total = 0
  for (;;) {
    const cleared = await runRetention({ connectionString, storageDir })
    total += cleared
    if (cleared < 500) break
  }
  console.log(`feedback screenshots cleared: ${total}`)
}
