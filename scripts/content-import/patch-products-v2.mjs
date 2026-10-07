#!/usr/bin/env node
// DEMO-CONTENT-V2-PATCH-A — incremental patch of the live v1 catalogue batch
// (sprint1-content-pack-v1, 93 cards) to content pack sprint1-content-pack-v2
// (92 cards, from the refreshed workbook). Never a re-import:
//
//   node scripts/content-import/patch-products-v2.mjs --v1 <dir> --v2 <dir> --expect-db <name> --dry-run
//   node scripts/content-import/patch-products-v2.mjs ... --apply
//   node scripts/content-import/patch-products-v2.mjs ... --reverse [--apply]
//
// - REMOVED (in v1, not in v2): status ARCHIVED, never deleted; a tombstone in
//   metadata.v2_patch keeps the reason and the previous status (reversible).
// - UPDATED (a card field differs, or v2 brings an EXACT logo): card fields
//   from v2 (name, summary, canonical stage, strict DOMAIN mapping), and
//   metadata.v2_patch with the v2 source trace. A logo is recorded as
//   ASSET_PENDING_RUNTIME with its workbook cell only: no public surface renders
//   logo_asset_id and /media/assets is session-only, so ingesting it now would
//   publish nothing (separate runtime task). updated_at is kept: no reordering.
// - UNCHANGED: not written.
// - The delta must equal the PO-frozen one (1 removed, 7 updated, 0 new), the
//   rows must be the v1 batch rows of the technical catalogue owner, Tracely,
//   the owner and the M3 tables must be unchanged before COMMIT.
//
// `pg` is resolved from the app (default /app, the demo image) or PG_BASE.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const V1 = {
  version: 'sprint1-content-pack-v1',
  hash: '3936bb6097bff2fe4927e602a0c1a06001d93e558e1a1ad12fb5f23dfbe44bdd',
  count: 93,
}
const V2 = {
  version: 'sprint1-content-pack-v2',
  hash: 'ae5659e58df05946ac0e1899004ca6105c6fdaa46b612fa82a17129600a28046',
  count: 92,
}
const PACK_FILES = [
  '00-source-inventory.md',
  '01-products-normalized.json',
  '02-products-selected-100.json',
  '03-products-excluded.json',
  '04-featured-product-approval.md',
  '09-asset-manifest.csv',
  '10-validation-report.md',
  'internal/source-trace.json',
]
const PATCH_BATCH = 'sprint1-content-v2-patch'
const FROZEN_REMOVED = [
  'vnspecial-thuong-mai-va-quang-ba-dac-san-viet-nam-tai-thi-truong-trung-quoc',
]
const FROZEN_UPDATED = [
  '1hub-smart-campus-solution',
  'centauri-labs',
  'databuckets',
  'drippy',
  'inverted-lambda',
  'parkwave',
  'solemate',
]
// PO sector decisions (DEMO-CONTENT-V2-PATCH-A final closure, 07/10): applied
// only while the refreshed source sector is exactly the decided text, and only
// to an existing ACTIVE DOMAIN item (never created). Drippy is recorded as
// intentionally unmapped: no relation, no write.
const PO_SECTOR_DECISIONS = {
  '1hub-smart-campus-solution': {
    source_sector: 'Công nghệ giáo dục',
    domain: 'edtech',
    state: 'MAPPED_BY_PO_DECISION',
  },
  drippy: {
    source_sector: 'Công nghệ thời trang',
    domain: null,
    state: 'INTENTIONALLY_UNMAPPED_P0',
  },
}
const TECH_EMAIL = 'hub-network-catalogue@catalogue.invalid'
const ISOLATED_DBS = ['hubnetwork_demo_0710', 'hubnetwork_s1uat03']
const REFUSED_DB = /^(hubnetwork_p0|onehub.*|.*prod.*|postgres|template\d)$/
const MIGRATION = '021_p0_startup_profile_v1.sql'
const STAGES = ['IDEA', 'MVP', 'PILOT', 'SELLING', 'GROWTH']
const UNSAFE = /https?:\/\/|www\.|drive\.google|docs\.google|bit\.ly|cccd|xác thực danh tính/i

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
    v1: value('--v1'),
    v2: value('--v2'),
    expectDb: value('--expect-db'),
    mode: a.includes('--reverse') ? 'reverse' : a.includes('--apply') ? 'apply' : 'dry-run',
    write: a.includes('--apply'),
  }
}

