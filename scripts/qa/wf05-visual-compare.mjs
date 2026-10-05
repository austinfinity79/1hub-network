/**
 * WF05-PROD-06 — structural and pixel comparison of the productionized WF05
 * screens (S01, S02, L5) against their accepted UI. LOCAL ONLY.
 *
 * Baseline: the WF05 screens as accepted before the WF05 production work — the
 * WF04 candidate `f40f70c`, start of `feat/wf05-prod-hardening` (WF05-PROD-01:
 * "approved L5 frames and current S01 / S02 are the baseline"; its WF05 UI
 * equals production `78f21f2` but for the WF04 frame changes approved in
 * WF04-PROD-06). Build that commit separately, with its own database
 * (migrations 001–015 + seed), and start it on BASE_URL with
 * ENABLE_DEV_ROUTES=1; the current build runs on CURRENT_URL (the :3972 test
 * server). The L5 frames are also checked against `design-reference/final`
 * by `l5-startup-journey.spec.ts`.
 *
 * Baseline build (outside the repo, in a scratch directory B):
 *   git archive f40f70c | tar -x -C B && ln -s "$PWD/node_modules" B/node_modules
 *   (in B, DATABASE_URL=…/hubnetwork_p0_base) node scripts/db.mjs migrate && seed
 *   ./node_modules/.bin/next build && ENABLE_DEV_ROUTES=1 ./node_modules/.bin/next start -p 3974
 *
 * Usage:
 *   BASE_URL=http://localhost:3974 BASE_DATABASE_URL=…/hubnetwork_p0_base \
 *     node scripts/qa/wf05-visual-compare.mjs
 *
 * On each build, through that build's own API, it creates the same data: an
 * owner with a PROJECT, a STARTUP and an ARCHIVED venture, an EDIT member, a
 * member without a venture, a draft and a submitted application on the seed
 * programme and on a programme the operator then closes (WF04 API). For every
 * state × viewport (1440, 1024, 768, 430, 390, 320) it writes a full-page
 * capture per build, a side-by-side (baseline | current) PNG at 1440, 768 and
 * 390, and one JSON report: page overflow and the elements causing it (inside
 * or outside the page's <main>), controls escaping the viewport, clipped text,
 * overlapping controls, demo artifacts, enabled write controls, console
 * errors, the pixel mismatch (pixelmatch) and per CSS module component the
 * box, typography and colour deltas. Both builds use the same vocabulary (the
 * first slugs the two databases share), so captures differ only by build.
 * Created rows are removed at the end.
 */
import { randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, request as http } from '@playwright/test'
import pg from 'pg'
import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

import { requireDatabaseUrl } from '../db-target.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'tests/visual/actual/wf05-prod06')
const LOCAL = 'postgresql://hubnetwork:hubnetwork_local_dev@localhost:55432/hubnetwork_p0'
const SIDES = {
  base: {
    url: process.env.BASE_URL ?? 'http://localhost:3974',
    db: process.env.BASE_DATABASE_URL ?? LOCAL.replace(/\/hubnetwork_p0$/, '/hubnetwork_p0_base'),
  },
  current: {
    url: process.env.CURRENT_URL ?? 'http://localhost:3972',
    // DB-SAFETY-01: the current side writes rows; no shared-DB fallback.
    db: requireDatabaseUrl('wf05-visual-compare'),
  },
}
const LEADER = 'leader@example.test'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const VIEWPORTS = [1440, 1024, 768, 430, 390, 320]
const SIDE_BY_SIDE = new Set([1440, 768, 390])
const RUN = Date.now().toString(36)
const EMAIL = {
  owner: `w5v-owner-${RUN}@example.test`,
  member: `w5v-member-${RUN}@example.test`,
  newcomer: `w5v-new-${RUN}@example.test`,
}
const NAME = { owner: 'QA Chủ hồ sơ', member: 'QA Thành viên', newcomer: 'QA Người mới' }

mkdirSync(OUT, { recursive: true })

async function api(baseURL, email) {
  const context = await http.newContext({ baseURL })
  if (!(await context.post('/dev/login', { data: { email } })).ok())
    throw new Error(`login ${email}`)
  const call = async (method, path, data, expected = [200, 201]) => {
    const r = await context[method](path, {
      ...(data === undefined ? {} : { data }),
      headers: { 'Idempotency-Key': randomUUID() },
    })
    if (!expected.includes(r.status()))
      throw new Error(`${method} ${path} ${r.status()} ${await r.text()}`)
    return r.status() === 204 ? null : r.json()
  }
  return { context, call }
}

