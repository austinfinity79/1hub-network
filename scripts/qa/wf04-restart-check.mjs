/**
 * WF04-PROD-05 — restart persistence and production-mode surface check.
 * LOCAL ONLY: it restarts the local `next start` on :3972 and the local
 * PostgreSQL container, then starts a second server in production mode on
 * :3973 (no ENABLE_DEV_ROUTES). Never point it at a shared environment.
 *
 * Usage (after `pnpm build`, with the :3972 test server running):
 *   node scripts/qa/wf04-restart-check.mjs
 *
 * It creates one programme through the real API, then proves the canonical
 * row survives (1) an application restart, (2) a database restart and
 * (3) a new login; finally that the production-mode server exposes no dev
 * login and no demo API. The created rows are removed at the end. Prints one
 * JSON evidence object; exits non-zero on any mismatch.
 */
import { execSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { requireDatabaseUrl } from '../db-target.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = 'http://localhost:3972'
const PROD = 'http://localhost:3973'
const DB_CONTAINER = 'hubnetwork-p0-db'
// DB-SAFETY-01: writes rows, so the database is always named; no shared-DB fallback.
const DATABASE_URL = requireDatabaseUrl('wf04-restart-check')
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const evidence = { steps: [] }
const check = (name, ok, detail) => {
  evidence.steps.push({ name, ok, ...(detail ? { detail } : {}) })
  if (!ok) throw new Error(`${name} failed: ${JSON.stringify(detail)}`)
}

async function waitFor(url, accept = (s) => s < 500, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const r = await fetch(url, { redirect: 'manual' })
      if (accept(r.status)) return r.status
    } catch {
      // not up yet
    }
    await sleep(1000)
  }
  throw new Error(`${url} did not come up`)
}

async function login(base, email) {
  const r = await fetch(`${base}/dev/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
    redirect: 'manual',
  })
  const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0]
  return { status: r.status, cookie }
}

async function api(base, cookie, method, path, body) {
  const r = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: { cookie, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  // An unmatched route answers with the HTML 404 page, not JSON.
  const json = (r.headers.get('content-type') ?? '').includes('application/json')
  return { status: r.status, body: json ? await r.json() : null }
}

function startServer(port, env) {
  const child = spawn('pnpm', ['start'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), ...env },
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return child
}

function pidsOn(port) {
  try {
    return execSync(`lsof -tiTCP:${port} -sTCP:LISTEN`, { encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

let programmeId = null
try {
  // 1. Real data through the API.
  const { cookie } = await login(BASE, 'leader@example.test')
  const created = await api(BASE, cookie, 'POST', '/programmes', {
    type: 'CHALLENGE',
    organization_id: CHAPTER_01,
    name: `Khởi động lại ${Date.now()}`,
  })
  check('create', created.status === 201, created.status)
  programmeId = created.body.programme.id
  await api(BASE, cookie, 'PATCH', `/programmes/${programmeId}`, {
    stages: [{ name: 'Ươm tạo', starts_on: '2026-11-01' }],
    problem_statements: [{ title: 'Bài toán khởi động lại' }],
  })
  await api(BASE, cookie, 'PUT', `/programmes/${programmeId}/registration`, {
    applicant_types: ['STARTUP'],
    questions: [{ id: 'q-a', prompt: 'Vấn đề?', required: true, step: 1 }],
  })
  const published = await api(BASE, cookie, 'POST', `/programmes/${programmeId}/publish`)
  check('publish', published.status === 200, published.status)
  const reference = JSON.stringify(
    (await api(BASE, cookie, 'GET', `/programmes/${programmeId}`)).body,
  )

  // 2. Application restart: the same session reads the same programme.
  for (const pid of pidsOn(3972)) process.kill(Number(pid))
  await sleep(1500)
  startServer(3972, { ENABLE_DEV_ROUTES: '1' })
  await waitFor(`${BASE}/`, (s) => s === 200)
  const afterApp = await api(BASE, cookie, 'GET', `/programmes/${programmeId}`)
  check('after application restart', JSON.stringify(afterApp.body) === reference, afterApp.status)

  // 3. Database restart: the pool reconnects; the row is unchanged.
  execSync(`docker restart ${DB_CONTAINER}`, { stdio: 'ignore' })
  for (let i = 0; i < 30; i += 1) {
    try {
      execSync(`docker exec ${DB_CONTAINER} pg_isready -q`, { stdio: 'ignore' })
      break
    } catch {
      await sleep(1000)
    }
  }
  let afterDb = { status: 0 }
  for (let i = 0; i < 10 && afterDb.status !== 200; i += 1) {
    afterDb = await api(BASE, cookie, 'GET', `/programmes/${programmeId}`)
    if (afterDb.status !== 200) await sleep(1000)
  }
  check('after database restart', JSON.stringify(afterDb.body) === reference, afterDb.status)

  // 4. A new login reads the same programme.
  const second = await login(BASE, 'leader@example.test')
  const afterLogin = await api(BASE, second.cookie, 'GET', `/programmes/${programmeId}`)
  check('after a new login', JSON.stringify(afterLogin.body) === reference, afterLogin.status)

  // 5. Production mode (no ENABLE_DEV_ROUTES): no dev login, no demo API, auth enforced.
  const prod = startServer(3973, { ENABLE_DEV_ROUTES: '' })
  await waitFor(`${PROD}/`, (s) => s === 200)
  const devLogin = await login(PROD, 'leader@example.test')
  check(
    'production: /dev/login is 404',
    devLogin.status === 404 && !devLogin.cookie.includes('session'),
    devLogin.status,
  )
  for (const path of ['/demo/programmes', `/demo/programmes/${programmeId}`]) {
    const r = await api(PROD, '', 'GET', path)
    check(`production: /api/v1${path} is 404`, r.status === 404, r.status)
  }
  const anonymous = await api(PROD, '', 'GET', '/programmes')
  check(
    'production: /api/v1/programmes needs a session (401)',
    anonymous.status === 401,
    anonymous.status,
  )
  const page = await fetch(`${PROD}/demo/programmes`, { redirect: 'manual' })
  check(
    'production: the WF04 page sends a guest to /auth',
    page.status >= 300 &&
      page.status < 400 &&
      (page.headers.get('location') ?? '').includes('/auth'),
    { status: page.status, location: page.headers.get('location') },
  )
  for (const pid of pidsOn(3973)) process.kill(Number(pid))
  try {
    process.kill(-prod.pid)
  } catch {
    // already gone
  }
  evidence.ok = true
} catch (error) {
  evidence.ok = false
  evidence.error = String(error)
} finally {
  for (const pid of pidsOn(3973)) process.kill(Number(pid))
  if (programmeId) {
    const client = new pg.Client({ connectionString: DATABASE_URL })
    await client.connect()
    await client.query('DELETE FROM programme_application_forms WHERE programme_id = $1', [
      programmeId,
    ])
    await client.query('DELETE FROM audit_events WHERE resource_id = $1', [programmeId])
    await client.query('DELETE FROM programmes WHERE id = $1', [programmeId])
    await client.end()
  }
  console.log(JSON.stringify(evidence, null, 2))
  process.exit(evidence.ok ? 0 : 1)
}