function readPack(dir, want) {
  const files = Object.fromEntries(
    PACK_FILES.map((f) => [f, readFileSync(path.join(dir, f), 'utf8')]),
  )
  const hash = createHash('sha256')
    .update(
      Object.keys(files)
        .sort()
        .map((k) => `${k}\n${files[k]}`)
        .join(''),
      'utf8',
    )
    .digest('hex')
  const manifest = JSON.parse(readFileSync(path.join(dir, 'content-pack-manifest.json'), 'utf8'))
  if (
    hash !== want.hash ||
    manifest.CONTENT_PACK_HASH !== want.hash ||
    manifest.CONTENT_PACK_VERSION !== want.version
  )
    fail(`CONTENT_PACK_HASH_MISMATCH ${want.version}: computed ${hash}`)
  const records = JSON.parse(files['02-products-selected-100.json'])
  if (records.length !== want.count || manifest.PRODUCT_SELECTED_COUNT !== want.count)
    fail(`${want.version} selected count ${records.length}`)
  return { records, sourceHash: manifest.SOURCE_FILE_HASH }
}

const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
          .join(',')}}`
      : JSON.stringify(v)

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')

/** The v1 rule, unchanged: EXACT / UNAMBIGUOUS against existing ACTIVE DOMAIN items only. */
function domainIdsOf(sectors, domains) {
  const ids = new Set()
  for (const s of sectors) {
    const exact = domains.filter((d) => s === d.label || s === d.slug)
    const loose = domains.filter((d) => fold(s) === fold(d.label) || fold(s) === fold(d.slug))
    const hit = exact.length === 1 ? exact[0] : loose.length === 1 ? loose[0] : null
    if (hit) ids.add(hit.id)
  }
  return [...ids].sort()
}

const cardOf = (r) => ({
  name: r.name.trim(),
  summary: r.short_description.trim(),
  stage: r.stage.code,
  sectors: r.sectors,
})

async function guards(db) {
  const { rows } = await db.query(
    `SELECT (SELECT row_to_json(p)::text FROM projects p WHERE p.slug = 'tracely') AS tracely,
            (SELECT json_agg(m ORDER BY m.id)::text FROM project_members m JOIN projects p ON p.id = m.project_id WHERE p.slug = 'tracely') AS tracely_team,
            (SELECT row_to_json(ip)::text FROM individual_profiles ip JOIN projects p ON p.owner_profile_id = ip.id WHERE p.slug = 'tracely') AS founder,
            (SELECT row_to_json(a)::text FROM user_accounts a WHERE a.email_normalized = $1) AS tech_account,
            (SELECT json_agg(x)::text FROM (SELECT ip.*, v.default_level, v.group_overrides FROM individual_profiles ip
                JOIN user_accounts a ON a.id = ip.account_id LEFT JOIN profile_visibility_settings v ON v.profile_id = ip.id
               WHERE a.email_normalized = $1) x) AS tech_profile,
            (SELECT count(*) FROM venture_metrics) || '/' || (SELECT count(*) FROM venture_metric_values) || '/' ||
            (SELECT count(*) FROM venture_updates) || '/' || (SELECT count(*) FROM venture_follows) AS m3`,
    [TECH_EMAIL],
  )
  if (!rows[0].tracely) fail('Tracely is not present')
  return createHash('sha256').update(JSON.stringify(rows[0])).digest('hex')
}

async function main() {
  const { v1, v2, expectDb, mode, write } = args()
  if (!v1 || !v2) fail('--v1 <dir> and --v2 <dir> are required')
  if (!expectDb || !ISOLATED_DBS.includes(expectDb))
    fail(`--expect-db must be one of ${ISOLATED_DBS}`)
  const p1 = readPack(v1, V1)
  const p2 = readPack(v2, V2)
  const logos = JSON.parse(
    readFileSync(path.join(v2, 'internal/product-logo-evidence.json'), 'utf8'),
  ).logos.filter((l) => l.slug && l.match === 'EXACT')

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
  if (REFUSED_DB.test(t.db) || t.db !== expectDb || u.pathname !== `/${expectDb}`)
    fail(`database ${t.db} is not ${expectDb}`)
  if (t.migration !== MIGRATION) fail(`migration ${t.migration}, expected ${MIGRATION}`)
  console.log('  DB_GUARD           PASS')
  console.log(`SOURCE v1 ${V1.hash} → v2 ${V2.hash} (source ${p2.sourceHash})`)

  // ---- delta from the packs, checked against the PO freeze
  const a = new Map(p1.records.map((r) => [r.slug, r]))
  const b = new Map(p2.records.map((r) => [r.slug, r]))
  const removed = [...a.keys()].filter((s) => !b.has(s)).sort()
  const added = [...b.keys()].filter((s) => !a.has(s)).sort()
  const logoBy = new Map(logos.map((l) => [l.slug, l]))
  const updated = [...b.keys()]
    .filter(
      (s) => a.has(s) && (canon(cardOf(a.get(s))) !== canon(cardOf(b.get(s))) || logoBy.has(s)),
    )
    .sort()
  const mismatch =
    canon(removed) !== canon(FROZEN_REMOVED) ||
    canon(updated) !== canon(FROZEN_UPDATED) ||
    added.length !== 0
  console.log(
    `DELTA removed=${removed.length} updated=${updated.length} new=${added.length} DELTA_MISMATCH=${mismatch ? 'YES' : 'NO'}`,
  )
  if (mismatch) fail(`DELTA_MISMATCH removed ${removed} updated ${updated} new ${added}`)
  for (const r of p2.records) {
    if (
      !STAGES.includes(r.stage?.code) ||
      UNSAFE.test([r.name, r.short_description, ...r.sectors].join(' ')) ||
      r.logo ||
      r.website ||
      r.location
    )
      fail(`unsafe v2 record ${r.slug}`)
  }

  // ---- live rows: every touched slug must be a v1 batch row of the technical owner
  const owner = (
    await db.query(
      `SELECT ip.id::text FROM individual_profiles ip JOIN user_accounts a ON a.id = ip.account_id
        WHERE a.email_normalized = $1 AND a.status = 'DEACTIVATED' AND a.password_hash IS NULL`,
      [TECH_EMAIL],
    )
  ).rows
  if (owner.length !== 1) fail(`technical owner count ${owner.length}`)
  const ownerId = owner[0].id
  const live = new Map(
    (
      await db.query(
        `SELECT p.id::text, p.slug, p.name, p.summary, p.status::text AS status, p.stage_id::text AS stage_id, p.metadata,
                COALESCE((SELECT array_agg(d.vocabulary_item_id::text ORDER BY d.vocabulary_item_id::text)
                            FROM project_domains d WHERE d.project_id = p.id), '{}') AS domain_ids
           FROM projects p WHERE p.metadata->>'import_batch' = $1 AND p.owner_profile_id = $2`,
        [V1.version, ownerId],
      )
    ).rows.map((r) => [r.slug, r]),
  )
  if (live.size !== V1.count) fail(`live v1 batch has ${live.size} rows, expected ${V1.count}`)
  for (const s of a.keys()) if (!live.has(s)) fail(`v1 record ${s} is not a live batch row`)
  const stages = new Map(
    (
      await db.query(
        `SELECT slug, id::text FROM vocabulary_items WHERE type_code = 'VENTURE_STAGE' AND status = 'ACTIVE'`,
      )
    ).rows.map((r) => [r.slug, r.id]),
  )
  const domains = (
    await db.query(
      `SELECT id::text, slug, label FROM vocabulary_items WHERE type_code = 'DOMAIN' AND status = 'ACTIVE'`,
    )
  ).rows

  const tomb = (s) => ({
    patch_batch: PATCH_BATCH,
    source_version: V2.version,
    content_pack_hash: V2.hash,
    action: 'REMOVED',
    reason: 'SOURCE_ROW_REMOVED',
    previous_status: 'ACTIVE',
    v1_source_rows: a.get(s).source.rows,
  })
  const decisionOf = (s) => {
    const d = PO_SECTOR_DECISIONS[s]
    if (!d) return null
    if (!b.get(s).sectors.includes(d.source_sector))
      fail(`${s}: refreshed sector is no longer "${d.source_sector}"; PO decision does not apply`)
    if (d.domain && !domains.some((x) => x.slug === d.domain))
      fail(`DOMAIN ${d.domain} is not an ACTIVE item`)
    return d
  }
  const trace = (s) => {
    const r = b.get(s)
    const decision = decisionOf(s)
    const changed = ['name', 'summary', 'stage', 'sectors'].filter(
      (k) => canon(cardOf(a.get(s))[k]) !== canon(cardOf(r)[k]),
    )
    const logo = logoBy.get(s)
    return {
      patch_batch: PATCH_BATCH,
      source_version: V2.version,
      content_pack_hash: V2.hash,
      action: 'UPDATED',
      source: {
        sheet: r.source.sheet,
        kept_row: r.source.kept_row,
        rows: r.source.rows,
        file_sha256: r.source.file_sha256,
      },
      fields_changed: changed,
      logo: logo
        ? { status: 'ASSET_PENDING_RUNTIME', evidence: logo.workbook_cell, match: logo.match }
        : null,
      ...(decision?.domain ? { sector_decision: decision } : {}),
    }
  }

  const plan = []
  const before = await guards(db)
  if (mode === 'reverse') {
    for (const [s, row] of live) {
      const p = row.metadata?.v2_patch
      if (!p || p.patch_batch !== PATCH_BATCH) continue
      plan.push({ s, row, action: p.action === 'REMOVED' ? 'RESTORE' : 'UNTRACE' })
    }
  } else {
    for (const s of a.keys()) {
      const row = live.get(s)
      if (removed.includes(s)) {
        const want = tomb(s)
        const done = row.status === 'ARCHIVED' && canon(row.metadata.v2_patch) === canon(want)
        if (!done && row.status !== 'ACTIVE') fail(`${s} is ${row.status}, not ACTIVE`)
        plan.push({ s, row, want, action: done ? 'UNCHANGED' : 'DELETE' })
      } else if (updated.includes(s)) {
        const r = b.get(s)
        const card = {
          name: r.name.trim(),
          summary: r.short_description.trim(),
          stageId: stages.get(r.stage.code),
          domainIds: [
            ...new Set([
              ...domainIdsOf(r.sectors, domains),
              ...(decisionOf(s)?.domain
                ? [domains.find((x) => x.slug === decisionOf(s).domain).id]
                : []),
            ]),
          ].sort(),
        }
        if (!card.stageId) fail(`stage ${r.stage.code} missing`)
        const want = trace(s)
        const done =
          row.status === 'ACTIVE' &&
          row.name === card.name &&
          row.summary === card.summary &&
          row.stage_id === card.stageId &&
          canon(row.domain_ids) === canon(card.domainIds) &&
          canon(row.metadata.v2_patch) === canon(want)
        plan.push({ s, row, want, card, action: done ? 'UNCHANGED' : 'UPDATE' })
      } else {
        if (row.metadata?.v2_patch) fail(`${s} carries a v2 trace but is not in the delta`)
        plan.push({ s, row, action: 'UNCHANGED' })
      }
    }
  }
  const n = (x) => plan.filter((p) => p.action === x).length
  const summary = {
    MODE: mode,
    CANDIDATES: plan.length,
    TO_DELETE: n('DELETE'),
    TO_UPDATE: n('UPDATE'),
    TO_INSERT: 0,
    UNCHANGED: n('UNCHANGED'),
    TO_RESTORE: n('RESTORE') + n('UNTRACE'),
    COLLISIONS: 0,
    LOGOS_PENDING_RUNTIME: logos.length,
  }
  for (const p of plan.filter((x) => x.action !== 'UNCHANGED')) console.log(`  ${p.action} ${p.s}`)

  if (write) {
    await db.query('BEGIN')
    try {
      for (const p of plan) {
        if (p.action === 'DELETE') {
          await db.query(
            `UPDATE projects SET status = 'ARCHIVED', metadata = metadata || jsonb_build_object('v2_patch', $2::jsonb)
              WHERE id = $1 AND metadata->>'import_batch' = $3 AND owner_profile_id = $4 AND status = 'ACTIVE'`,
            [p.row.id, JSON.stringify(p.want), V1.version, ownerId],
          )
        } else if (p.action === 'UPDATE') {
          await db.query(
            `UPDATE projects SET name = $2, summary = $3, stage_id = $4,
                    metadata = metadata || jsonb_build_object('v2_patch', $5::jsonb)
              WHERE id = $1 AND metadata->>'import_batch' = $6 AND owner_profile_id = $7`,
            [
              p.row.id,
              p.card.name,
              p.card.summary,
              p.card.stageId,
              JSON.stringify(p.want),
              V1.version,
              ownerId,
            ],
          )
          await db.query(
            `DELETE FROM project_domains WHERE project_id = $1 AND NOT (vocabulary_item_id::text = ANY($2::text[]))`,
            [p.row.id, p.card.domainIds],
          )
          for (const d of p.card.domainIds)
            await db.query(
              `INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [p.row.id, d],
            )
        } else if (p.action === 'RESTORE' || p.action === 'UNTRACE') {
          const decided = p.row.metadata?.v2_patch?.sector_decision?.domain
          if (decided)
            await db.query(
              `DELETE FROM project_domains WHERE project_id = $1 AND vocabulary_item_id =
                 (SELECT id FROM vocabulary_items WHERE type_code = 'DOMAIN' AND slug = $2)`,
              [p.row.id, decided],
            )
          await db.query(
            `UPDATE projects SET status = CASE WHEN $2 THEN (metadata->'v2_patch'->>'previous_status')::project_status ELSE status END,
                    metadata = metadata - 'v2_patch'
              WHERE id = $1 AND metadata->'v2_patch'->>'patch_batch' = $3 AND owner_profile_id = $4`,
            [p.row.id, p.action === 'RESTORE', PATCH_BATCH, ownerId],
          )
        }
      }
      if ((await guards(db)) !== before)
        throw new Error('Tracely / technical owner / M3 snapshot changed')
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      fail(`rolled back: ${error.message}`)
    }
  }
  summary.GUARDS_UNCHANGED = (await guards(db)) === before ? 'YES' : 'NO'
  const counts = (
    await db.query(
      `SELECT count(*) FILTER (WHERE status = 'ACTIVE' AND visibility = 'PUBLIC')::int AS listed,
              count(*) FILTER (WHERE status = 'ARCHIVED')::int AS archived,
              count(*) FILTER (WHERE metadata ? 'v2_patch')::int AS traced
         FROM projects WHERE metadata->>'import_batch' = $1`,
      [V1.version],
    )
  ).rows[0]
  summary.BATCH_LISTED = counts.listed
  summary.BATCH_ARCHIVED = counts.archived
  summary.BATCH_V2_TRACED = counts.traced
  console.log(JSON.stringify(summary, null, 1))
  await db.end()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
