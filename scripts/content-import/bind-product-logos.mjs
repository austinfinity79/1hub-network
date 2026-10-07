#!/usr/bin/env node
// DEMO-CONTENT-V2-PATCH-A (fix) — binds the 7 verified refreshed Product logos
// (internal/product-logo-evidence.json, match EXACT) to their 7 Products, in
// the existing media store (MEDIA_STORAGE_DIR: `asset_<32 hex>` + sidecar JSON,
// as avatars and venture logos) and `projects.logo_asset_id`:
//
//   node scripts/content-import/bind-product-logos.mjs --v2 <pack> --files <dir> --media <dir> --expect-db <name> --dry-run
//   ... --apply      ... --reverse [--apply]
//
// - Files: <dir>/<slug>.bin, downloaded by the recorded Drive file id; each must
//   have the recorded byte size and a PNG / JPEG / WebP signature (sniffed).
// - The asset id is derived from the slug and the bytes: a rerun binds nothing.
// - Owner of the asset (sidecar) = the venture owner, the technical catalogue
//   account; nothing about it changes.
// - Only v1 batch rows of the technical owner that the v2 patch UPDATED with a
//   pending logo; the binding is recorded in metadata.logo_binding (the v2
//   trace is left as it is, so the v2 patch stays idempotent).
// - Tracely, the technical owner and the M3 tables are checked before COMMIT.
// Public serving of the bound logo is the app's rule (STARTUP · ACTIVE · PUBLIC).

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const V2_HASH = 'ae5659e58df05946ac0e1899004ca6105c6fdaa46b612fa82a17129600a28046'
const V1_BATCH = 'sprint1-content-pack-v1'
const PATCH_BATCH = 'sprint1-content-v2-patch'
const BIND_BATCH = 'sprint1-content-v2-logos'
const EXPECTED = 7
const TECH_EMAIL = 'hub-network-catalogue@catalogue.invalid'
const ISOLATED_DBS = ['hubnetwork_demo_0710', 'hubnetwork_s1uat03']
const REFUSED_DB = /^(hubnetwork_p0|onehub.*|.*prod.*|postgres|template\d)$/
const MIGRATION = '021_p0_startup_profile_v1.sql'
const MAX_BYTES = 2 * 1024 * 1024
const CREATED_AT = '2026-10-07T00:00:00.000Z'

function fail(message) {
  console.error(`REFUSED: ${message}`)
  process.exit(2)
}

function args() {
  const a = process.argv.slice(2)
  const value = (flag) => {
    const i = a.indexOf(flag)
    return i >= 0 ? a[i + 1] : undefined
  }
  if (a.includes('--apply') && a.includes('--dry-run')) fail('--apply and --dry-run together')
  return {
    v2: value('--v2'),
    files: value('--files'),
    media: value('--media'),
    expectDb: value('--expect-db'),
    mode: a.includes('--reverse') ? 'reverse' : a.includes('--apply') ? 'apply' : 'dry-run',
    write: a.includes('--apply'),
  }
}

