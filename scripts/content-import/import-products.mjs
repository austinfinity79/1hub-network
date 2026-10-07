#!/usr/bin/env node
// DEMO-CONTENT-IMPORT-A — idempotent importer of the approved Product cards of
// content pack `sprint1-content-pack-v1` into the isolated demo database.
//
//   node scripts/content-import/import-products.mjs --pack <dir> --expect-db <name> --dry-run
//   node scripts/content-import/import-products.mjs --pack <dir> --expect-db <name> --apply
//   node scripts/content-import/import-products.mjs --pack <dir> --expect-db <name> --rollback [--apply]
//
// PO decisions (DEMO-CONTENT-IMPORT-A, -RESUME, -RESUME-2):
// - exactly the 93 selected cards; no row invented, none forced;
// - public fields only: name, short description, canonical stage, a DOMAIN
//   only when the sector is EXACT / UNAMBIGUOUS against an existing ACTIVE
//   DOMAIN item (never created, never guessed); no logo, website or location
//   (none approved in the pack); no pitch / source URL, claim or note;
// - owner: ONE technical account `hub-network-catalogue@catalogue.invalid`
//   (DEACTIVATED, no password, no identity, no session) with ONE profile
//   "HUB Network Catalogue" (DEACTIVATED, PROFILE_DISCOVERY PRIVATE), only
//   because projects.owner_profile_id is required; no project_members row;
// - provenance in projects.metadata (import_batch, pack version / hash, source
//   sheet and rows): the selector of the targeted rollback;
// - Tracely → Founder untouched: the batch timestamp keeps the curated demo
//   ventures ahead in the default "Hoạt động" order (D3).
//
// Safety: the target must be the database named by --expect-db, one of the
// isolated databases below, at migration 021; shared / production names are
// refused. A dry-run only reads. Apply and rollback run in one transaction and
// verify the Tracely snapshot before COMMIT. No reset, truncate or broad delete.
//
// `pg` is resolved from the app (default /app, the demo image) or PG_BASE.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const PACK_VERSION = 'sprint1-content-pack-v1'
const PACK_HASH = '3936bb6097bff2fe4927e602a0c1a06001d93e558e1a1ad12fb5f23dfbe44bdd'
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
const EXPECTED_COUNT = 93
const BATCH = PACK_VERSION
const BATCH_TS = '2026-10-05T00:00:00Z'
const TECH_EMAIL = 'hub-network-catalogue@catalogue.invalid'
const TECH_NAME = 'HUB Network Catalogue'
const ISOLATED_DBS = ['hubnetwork_demo_0710', 'hubnetwork_s1uat03']
const REFUSED_DB = /^(hubnetwork_p0|onehub.*|.*prod.*|postgres|template\d)$/
const MIGRATION = '021_p0_startup_profile_v1.sql'
const STAGES = ['IDEA', 'MVP', 'PILOT', 'SELLING', 'GROWTH']
const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/
const UNSAFE = /https?:\/\/|www\.|drive\.google|docs\.google|bit\.ly|cccd|xác thực danh tính/i
const TRACELY = 'tracely'

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
  const mode = a.includes('--rollback') ? 'rollback' : a.includes('--apply') ? 'apply' : 'dry-run'
  const write = a.includes('--apply')
  if (a.includes('--apply') && a.includes('--dry-run')) fail('--apply and --dry-run together')
  return { pack: value('--pack'), expectDb: value('--expect-db'), mode, write }
}

/** The generator's own recipe: sha256 over "relpath\ncontent" of its files, sorted. */
function verifyPack(dir) {
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
  if (hash !== PACK_HASH) fail(`CONTENT_PACK_HASH_MISMATCH computed ${hash}`)
  if (manifest.CONTENT_PACK_HASH !== PACK_HASH || manifest.CONTENT_PACK_VERSION !== PACK_VERSION)
    fail('manifest version / hash differ')
  const records = JSON.parse(files['02-products-selected-100.json'])
  if (records.length !== EXPECTED_COUNT || manifest.PRODUCT_SELECTED_COUNT !== EXPECTED_COUNT)
    fail(`selected count ${records.length}, manifest ${manifest.PRODUCT_SELECTED_COUNT}`)
  return { hash, records, sourceHash: manifest.SOURCE_FILE_HASH }
}

