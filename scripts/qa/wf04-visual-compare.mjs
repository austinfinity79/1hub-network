/**
 * WF04-PROD-06 — structural and pixel comparison of the hardened WF04 screens
 * against the approved WF04 UI. LOCAL ONLY.
 *
 * Baseline: the WF04 screens as approved and released (production `78f21f2`,
 * DEC-W4P-D08: "the approved WF04 screens are the baseline"; `design-reference/
 * final` has no WF04 frame, contract Q9). Build that commit separately, with its
 * own database (migrations 001–014 + seed), and start it on BASE_URL with
 * ENABLE_DEV_ROUTES=1; the current build runs on CURRENT_URL (the :3972 test
 * server). The script creates, through the real API, programmes whose content
 * mirrors the baseline demo fixture, so both sides show the same states.
 *
 * Baseline build (outside the repo, e.g. in a scratch directory B):
 *   git archive 78f21f2 | tar -x -C B && ln -s "$PWD/node_modules" B/node_modules
 *   (in B, DATABASE_URL=…/hubnetwork_p0_base) node scripts/db.mjs migrate && seed
 *   ./node_modules/.bin/next build && ENABLE_DEV_ROUTES=1 ./node_modules/.bin/next start -p 3974
 *
 * Usage:
 *   BASE_URL=http://localhost:3974 node scripts/qa/wf04-visual-compare.mjs
 *
 * For every state × viewport (1440, 1024, 768, 430, 390, 320) and both builds it
 * writes a full-page capture, a side-by-side (baseline | current) PNG at 1440,
 * 768 and 390, and one JSON report: page overflow, elements escaping the
 * viewport, clipped text, overlapping controls, close controls, and per CSS
 * module component the box, typography and colour deltas against the baseline.
 * Cross-workflow states (`x-*`: WF05 demo frame, the member apply flow, member
 * and ops shells) open the same path on both builds. Created rows are removed
 * at the end.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium, request as http } from '@playwright/test'
import pg from 'pg'
import { PNG } from 'pngjs'

import { requireDatabaseUrl } from '../db-target.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = process.env.BASE_URL ?? 'http://localhost:3974'
const CURRENT = process.env.CURRENT_URL ?? 'http://localhost:3972'
const OUT = join(ROOT, 'tests/visual/actual/wf04-prod06')
// DB-SAFETY-01: writes rows, so the database is always named; no shared-DB fallback.
const DATABASE_URL = requireDatabaseUrl('wf04-visual-compare')
const LEADER = 'leader@example.test'
const MEMBER = 'member@example.test'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const SEED_CHALLENGE = 'c0000000-0000-0000-0000-000000000001'
const SEED_PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const SEED_VENTURE = '50000000-0000-0000-0000-000000000001'
const DEMO_PROGRAMME = 'd4000000-0000-0000-0000-000000000001'
const DEMO_CHALLENGE = 'd4000000-0000-0000-0000-000000000002'
const VIEWPORTS = [1440, 1024, 768, 430, 390, 320]
const SIDE_BY_SIDE = new Set([1440, 768, 390])

mkdirSync(OUT, { recursive: true })

/** Current-build programmes mirroring the baseline fixture (same names, dates, stages, problems). */
async function seedCurrent() {
  const api = await http.newContext({ baseURL: CURRENT })
  if (!(await api.post('/dev/login', { data: { email: LEADER } })).ok()) throw new Error('login')
  const create = async (body) => {
    const r = await api.post('/api/v1/programmes', { data: body })
    if (r.status() !== 201) throw new Error(`create ${r.status()} ${await r.text()}`)
    return (await r.json()).programme.id
  }
  const send = async (method, path, data) => {
    const r = await api[method](`/api/v1/programmes${path}`, data ? { data } : {})
    if (r.status() !== 200) throw new Error(`${method} ${path} ${r.status()} ${await r.text()}`)
  }
  const programme = await create({
    type: 'PROGRAMME',
    organization_id: CHAPTER_01,
    name: 'Chương trình ươm tạo (QA)',
    summary: 'Chương trình mẫu cho Internal Alpha: đồng hành cùng các đội dự án qua ba giai đoạn.',
    starts_at: '2026-09-01T02:00:00.000Z',
    ends_at: '2026-12-15T10:00:00.000Z',
  })
  await send('patch', `/${programme}`, {
    stages: [
      ['Mở đăng ký', 'Nhận hồ sơ đăng ký tham gia.', '2026-09-01', '2026-09-30'],
      ['Ươm tạo', 'Các buổi làm việc cùng đội dự án.', '2026-10-01', '2026-11-30'],
      ['Ngày trình diễn', 'Các đội trình bày kết quả.', '2026-12-01', '2026-12-15'],
    ].map(([name, summary, starts_on, ends_on]) => ({ name, summary, starts_on, ends_on })),
  })
  await send('put', `/${programme}/registration`, {
    applicant_types: ['TEAM', 'STARTUP'],
    questions: [
      { id: 'q-1', prompt: 'Dự án của bạn giải quyết vấn đề gì?', required: true, step: 1 },
      { id: 'q-2', prompt: 'Bạn cần chương trình hỗ trợ điều gì?', required: true, step: 1 },
    ],
  })
  await send('post', `/${programme}/publish`)
  const challenge = await create({
    type: 'CHALLENGE',
    organization_id: CHAPTER_01,
    name: 'Thử thách đổi mới (QA)',
    summary: 'Challenge mẫu cho Internal Alpha: các đội đề xuất giải pháp cho bài toán của đơn vị.',
    starts_at: '2026-11-01T02:00:00.000Z',
    ends_at: '2027-01-31T10:00:00.000Z',
  })
  await send('patch', `/${challenge}`, {
    stages: [
      {
        name: 'Nhận giải pháp',
        summary: 'Các đội gửi giải pháp cho bài toán.',
        starts_on: '2026-11-01',
        ends_on: '2026-12-15',
      },
      {
        name: 'Kết nối thí điểm',
        summary: 'Đơn vị gặp các đội có giải pháp phù hợp.',
        starts_on: '2026-12-16',
        ends_on: '2027-01-31',
      },
    ],
    problem_statements: [
      {
        title: 'Bài toán mẫu 1: tối ưu giao hàng chặng cuối',
        summary: 'Giảm thời gian giao hàng trong nội thành.',
      },
      { title: 'Bài toán mẫu 2: số hoá hồ sơ khách hàng' },
    ],
  })
  await api.dispose()
  return { programme, challenge }
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
      'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=menuitem], summary',
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
    .map((b) => `${b.label} [${Math.round(b.x)}..${Math.round(b.x + b.w)}]`)
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
  const closeControls = [
    ...document.querySelectorAll('a, button, [role=button], [role=menuitem], [data-action]'),
  ]
    .filter((el) => {
      const text = `${el.innerText ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''}`
      return (
        /đóng chương trình|đóng challenge|kết thúc chương trình|close programme|\bclose\b/i.test(
          text,
        ) ||
        /\/close\b/.test(el.getAttribute('href') ?? '') ||
        /close/i.test(el.getAttribute('data-action') ?? '')
      )
    })
    .map((el) => `${el.tagName} "${label(el)}"`)
  return {
    width: W,
    overflow: document.documentElement.scrollWidth - W,
    height: document.documentElement.scrollHeight,
    controls: boxes.length,
    escaping,
    overlaps,
    clipped,
    closeControls,
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
    const x = items[0]
    const y = other[0]
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

const client = new pg.Client({ connectionString: DATABASE_URL })
await client.connect()
const report = { base: BASE, current: CURRENT, states: [] }
let ids = null
const browser = await chromium.launch()
try {
  ids = await seedCurrent()
  const states = [
    ['list', '/demo/programmes', '/demo/programmes'],
    ['create', '/demo/programmes/new', '/demo/programmes/new'],
    ['detail-published', `/demo/programmes/${DEMO_PROGRAMME}`, `/demo/programmes/${ids.programme}`],
    ['detail-challenge', `/demo/programmes/${DEMO_CHALLENGE}`, `/demo/programmes/${ids.challenge}`],
    [
      'basic',
      `/demo/programmes/${DEMO_PROGRAMME}/setup/basic`,
      `/demo/programmes/${ids.programme}/setup/basic`,
    ],
    [
      'journey-programme',
      `/demo/programmes/${DEMO_PROGRAMME}/setup/journey`,
      `/demo/programmes/${ids.programme}/setup/journey`,
    ],
    [
      'journey-challenge',
      `/demo/programmes/${DEMO_CHALLENGE}/setup/journey`,
      `/demo/programmes/${ids.challenge}/setup/journey`,
    ],
    [
      'events',
      `/demo/programmes/${DEMO_CHALLENGE}/setup/events`,
      `/demo/programmes/${SEED_CHALLENGE}/setup/events`,
    ],
    [
      'registration',
      `/demo/programmes/${DEMO_PROGRAMME}/setup/registration`,
      `/demo/programmes/${ids.programme}/setup/registration`,
    ],
    [
      'team',
      `/demo/programmes/${DEMO_PROGRAMME}/setup/team`,
      `/demo/programmes/${ids.programme}/setup/team`,
    ],
    [
      'review-draft',
      `/demo/programmes/${DEMO_CHALLENGE}/setup/review`,
      `/demo/programmes/${ids.challenge}/setup/review`,
    ],
    [
      'review-published',
      `/demo/programmes/${DEMO_PROGRAMME}/setup/review`,
      `/demo/programmes/${ids.programme}/setup/review`,
    ],
    ...[
      ['x-wf05-demo-list', '/demo/projects'],
      ['x-wf05-demo-detail', `/demo/projects/${SEED_VENTURE}`],
      ['x-wf05-demo-application', `/demo/projects/${SEED_VENTURE}/applications/${SEED_PROGRAMME}`],
      ['x-apply', `/programmes/${SEED_PROGRAMME}/apply`],
      ['x-application', `/projects/${SEED_VENTURE}/applications/${SEED_PROGRAMME}`],
      ['x-member-home', '/me'],
      ['x-member-settings', '/me/settings'],
      ['x-projects', '/projects'],
      ['x-project-team', `/projects/${SEED_VENTURE}/team`],
    ].map(([name, path]) => [name, path, path, MEMBER]),
    ['x-ops-dashboard', `/ops/org/${CHAPTER_01}`, `/ops/org/${CHAPTER_01}`],
  ]
  const contexts = {}
  const contextFor = async (side, actor) => {
    const key = `${side} ${actor}`
    if (!contexts[key]) {
      const context = await browser.newContext({
        baseURL: side === 'base' ? BASE : CURRENT,
        locale: 'vi-VN',
      })
      if (!(await context.request.post('/dev/login', { data: { email: actor } })).ok())
        throw new Error(`${key} login`)
      contexts[key] = context
    }
    return contexts[key]
  }
  for (const [name, basePath, currentPath, actor = LEADER] of states) {
    for (const width of VIEWPORTS) {
      const shots = {}
      const facts = {}
      for (const [side, path] of [
        ['base', basePath],
        ['current', currentPath],
      ]) {
        const page = await (await contextFor(side, actor)).newPage()
        await page.setViewportSize({ width, height: 900 })
        const errors = []
        page.on('pageerror', (e) => errors.push(e.message))
        page.on('console', (m) => {
          if (m.type() === 'error' && !/status of 4\d\d/.test(m.text())) errors.push(m.text())
        })
        const response = await page.goto(path, { waitUntil: 'networkidle' })
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
        deltas: compare(facts.base, facts.current),
      })
    }
  }
} finally {
  await browser.close()
  if (ids) {
    const list = [ids.programme, ids.challenge]
    await client.query('DELETE FROM programme_application_forms WHERE programme_id = ANY($1)', [
      list,
    ])
    await client.query('DELETE FROM audit_events WHERE resource_id = ANY($1)', [list])
    await client.query('DELETE FROM programmes WHERE id = ANY($1)', [list])
    await client.query(`DELETE FROM idempotency_keys WHERE operation LIKE 'programme.%'`)
  }
  await client.end()
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
const bad = report.states.filter(
  (s) =>
    !s.state.startsWith('x-') &&
    (s.current.status !== 200 ||
      s.current.overflow > 0 ||
      s.current.escaping.length ||
      s.current.overlaps.length ||
      s.current.closeControls.length ||
      s.current.errors.length),
)
console.log(
  JSON.stringify(
    { captures: report.states.length * 2, out: OUT, currentFindings: bad.length },
    null,
    2,
  ),
)