function sniff(b) {
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return 'image/png'
  if (b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'image/jpeg'
  if (
    b.subarray(0, 4).toString('latin1') === 'RIFF' &&
    b.subarray(8, 12).toString('latin1') === 'WEBP'
  )
    return 'image/webp'
  return null
}

const sha = (b) => createHash('sha256').update(b).digest('hex')
const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
          .join(',')}}`
      : JSON.stringify(v)

async function guards(db) {
  const { rows } = await db.query(
    `SELECT (SELECT row_to_json(p)::text FROM projects p WHERE p.slug = 'tracely') AS tracely,
            (SELECT json_agg(m ORDER BY m.id)::text FROM project_members m JOIN projects p ON p.id = m.project_id WHERE p.slug = 'tracely') AS team,
            (SELECT row_to_json(a)::text FROM user_accounts a WHERE a.email_normalized = $1) AS tech_account,
            (SELECT json_agg(x)::text FROM (SELECT ip.*, v.default_level, v.group_overrides FROM individual_profiles ip
                JOIN user_accounts a ON a.id = ip.account_id LEFT JOIN profile_visibility_settings v ON v.profile_id = ip.id
               WHERE a.email_normalized = $1) x) AS tech_profile,
            (SELECT count(*) FROM venture_metrics) || '/' || (SELECT count(*) FROM venture_metric_values) || '/' ||
            (SELECT count(*) FROM venture_updates) || '/' || (SELECT count(*) FROM venture_follows) AS m3,
            (SELECT count(*) FROM projects WHERE metadata->>'import_batch' = $2 AND status = 'ACTIVE') AS listed`,
    [TECH_EMAIL, V1_BATCH],
  )
  if (!rows[0].tracely) fail('Tracely is not present')
  return createHash('sha256').update(JSON.stringify(rows[0])).digest('hex')
}

async function main() {
  const { v2, files, media, expectDb, mode, write } = args()
  if (!v2 || !files || !media) fail('--v2, --files and --media are required')
  if (!expectDb || !ISOLATED_DBS.includes(expectDb))
    fail(`--expect-db must be one of ${ISOLATED_DBS}`)
  const manifest = JSON.parse(readFileSync(path.join(v2, 'content-pack-manifest.json'), 'utf8'))
  if (manifest.CONTENT_PACK_HASH !== V2_HASH) fail('v2 pack hash mismatch')
  const logos = JSON.parse(
    readFileSync(path.join(v2, 'internal/product-logo-evidence.json'), 'utf8'),
  ).logos.filter((l) => l.slug && l.match === 'EXACT')
  if (logos.length !== EXPECTED) fail(`${logos.length} EXACT logos, expected ${EXPECTED}`)

  // ---- files: exact recorded size, an accepted image signature
  const items = logos.map((l) => {
    const file = path.join(files, `${l.slug}.bin`)
    if (!existsSync(file)) fail(`missing file for ${l.slug}`)
    const bytes = readFileSync(file)
    const type = sniff(bytes)
    if (bytes.byteLength !== l.byte_size)
      fail(`${l.slug}: ${bytes.byteLength} bytes, recorded ${l.byte_size}`)
    if (!type || bytes.byteLength > MAX_BYTES) fail(`${l.slug}: not an accepted image`)
    const digest = sha(bytes)
    const id = `asset_${sha(`${BIND_BATCH}:${l.slug}:${digest}`).slice(0, 32)}`
    return { l, bytes, type, digest, id }
  })

  const require = createRequire(path.join(process.env.PG_BASE ?? '/app', 'package.json'))
  const { Client } = require('pg')
  const url = process.env.DATABASE_URL
  if (!url) fail('DATABASE_URL is not set')
  const u = new URL(url)
  const db = new Client({ connectionString: url })
  await db.connect()
  const {
    rows: [t],
  } = await db.query(
    `SELECT current_database() AS db, (SELECT max(filename) FROM schema_migrations) AS migration`,
  )
  console.log('TARGET')
  console.log(`  DB_HOST            ${u.hostname}`)
  console.log(`  DB_PORT            ${u.port || '5432'}`)
  console.log(`  DB_NAME            ${t.db}`)
  console.log(`  ENVIRONMENT        NODE_ENV=${process.env.NODE_ENV ?? 'unset'}`)
  console.log(`  MIGRATION_VERSION  ${t.migration}`)
  console.log(`  MEDIA              ${media}`)
  if (REFUSED_DB.test(t.db) || t.db !== expectDb || u.pathname !== `/${expectDb}`)
    fail(`database ${t.db} is not ${expectDb}`)
  if (t.migration !== MIGRATION) fail(`migration ${t.migration}`)
  console.log('  DB_GUARD           PASS')

  const owner = (
    await db.query(
      `SELECT a.id::text AS account_id, ip.id::text AS profile_id FROM user_accounts a
         JOIN individual_profiles ip ON ip.account_id = a.id
        WHERE a.email_normalized = $1 AND a.status = 'DEACTIVATED' AND a.password_hash IS NULL`,
      [TECH_EMAIL],
    )
  ).rows
  if (owner.length !== 1) fail(`technical owner count ${owner.length}`)
  const { account_id: techAccount, profile_id: techProfile } = owner[0]

  const rows = new Map(
    (
      await db.query(
        `SELECT id::text, slug, status::text AS status, visibility::text AS visibility, logo_asset_id, metadata
           FROM projects WHERE slug = ANY($1::text[]) AND metadata->>'import_batch' = $2 AND owner_profile_id = $3`,
        [items.map((i) => i.l.slug), V1_BATCH, techProfile],
      )
    ).rows.map((r) => [r.slug, r]),
  )
  const plan = items.map((i) => {
    const row = rows.get(i.l.slug)
    if (!row) fail(`${i.l.slug} is not a catalogue batch row`)
    const v2p = row.metadata?.v2_patch
    if (
      v2p?.patch_batch !== PATCH_BATCH ||
      v2p.action !== 'UPDATED' ||
      v2p.logo?.status !== 'ASSET_PENDING_RUNTIME'
    )
      fail(`${i.l.slug} has no pending v2 logo`)
    if (row.status !== 'ACTIVE' || row.visibility !== 'PUBLIC') fail(`${i.l.slug} is not published`)
    const binding = {
      batch: BIND_BATCH,
      asset_id: i.id,
      sha256: i.digest,
      content_type: i.type,
      byte_size: i.bytes.byteLength,
      evidence: i.l.workbook_cell,
    }
    const fileOk =
      existsSync(path.join(media, i.id)) &&
      sha(readFileSync(path.join(media, i.id))) === i.digest &&
      existsSync(path.join(media, `${i.id}.json`))
    if (mode === 'reverse') {
      const bound = row.metadata?.logo_binding?.batch === BIND_BATCH
      return {
        i,
        row,
        binding,
        action: bound || row.logo_asset_id === i.id ? 'UNBIND' : 'UNCHANGED',
      }
    }
    if (row.logo_asset_id && row.logo_asset_id !== i.id)
      fail(`${i.l.slug} already has another logo ${row.logo_asset_id}`)
    const done =
      row.logo_asset_id === i.id && canon(row.metadata?.logo_binding) === canon(binding) && fileOk
    return { i, row, binding, fileOk, action: done ? 'UNCHANGED' : 'BIND' }
  })
  for (const p of plan)
    console.log(
      `  ${p.action.padEnd(9)} ${p.i.l.slug} ${p.i.id} ${p.i.type} ${p.i.bytes.byteLength}`,
    )

  const before = await guards(db)
  if (write) {
    // Files first (create-only, verified when present); the DB in one transaction.
    for (const p of plan.filter((x) => x.action === 'BIND' && !x.fileOk)) {
      const bin = path.join(media, p.i.id)
      if (existsSync(bin) && sha(readFileSync(bin)) !== p.i.digest)
        fail(`${bin} exists with other bytes`)
      if (!existsSync(bin)) writeFileSync(bin, p.i.bytes, { flag: 'wx', mode: 0o644 })
      const meta = path.join(media, `${p.i.id}.json`)
      if (!existsSync(meta))
        writeFileSync(
          meta,
          JSON.stringify({
            owner_account_id: techAccount,
            content_type: p.i.type,
            byte_size: p.i.bytes.byteLength,
            created_at: CREATED_AT,
          }),
          { flag: 'wx', mode: 0o644 },
        )
    }
    await db.query('BEGIN')
    try {
      for (const p of plan) {
        if (p.action === 'BIND')
          await db.query(
            `UPDATE projects SET logo_asset_id = $2, metadata = metadata || jsonb_build_object('logo_binding', $3::jsonb)
              WHERE id = $1 AND metadata->>'import_batch' = $4 AND owner_profile_id = $5`,
            [p.row.id, p.i.id, JSON.stringify(p.binding), V1_BATCH, techProfile],
          )
        else if (p.action === 'UNBIND')
          await db.query(
            `UPDATE projects SET logo_asset_id = NULL, metadata = metadata - 'logo_binding'
              WHERE id = $1 AND metadata->>'import_batch' = $2 AND owner_profile_id = $3 AND logo_asset_id = $4`,
            [p.row.id, V1_BATCH, techProfile, p.i.id],
          )
      }
      if ((await guards(db)) !== before)
        throw new Error('Tracely / technical owner / M3 / listed snapshot changed')
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      fail(`rolled back: ${error.message}`)
    }
    if (mode === 'reverse')
      for (const p of plan.filter((x) => x.action === 'UNBIND'))
        for (const f of [p.i.id, `${p.i.id}.json`]) rmSync(path.join(media, f), { force: true })
  }
  const n = (x) => plan.filter((p) => p.action === x).length
  const bound = (
    await db.query(
      `SELECT count(*)::int AS n FROM projects WHERE metadata->'logo_binding'->>'batch' = $1 AND logo_asset_id IS NOT NULL`,
      [BIND_BATCH],
    )
  ).rows[0].n
  console.log(
    JSON.stringify(
      {
        MODE: mode,
        EXPECTED,
        TO_BIND: n('BIND'),
        TO_UNBIND: n('UNBIND'),
        UNCHANGED: n('UNCHANGED'),
        BOUND_IN_DB: bound,
        GUARDS_UNCHANGED: (await guards(db)) === before ? 'YES' : 'NO',
      },
      null,
      1,
    ),
  )
  await db.end()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