const fold = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')

function mapSector(value, domains) {
  const exact = domains.filter((d) => value === d.label || value === d.slug)
  if (exact.length === 1) return { domain: exact[0], match: 'EXACT' }
  const loose = domains.filter((d) => fold(value) === fold(d.label) || fold(value) === fold(d.slug))
  if (loose.length === 1) return { domain: loose[0], match: 'UNAMBIGUOUS' }
  return { domain: null, match: 'UNMAPPED' }
}

/** A record's own safety: public fields only, nothing unapproved. */
function unsafeReason(r) {
  if (!r.name?.trim() || !r.short_description?.trim()) return 'REQUIRED_CANONICAL_FIELD_MISSING'
  if (!SLUG.test(r.slug ?? '')) return 'INVALID_SLUG'
  if (!STAGES.includes(r.stage?.code)) return 'NON_CANONICAL_STAGE'
  if (r.logo !== null || r.website !== null || r.location !== null)
    return 'UNAPPROVED_FIELD_PRESENT'
  const text = [r.name, r.short_description, ...(r.sectors ?? [])].join(' ')
  if (UNSAFE.test(text)) return 'UNSAFE_PUBLIC_TEXT'
  return null
}

/** Key-order independent JSON (jsonb reorders keys). */
const canon = (v) =>
  Array.isArray(v)
    ? `[${v.map(canon).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canon(v[k])}`)
          .join(',')}}`
      : JSON.stringify(v)

const metadataOf = (r) => ({
  import_batch: BATCH,
  content_pack_version: PACK_VERSION,
  content_pack_hash: PACK_HASH,
  source: { sheet: r.source.sheet, kept_row: r.source.kept_row, rows: r.source.rows },
})

async function snapshotTracely(db) {
  const { rows } = await db.query(
    `SELECT row_to_json(p)::text AS project,
            (SELECT json_agg(m ORDER BY m.id)::text FROM project_members m WHERE m.project_id = p.id) AS members,
            (SELECT json_agg(d ORDER BY d.vocabulary_item_id)::text FROM project_domains d WHERE d.project_id = p.id) AS domains,
            (SELECT row_to_json(ip)::text FROM individual_profiles ip WHERE ip.id = p.owner_profile_id) AS founder
       FROM projects p WHERE p.slug = $1`,
    [TRACELY],
  )
  if (!rows[0]) return null
  return createHash('sha256').update(JSON.stringify(rows[0])).digest('hex')
}

async function technicalOwner(db) {
  const { rows } = await db.query(
    `SELECT a.id::text AS account_id, a.status::text AS status, a.password_hash, a.username,
            (SELECT count(*)::int FROM auth_identities i WHERE i.account_id = a.id) AS identities,
            (SELECT count(*)::int FROM user_sessions s WHERE s.account_id = a.id) AS sessions,
            (SELECT count(*)::int FROM individual_profiles ip WHERE ip.account_id = a.id) AS profiles,
            ip.id::text AS profile_id, ip.display_name, ip.status::text AS profile_status,
            v.default_level::text AS default_level, v.group_overrides->>'PROFILE_DISCOVERY' AS discovery
       FROM user_accounts a
       LEFT JOIN individual_profiles ip ON ip.account_id = a.id
       LEFT JOIN profile_visibility_settings v ON v.profile_id = ip.id
      WHERE a.email_normalized = $1`,
    [TECH_EMAIL],
  )
  if (rows.length === 0) return null
  const o = rows[0]
  const ok =
    rows.length === 1 &&
    o.status === 'DEACTIVATED' &&
    o.password_hash === null &&
    o.username === null &&
    o.identities === 0 &&
    o.sessions === 0 &&
    o.profiles === 1 &&
    o.display_name === TECH_NAME &&
    o.profile_status === 'DEACTIVATED' &&
    o.default_level === 'PRIVATE' &&
    o.discovery === 'PRIVATE'
  if (!ok)
    fail(
      `technical owner exists but differs from the frozen contract: ${JSON.stringify({ ...o, password_hash: o.password_hash ? 'SET' : null })}`,
    )
  return o
}

async function plan(db, records) {
  const stages = new Map(
    (
      await db.query(
        `SELECT slug, id::text FROM vocabulary_items WHERE type_code = 'VENTURE_STAGE' AND status = 'ACTIVE'`,
      )
    ).rows.map((r) => [r.slug, r.id]),
  )
  const domains = (
    await db.query(
      `SELECT id::text, slug, label FROM vocabulary_items WHERE type_code = 'DOMAIN' AND status = 'ACTIVE' ORDER BY slug`,
    )
  ).rows
  const owner = await technicalOwner(db)
  const slugs = records.map((r) => r.slug)
  const existing = new Map(
    (
      await db.query(
        `SELECT p.id::text, p.slug, p.name, p.summary, p.type::text AS type, p.status::text AS status,
                p.visibility::text AS visibility, p.stage_id::text AS stage_id, p.owner_profile_id::text AS owner,
                p.metadata, p.region_id, p.website, p.logo_asset_id, p.owner_role_label,
                p.created_at = $2::timestamptz AND p.updated_at = $2::timestamptz AS stamped,
                COALESCE((SELECT array_agg(d.vocabulary_item_id::text ORDER BY d.vocabulary_item_id::text)
                            FROM project_domains d WHERE d.project_id = p.id), '{}') AS domain_ids
           FROM projects p WHERE p.slug = ANY($1::text[])`,
        [slugs, BATCH_TS],
      )
    ).rows.map((r) => [r.slug, r]),
  )
  const names = new Map(
    (
      await db.query(
        `SELECT lower(name) AS name, slug FROM projects
          WHERE lower(name) = ANY($1::text[]) AND COALESCE(metadata->>'import_batch', '') <> $2`,
        [records.map((r) => r.name.toLowerCase()), BATCH],
      )
    ).rows.map((r) => [r.name, r.slug]),
  )

  const sectorRows = new Map()
  const items = records.map((r) => {
    const reason = unsafeReason(r)
    if (reason) return { r, action: 'SKIP', reason }
    const stageId = stages.get(r.stage.code)
    if (!stageId) return { r, action: 'SKIP', reason: 'REQUIRED_CANONICAL_FIELD_MISSING' }
    const domainIds = new Set()
    for (const s of r.sectors) {
      const m = mapSector(s, domains)
      sectorRows.set(s, { sector: s, domain: m.domain?.slug ?? null, match: m.match })
      if (m.domain) domainIds.add(m.domain.id)
    }
    const want = {
      name: r.name.trim(),
      summary: r.short_description.trim(),
      stageId,
      domainIds: [...domainIds].sort(),
      metadata: metadataOf(r),
    }
    const row = existing.get(r.slug)
    if (!row) {
      if (names.has(r.name.toLowerCase()))
        return {
          r,
          want,
          action: 'COLLISION',
          reason: `NAME_IN_USE_BY:${names.get(r.name.toLowerCase())}`,
        }
      return { r, want, action: 'INSERT' }
    }
    const ours = row.metadata?.import_batch === BATCH && owner && row.owner === owner.profile_id
    if (!ours)
      return { r, want, action: 'COLLISION', reason: `SLUG_IN_USE_BY_OTHER_ENTITY:${row.slug}` }
    const same =
      row.name === want.name &&
      row.summary === want.summary &&
      row.stage_id === want.stageId &&
      row.type === 'STARTUP' &&
      row.status === 'ACTIVE' &&
      row.visibility === 'PUBLIC' &&
      row.region_id === null &&
      row.website === null &&
      row.logo_asset_id === null &&
      row.owner_role_label === null &&
      row.stamped &&
      canon(row.metadata) === canon(want.metadata) &&
      JSON.stringify(row.domain_ids) === JSON.stringify(want.domainIds)
    return { r, want, row, action: same ? 'UNCHANGED' : 'UPDATE' }
  })
  return {
    items,
    owner,
    sectors: [...sectorRows.values()].sort((a, b) => a.sector.localeCompare(b.sector)),
  }
}

function count(items, action) {
  return items.filter((i) => i.action === action).length
}

async function ensureOwner(db) {
  const owner = await technicalOwner(db)
  if (owner) return owner.profile_id
  const {
    rows: [a],
  } = await db.query(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'DEACTIVATED') RETURNING id`,
    [TECH_EMAIL],
  )
  const {
    rows: [p],
  } = await db.query(
    `INSERT INTO individual_profiles (account_id, display_name, status) VALUES ($1, $2, 'DEACTIVATED') RETURNING id::text`,
    [a.id, TECH_NAME],
  )
  await db.query(
    `INSERT INTO profile_visibility_settings (profile_id, default_level, group_overrides)
     VALUES ($1, 'PRIVATE', '{"PROFILE_DISCOVERY": "PRIVATE"}'::jsonb)`,
    [p.id],
  )
  return p.id
}