/** The same WF05 data on one build, through its own API (accounts by SQL, as the fixture). */
async function seed(side, db) {
  const people = {}
  for (const [key, email] of Object.entries(EMAIL)) {
    const {
      rows: [a],
    } = await db.query(
      `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
      [email],
    )
    const {
      rows: [p],
    } = await db.query(
      `INSERT INTO individual_profiles (account_id, display_name, status, purpose_step_completed_at, onboarding_completed_at)
       VALUES ($1, $2, 'ACTIVE', now(), now()) RETURNING id::text`,
      [a.id, NAME[key]],
    )
    people[key] = { account: a.id, profile: p.id }
  }
  const id = async (type, slug) =>
    (
      await db.query(`SELECT id::text FROM vocabulary_items WHERE type_code = $1 AND slug = $2`, [
        type,
        slug,
      ])
    ).rows[0].id
  const domains = [await id('DOMAIN', VOCAB.domains[0]), await id('DOMAIN', VOCAB.domains[1])]
  const stage = await id('VENTURE_STAGE', VOCAB.stage)

  const owner = await api(SIDES[side].url, EMAIL.owner)
  const venture = async (type, name) =>
    (
      await owner.call('post', '/api/v1/ventures', {
        type,
        name,
        summary: 'Một dòng mô tả cho kiểm thử giao diện.',
        domain_ids: domains,
        stage_id: stage,
      })
    ).id
  const ventures = {
    project: await venture('PROJECT', 'Dự án Xanh QA'),
    startup: await venture('STARTUP', 'Startup Nông nghiệp QA'),
    archived: await venture('STARTUP', 'Hồ sơ lưu trữ QA'),
  }
  await db.query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at, permission, updated_at)
     VALUES ($1, $2, 'Kỹ thuật', 'ACTIVE', now(), 'EDIT', now())`,
    [ventures.project, people.member.profile],
  )

  const leader = await api(SIDES[side].url, LEADER)
  const created = await leader.call('post', '/api/v1/programmes', {
    type: 'PROGRAMME',
    organization_id: CHAPTER_01,
    name: 'Chương trình đã đóng QA',
    summary: 'Chương trình kiểm thử trạng thái đã đóng.',
    starts_at: '2026-09-01T02:00:00.000Z',
    ends_at: '2026-12-15T10:00:00.000Z',
  })
  const closed = created.programme.id
  await leader.call('put', `/api/v1/programmes/${closed}/registration`, {
    applicant_types: ['TEAM', 'STARTUP'],
    questions: [
      { id: 'q-problem', prompt: 'Dự án của bạn giải quyết vấn đề gì?', required: true, step: 1 },
      { id: 'q-support', prompt: 'Bạn cần chương trình hỗ trợ điều gì?', required: true, step: 4 },
    ],
  })
  await leader.call('post', `/api/v1/programmes/${closed}/publish`)

  const draft = async (ventureId, programmeId, both) => {
    const app = await owner.call('post', '/api/v1/applications', {
      venture_id: ventureId,
      programme_id: programmeId,
    })
    await owner.call('patch', `/api/v1/applications/${app.id}`, {
      answers: [
        { question_id: 'q-problem', value: 'Giảm thời gian giao hàng chặng cuối trong nội thành.' },
        ...(both
          ? [{ question_id: 'q-support', value: 'Kết nối khách hàng thí điểm và cố vấn.' }]
          : []),
      ],
    })
    return app.id
  }
  const submitted = async (ventureId, programmeId) => {
    const id = await draft(ventureId, programmeId, true)
    await owner.call('post', `/api/v1/applications/${id}/submit`)
    return id
  }
  await draft(ventures.project, SEED_PROGRAMME, false)
  await submitted(ventures.startup, SEED_PROGRAMME)
  await draft(ventures.archived, SEED_PROGRAMME, false)
  await draft(ventures.project, closed, false)
  await submitted(ventures.startup, closed)
  await db.query(`UPDATE projects SET status = 'ARCHIVED' WHERE id = $1`, [ventures.archived])
  await leader.call('post', `/api/v1/programmes/${closed}/close`)
  await Promise.all([owner.context.dispose(), leader.context.dispose()])
  return { people, ventures, closed }
}

/** The same vocabulary on both builds: the first ACTIVE slugs the two databases share. */
const VOCAB = {}
async function chooseVocabulary() {
  const slugs = async (db, type) =>
    (
      await db.query(
        `SELECT slug FROM vocabulary_items WHERE type_code = $1 AND status = 'ACTIVE' ORDER BY slug`,
        [type],
      )
    ).rows.map((r) => r.slug)
  const common = async (type) => {
    const other = new Set(await slugs(dbs.base, type))
    return (await slugs(dbs.current, type)).filter((s) => other.has(s))
  }
  VOCAB.domains = (await common('DOMAIN')).slice(0, 2)
  VOCAB.stage = (await common('VENTURE_STAGE'))[0]
}

async function cleanup(db, data) {
  if (!data) return
  const accounts = Object.values(data.people).map((p) => p.account)
  const ventures = Object.values(data.ventures)
  await db.query('BEGIN')
  await db.query('SET LOCAL session_replication_role = replica')
  await db.query('DELETE FROM applications WHERE venture_id = ANY($1) OR programme_id = $2', [
    ventures,
    data.closed,
  ])
  await db.query('COMMIT')
  await db.query(
    'DELETE FROM audit_events WHERE actor_account_id = ANY($1) OR resource_id = ANY($2) OR resource_id = $3',
    [accounts, ventures, data.closed],
  )
  await db.query('DELETE FROM project_members WHERE project_id = ANY($1)', [ventures])
  await db.query('DELETE FROM projects WHERE id = ANY($1)', [ventures])
  await db.query('DELETE FROM programme_application_forms WHERE programme_id = $1', [data.closed])
  await db.query('DELETE FROM programmes WHERE id = $1', [data.closed])
  await db.query('DELETE FROM user_accounts WHERE id = ANY($1)', [accounts])
}

/** Layout facts of the rendered page, collected in the browser. */
function measure() {
  const W = window.innerWidth
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0
  }
  const scrolls = (el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX
      if ((o === 'auto' || o === 'scroll') && p !== document.documentElement) return true
    }
    return false
  }
  const label = (el) =>
    (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 48)
  const signature = (el) =>
    [...el.classList]
      .filter((c) => /^[a-z0-9-]+_[A-Za-z0-9]+__/.test(c))
      .map((c) => c.replace(/__[A-Za-z0-9_-]+$/, ''))
      .join(' ')
  const components = []
  for (const el of document.querySelectorAll('[class*="__"]')) {
    const sig = signature(el)
    if (!sig || !visible(el)) continue
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    components.push({
      sig,
      x: Math.round(r.x),
      y: Math.round(r.y + scrollY),
      w: Math.round(r.width),
      h: Math.round(r.height),
      font: `${s.fontFamily.split(',')[0].replace(/"/g, '')} ${s.fontSize} ${s.fontWeight}`,
      color: s.color,
      bg: s.backgroundColor,
      radius: s.borderRadius,
      border: `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`,
    })
  }
  const controls = [
    ...document.querySelectorAll(
      'a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary',
    ),
  ].filter(visible)
  const boxes = controls.map((el) => {
    const r = el.getBoundingClientRect()
    return {
      el,
      label: label(el),
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      inScroller: scrolls(el),
    }
  })
  const escaping = boxes
    .filter((b) => !b.inScroller && (b.x < -1 || b.x + b.w > W + 1))
    .map(
      (b) =>
        `${b.el.closest('main') ? 'main' : 'shell'}: ${b.label} [${Math.round(b.x)}..${Math.round(b.x + b.w)}]`,
    )
  const overlaps = []
  for (let i = 0; i < boxes.length; i += 1)
    for (let j = i + 1; j < boxes.length; j += 1) {
      const [a, b] = [boxes[i], boxes[j]]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const ix = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
      const iy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
      if (ix > 2 && iy > 2) overlaps.push(`${a.label} × ${b.label}`)
    }
  const clipped = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || !el.innerText?.trim() || el.matches('input, textarea, select')) continue
    const s = getComputedStyle(el)
    const hides = ['hidden', 'clip'].includes(s.overflowX) || s.textOverflow === 'ellipsis'
    if (hides && el.scrollWidth > el.clientWidth + 1) clipped.push(label(el))
  }
  // The outermost elements wider than the viewport (outside horizontal scrollers).
  const causes = []
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || scrolls(el)) continue
    const r = el.getBoundingClientRect()
    if (r.right <= W + 1) continue
    const parent = el.parentElement
    if (parent && parent !== document.body && parent.getBoundingClientRect().right > W + 1) continue
    causes.push(
      `${el.closest('main') ? 'main' : 'shell'}: ${el.tagName.toLowerCase()}${signature(el) ? `.${signature(el)}` : ''} → ${Math.round(r.right)}`,
    )
  }
  const chrome = document.body.cloneNode(true)
  chrome
    .querySelectorAll('[data-programme], [data-venture], script, style')
    .forEach((n) => n.remove())
  const writes = [
    ...document.querySelectorAll(
      'textarea, [data-action="to-review"], [data-action="submit"], [data-action="apply"]',
    ),
  ].filter((el) => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true')
  return {
    width: W,
    overflow: document.documentElement.scrollWidth - W,
    height: document.documentElement.scrollHeight,
    controls: boxes.length,
    causes: causes.slice(0, 8),
    escaping,
    overlaps,
    clipped,
    demo: {
      markers: document.querySelectorAll('[data-demo-notice], [data-demo-reset]').length,
      wording: /Dữ liệu demo|Đặt lại demo|trong bản demo|Internal Alpha|· Demo/i.test(
        chrome.textContent,
      ),
    },
    writes: writes.map((el) => el.getAttribute('data-action') ?? el.tagName.toLowerCase()),
    components,
  }
}

function sideBySide(a, b, file) {
  const left = PNG.sync.read(a)
  const right = PNG.sync.read(b)
  const gap = 24
  const out = new PNG({
    width: left.width + gap + right.width,
    height: Math.max(left.height, right.height),
  })
  out.data.fill(255)
  PNG.bitblt(left, out, 0, 0, left.width, left.height, 0, 0)
  PNG.bitblt(right, out, 0, 0, right.width, right.height, left.width + gap, 0)
  writeFileSync(file, PNG.sync.write(out))
}

/** Share of differing pixels over the common area (pixelmatch, threshold 0.1), and the height change. */
function mismatch(a, b) {
  const [A, B] = [PNG.sync.read(a), PNG.sync.read(b)]
  const [w, h] = [Math.min(A.width, B.width), Math.min(A.height, B.height)]
  const crop = (img) => {
    const out = new PNG({ width: w, height: h })
    PNG.bitblt(img, out, 0, 0, w, h, 0, 0)
    return out.data
  }
  const n = pixelmatch(crop(A), crop(B), null, w, h, { threshold: 0.1 })
  return { percent: Number(((100 * n) / (w * h)).toFixed(3)), heightDelta: B.height - A.height }
}

/** Component deltas: the same CSS-module signature, matched in document order. */
function compare(base, current) {
  const group = (list) => {
    const map = new Map()
    for (const c of list) map.set(c.sig, [...(map.get(c.sig) ?? []), c])
    return map
  }
  const [b, c] = [group(base.components), group(current.components)]
  const deltas = []
  for (const [sig, items] of b) {
    const other = c.get(sig)
    if (!other) {
      deltas.push({ sig, change: 'only in baseline', count: items.length })
      continue
    }
    const [x, y] = [items[0], other[0]]
    const diff = {}
    for (const key of ['x', 'w', 'h'])
      if (Math.abs(x[key] - y[key]) > 1) diff[key] = [x[key], y[key]]
    for (const key of ['font', 'color', 'bg', 'radius', 'border'])
      if (x[key] !== y[key]) diff[key] = [x[key], y[key]]
    if (items.length !== other.length) diff.count = [items.length, other.length]
    if (Object.keys(diff).length) deltas.push({ sig, ...diff })
  }
  for (const [sig, items] of c)
    if (!b.has(sig)) deltas.push({ sig, change: 'only in current', count: items.length })
  return deltas
}