async function main() {
  const { pack, expectDb, mode, write } = args()
  if (!pack) fail('--pack <dir> is required')
  if (!expectDb || !ISOLATED_DBS.includes(expectDb))
    fail(`--expect-db must be one of ${ISOLATED_DBS}`)
  const { records, sourceHash } = verifyPack(pack)

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
    fail(`database ${t.db} is not the expected isolated ${expectDb}`)
  if (t.migration !== MIGRATION) fail(`migration ${t.migration}, expected ${MIGRATION}`)
  console.log('  DB_GUARD           PASS')
  console.log(
    `SOURCE ${PACK_VERSION} pack ${PACK_HASH} source ${sourceHash} candidates ${records.length}`,
  )

  const tracelyBefore = await snapshotTracely(db)
  if (!tracelyBefore) fail('Tracely is not present')

  if (mode === 'rollback') {
    const owner = await technicalOwner(db)
    const { rows } = await db.query(
      `SELECT count(*)::int AS n FROM projects WHERE metadata->>'import_batch' = $1 AND owner_profile_id = $2`,
      [BATCH, owner?.profile_id ?? null],
    )
    console.log(
      `ROLLBACK ${write ? 'APPLY' : 'DRY-RUN'} batch_projects=${rows[0].n} technical_owner=${owner ? 1 : 0}`,
    )
    if (write && owner) {
      await db.query('BEGIN')
      await db.query(
        `DELETE FROM projects WHERE metadata->>'import_batch' = $1 AND owner_profile_id = $2`,
        [BATCH, owner.profile_id],
      )
      const left = await db.query(
        `SELECT count(*)::int AS n FROM projects WHERE owner_profile_id = $1`,
        [owner.profile_id],
      )
      if (left.rows[0].n === 0)
        await db.query(
          `DELETE FROM user_accounts WHERE email_normalized = $1 AND status = 'DEACTIVATED'`,
          [TECH_EMAIL],
        )
      if ((await snapshotTracely(db)) !== tracelyBefore) {
        await db.query('ROLLBACK')
        fail('Tracely snapshot changed; rolled back')
      }
      await db.query('COMMIT')
      console.log('ROLLBACK_DONE')
    }
    await db.end()
    return
  }

  const p = await plan(db, records)
  const mapped = p.sectors.filter((s) => s.match !== 'UNMAPPED')
  const withDomain = p.items.filter((i) => i.want?.domainIds.length).length
  console.log('DOMAIN_MAPPING')
  for (const s of p.sectors)
    console.log(`  ${s.match.padEnd(11)} ${s.domain ?? '-'} <- ${s.sector}`)
  const summary = {
    MODE: mode,
    CANDIDATES: records.length,
    TO_INSERT: count(p.items, 'INSERT'),
    TO_UPDATE: count(p.items, 'UPDATE'),
    UNCHANGED: count(p.items, 'UNCHANGED'),
    TO_SKIP: count(p.items, 'SKIP'),
    COLLISIONS: count(p.items, 'COLLISION'),
    TECHNICAL_OWNER: p.owner ? 'REUSE' : 'CREATE',
    SECTOR_VALUES_TOTAL: p.sectors.length,
    SECTOR_VALUES_MAPPED: mapped.length,
    SECTOR_VALUES_UNMAPPED: p.sectors.length - mapped.length,
    PRODUCTS_WITH_DOMAIN: withDomain,
    PRODUCTS_WITHOUT_DOMAIN: p.items.filter((i) => i.want).length - withDomain,
  }
  for (const i of p.items.filter((x) => x.reason))
    console.log(`  ${i.action} ${i.r.slug} ${i.reason}`)

  if (write) {
    await db.query('BEGIN')
    try {
      const ownerId = await ensureOwner(db)
      for (const i of p.items) {
        if (i.action === 'INSERT') {
          const {
            rows: [row],
          } = await db.query(
            `INSERT INTO projects (type, owner_profile_id, slug, name, summary, status, visibility,
                                   stage_id, metadata, created_at, updated_at)
             VALUES ('STARTUP', $1, $2, $3, $4, 'ACTIVE', 'PUBLIC', $5, $6::jsonb, $7, $7) RETURNING id::text`,
            [
              ownerId,
              i.r.slug,
              i.want.name,
              i.want.summary,
              i.want.stageId,
              JSON.stringify(i.want.metadata),
              BATCH_TS,
            ],
          )
          for (const d of i.want.domainIds)
            await db.query(
              `INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`,
              [row.id, d],
            )
        } else if (i.action === 'UPDATE') {
          await db.query(
            `UPDATE projects SET name = $2, summary = $3, stage_id = $4, metadata = $5::jsonb, type = 'STARTUP',
                    status = 'ACTIVE', visibility = 'PUBLIC', region_id = NULL, website = NULL,
                    logo_asset_id = NULL, owner_role_label = NULL, created_at = $6, updated_at = $6
              WHERE id = $1 AND metadata->>'import_batch' = $7 AND owner_profile_id = $8`,
            [
              i.row.id,
              i.want.name,
              i.want.summary,
              i.want.stageId,
              JSON.stringify(i.want.metadata),
              BATCH_TS,
              BATCH,
              ownerId,
            ],
          )
          await db.query(
            `DELETE FROM project_domains WHERE project_id = $1 AND NOT (vocabulary_item_id::text = ANY($2::text[]))`,
            [i.row.id, i.want.domainIds],
          )
          for (const d of i.want.domainIds)
            await db.query(
              `INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
              [i.row.id, d],
            )
        }
      }
      if ((await snapshotTracely(db)) !== tracelyBefore) throw new Error('Tracely snapshot changed')
      await db.query('COMMIT')
    } catch (error) {
      await db.query('ROLLBACK')
      fail(`apply rolled back: ${error.message}`)
    }
  }
  const tracelyAfter = await snapshotTracely(db)
  summary.TRACELY_CHANGED = tracelyAfter === tracelyBefore ? 'NO' : 'YES'
  summary.BATCH_ROWS_IN_DB = (
    await db.query(`SELECT count(*)::int AS n FROM projects WHERE metadata->>'import_batch' = $1`, [
      BATCH,
    ])
  ).rows[0].n
  console.log(JSON.stringify(summary, null, 1))
  await db.end()
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