const dbs = {
  base: new pg.Client({ connectionString: SIDES.base.db }),
  current: new pg.Client({ connectionString: SIDES.current.db }),
}
await Promise.all(Object.values(dbs).map((c) => c.connect()))
const data = {}
const report = { base: SIDES.base.url, current: SIDES.current.url, states: [] }
const browser = await chromium.launch()
try {
  await chooseVocabulary()
  for (const side of ['base', 'current']) data[side] = await seed(side, dbs[side])
  const form = (d, v, p) => `/projects/${d.ventures[v]}/applications/${p ?? SEED_PROGRAMME}`
  // [name, path(data), actor]
  const states = [
    ['s01-owner', () => '/demo/projects', 'owner'],
    ['s01-member', () => '/demo/projects', 'member'],
    ['s01-no-venture', () => '/demo/projects', 'newcomer'],
    ['s02-project', (d) => `/demo/projects/${d.ventures.project}`, 'owner'],
    ['s02-startup', (d) => `/demo/projects/${d.ventures.startup}`, 'owner'],
    ['s02-archived', (d) => `/demo/projects/${d.ventures.archived}`, 'owner'],
    ['s02-member', (d) => `/demo/projects/${d.ventures.project}`, 'member'],
    ['s02-not-found', () => `/demo/projects/${randomUUID()}`, 'owner'],
    ['apply-sub0', () => `/programmes/${SEED_PROGRAMME}/apply`, 'newcomer'],
    ['apply-choose', () => `/programmes/${SEED_PROGRAMME}/apply`, 'owner'],
    ['sub1-step1', (d) => `${form(d, 'project')}?buoc=1`, 'owner'],
    ['sub1-step3', (d) => `${form(d, 'project')}?buoc=3`, 'owner'],
    ['sub1-step4', (d) => `${form(d, 'project')}?buoc=4`, 'owner'],
    ['sub1-archived', (d) => form(d, 'archived'), 'owner'],
    ['sub1-closed', (d) => form(d, 'project', d.closed), 'owner'],
    ['sub2-review', (d) => `${form(d, 'project')}/review`, 'owner'],
    ['sub3-submitted', (d) => `${form(d, 'startup')}/submitted`, 'owner'],
    ['sub3-closed', (d) => `${form(d, 'startup', d.closed)}/submitted`, 'owner'],
    ['guest-redirect', () => '/demo/projects', null],
    ['x-wf02-settings', () => '/me/settings', 'owner'],
    ['x-wf02-projects', () => '/projects', 'owner'],
    ['x-wf02-edit', (d) => `/projects/${d.ventures.project}/edit`, 'owner'],
    ['x-wf02-team', (d) => `/projects/${d.ventures.project}/team`, 'owner'],
    ['x-wf04-closed-detail', (d) => `/demo/programmes/${d.closed}`, 'leader'],
  ]
  const contexts = {}
  const contextFor = async (side, actor) => {
    const key = `${side} ${actor}`
    if (!contexts[key]) {
      const context = await browser.newContext({ baseURL: SIDES[side].url, locale: 'vi-VN' })
      const email = actor === 'leader' ? LEADER : EMAIL[actor]
      if (actor && !(await context.request.post('/dev/login', { data: { email } })).ok())
        throw new Error(`${key} login`)
      contexts[key] = context
    }
    return contexts[key]
  }
  for (const [name, pathOf, actor] of states) {
    for (const width of VIEWPORTS) {
      const shots = {}
      const facts = {}
      for (const side of ['base', 'current']) {
        const page = await (await contextFor(side, actor)).newPage()
        await page.setViewportSize({ width, height: 900 })
        const errors = []
        page.on('pageerror', (e) => errors.push(e.message))
        page.on('console', (m) => {
          if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text())
        })
        const response = await page.goto(pathOf(data[side]), { waitUntil: 'networkidle' })
        await page.evaluate(() => document.fonts.ready)
        await page.waitForTimeout(150)
        if ((await page.evaluate(() => window.innerWidth)) !== width) throw new Error('viewport')
        shots[side] = await page.screenshot({ fullPage: true })
        writeFileSync(join(OUT, `${name}-${width}-${side}.png`), shots[side])
        facts[side] = {
          status: response?.status(),
          url: new URL(page.url()).pathname,
          errors,
          ...(await page.evaluate(measure)),
        }
        await page.close()
      }
      if (SIDE_BY_SIDE.has(width))
        sideBySide(shots.base, shots.current, join(OUT, `${name}-${width}-side-by-side.png`))
      const strip = ({ components, ...rest }) => ({ ...rest, components: components.length })
      report.states.push({
        state: name,
        width,
        base: strip(facts.base),
        current: strip(facts.current),
        pixel: mismatch(shots.base, shots.current),
        deltas: compare(facts.base, facts.current),
      })
    }
  }
  for (const c of Object.values(contexts)) await c.close()
} finally {
  await browser.close()
  for (const side of ['base', 'current'])
    await cleanup(dbs[side], data[side]).catch((e) => console.error(side, e.message))
  await Promise.all(Object.values(dbs).map((c) => c.end()))
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
const findings = report.states.filter(
  (s) =>
    s.current.overflow > 0 ||
    s.current.escaping.length ||
    s.current.overlaps.length ||
    s.current.clipped.length ||
    s.current.demo.markers ||
    s.current.demo.wording ||
    s.current.errors.length,
)
console.log(
  JSON.stringify(
    { captures: report.states.length * 2, out: OUT, currentFindings: findings.length },
    null,
    2,
  ),
)
