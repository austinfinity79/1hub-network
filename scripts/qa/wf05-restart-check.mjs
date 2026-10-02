/**
 * WF05-PROD-02 — WF05 persistence across refresh, relogin, app restart and
 * PostgreSQL restart. LOCAL ONLY: it restarts the local `next start` on :3972
 * and the local PostgreSQL container. Never point it at a shared environment.
 *
 * Usage (after `pnpm build`, with the :3972 test server running):
 *   node scripts/qa/wf05-restart-check.mjs
 *
 * Through the real API it builds: a PUBLISHED programme with a form (leader,
 * WF04), a new PROJECT venture (member, WF02) with an ACTIVE team member, a
 * DRAFT application with answers on it, and a SUBMITTED application from the
 * member's seeded STARTUP. It then proves the venture, the membership, both
 * applications and their programme / form links read back identical after a
 * refresh, an application restart, a database restart and a new login. The
 * created rows are removed at the end (submitted ones through a maintenance
 * transaction, migration 016). Prints one JSON evidence object; exits non-zero
 * on any mismatch.
 */
import { execSync, spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const BASE = 'http://localhost:3972'
const DB_CONTAINER = 'hubnetwork-p0-db'
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://hubnetwork:hubnetwork_local_dev@localhost:55432/hubnetwork_p0'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const SEED_STARTUP = '50000000-0000-0000-0000-000000000001'
const LEADER_PROFILE = '40000000-0000-0000-0000-000000000002'
const DOMAIN = '20000000-0000-0000-0000-000000000011'
const STAGE = '23000000-0000-0000-0000-000000000001'

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

async function login(email) {
  const r = await fetch(`${BASE}/dev/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
    redirect: 'manual',
  })
  return (r.headers.get('set-cookie') ?? '').split(';')[0]
}

let keySeq = 0
async function api(cookie, method, path, body, key = false) {
  const headers = { cookie, 'content-type': 'application/json' }
  if (key) headers['idempotency-key'] = `wf05-restart-${Date.now()}-${(keySeq += 1)}`
  const r = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const json = (r.headers.get('content-type') ?? '').includes('application/json')
  return { status: r.status, body: json ? await r.json() : null }
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

const created = { programme: null, venture: null, applications: [] }
let reads = null

/** Every WF05 read the check compares, as one JSON string per read. */
async function readAll(cookie) {
  const out = {}
  for (const [name, path] of Object.entries(reads)) {
    let r = { status: 0 }
    for (let i = 0; i < 10 && r.status !== 200; i += 1) {
      r = await api(cookie, 'GET', path)
      if (r.status !== 200) await sleep(1000)
    }
    out[name] = { status: r.status, body: JSON.stringify(r.body) }
  }
  return out
}

function same(name, reference, now) {
  const diff = Object.keys(reference).filter(
    (k) => reference[k].status !== 200 || JSON.stringify(reference[k]) !== JSON.stringify(now[k]),
  )
  check(name, diff.length === 0, diff.length ? diff : Object.keys(reference).length)
}

try {
  const leader = await login('leader@example.test')
  const member = await login('member@example.test')

  // WF04: a PUBLISHED programme with its canonical form.
  const programme = await api(
    leader,
    'POST',
    '/programmes',
    { type: 'PROGRAMME', organization_id: CHAPTER_01, name: `WF05 restart ${Date.now()}` },
    true,
  )
  check('programme created', programme.status === 201, programme.status)
  created.programme = programme.body.programme.id
  const form = await api(leader, 'PUT', `/programmes/${created.programme}/registration`, {
    applicant_types: ['TEAM', 'STARTUP'],
    questions: [{ id: 'q-1', prompt: 'Vấn đề?', required: true, step: 1 }],
  })
  check('form saved', form.status === 200, form.status)
  const published = await api(
    leader,
    'POST',
    `/programmes/${created.programme}/publish`,
    undefined,
    true,
  )
  check('programme published', published.status === 200, published.status)

  // WF02: a new PROJECT venture with an ACTIVE member (no invitation e-mail locally).
  const venture = await api(
    member,
    'POST',
    '/ventures',
    {
      type: 'PROJECT',
      name: `WF05 restart venture ${Date.now()}`,
      summary: 'Một dòng',
      domain_ids: [DOMAIN],
      stage_id: STAGE,
    },
    true,
  )
  check('venture created', venture.status === 201, venture.status)
  created.venture = venture.body.id ?? venture.body.venture?.id
  const db = new pg.Client({ connectionString: DATABASE_URL })
  await db.connect()
  await db.query(
    `INSERT INTO project_members (project_id, profile_id, role_label, state, joined_at, permission, updated_at)
     VALUES ($1, $2, 'Thành viên', 'ACTIVE', now(), 'EDIT', now())`,
    [created.venture, LEADER_PROFILE],
  )
  await db.end()

  // WF05: a DRAFT with answers and a SUBMITTED application.
  const draft = await api(
    member,
    'POST',
    '/applications',
    { venture_id: created.venture, programme_id: created.programme },
    true,
  )
  check('draft created', draft.status === 201, draft.status)
  created.applications.push(draft.body.id)
  const answered = await api(member, 'PATCH', `/applications/${draft.body.id}`, {
    answers: [{ question_id: 'q-1', value: 'Nháp chưa nộp.' }],
  })
  check('draft answers saved', answered.status === 200, answered.status)
  const second = await api(
    member,
    'POST',
    '/applications',
    { venture_id: SEED_STARTUP, programme_id: created.programme },
    true,
  )
  check('second application created', second.status === 201, second.status)
  created.applications.push(second.body.id)
  await api(member, 'PATCH', `/applications/${second.body.id}`, {
    answers: [{ question_id: 'q-1', value: 'Đã nộp.' }],
  })
  const submitted = await api(
    member,
    'POST',
    `/applications/${second.body.id}/submit`,
    undefined,
    true,
  )
  check('application submitted', submitted.status === 200, submitted.status)

  reads = {
    draft: `/applications/${draft.body.id}`,
    submitted: `/applications/${second.body.id}`,
    mine: '/me/applications',
    venture: `/ventures/${created.venture}`,
    ventureView: `/demo/projects/${created.venture}`,
    list: '/demo/projects',
  }
  const reference = await readAll(member)
  check(
    'reference reads',
    Object.values(reference).every((r) => r.status === 200),
    reference,
  )
  same('after a refresh (same session, read again)', reference, await readAll(member))

  // Application restart.
  for (const pid of pidsOn(3972)) process.kill(Number(pid))
  await sleep(1500)
  spawn('pnpm', ['start'], {
    cwd: ROOT,
    env: { ...process.env, PORT: '3972', ENABLE_DEV_ROUTES: '1' },
    detached: true,
    stdio: 'ignore',
  }).unref()
  await waitFor(`${BASE}/`, (s) => s === 200)
  same('after an application restart', reference, await readAll(member))

  // PostgreSQL restart.
  execSync(`docker restart ${DB_CONTAINER}`, { stdio: 'ignore' })
  for (let i = 0; i < 30; i += 1) {
    try {
      execSync(`docker exec ${DB_CONTAINER} pg_isready -q`, { stdio: 'ignore' })
      break
    } catch {
      await sleep(1000)
    }
  }
  same('after a database restart', reference, await readAll(member))

  // A new login.
  same('after a new login', reference, await readAll(await login('member@example.test')))

  const facts = new pg.Client({ connectionString: DATABASE_URL })
  await facts.connect()
  const { rows } = await facts.query(
    `SELECT a.status::text, a.venture_id::text, a.programme_id::text, a.question_set_version,
            f.version AS form_version, m.state::text AS member_state
       FROM applications a
       JOIN programme_application_forms f ON f.programme_id = a.programme_id
       LEFT JOIN project_members m ON m.project_id = $1 AND m.profile_id = $2
      WHERE a.id = ANY($3::uuid[]) ORDER BY a.created_at`,
    [created.venture, LEADER_PROFILE, created.applications],
  )
  await facts.end()
  check(
    'canonical rows after every restart',
    rows.length === 2 &&
      rows[0].status === 'DRAFT' &&
      rows[1].status === 'SUBMITTED' &&
      rows.every(
        (r) => r.programme_id === created.programme && r.question_set_version === r.form_version,
      ) &&
      rows[0].venture_id === created.venture &&
      rows[0].member_state === 'ACTIVE',
    rows,
  )
  evidence.ok = true
} catch (error) {
  evidence.ok = false
  evidence.error = String(error)
} finally {
  const db = new pg.Client({ connectionString: DATABASE_URL })
  await db.connect()
  await db.query('BEGIN')
  await db.query('SET LOCAL session_replication_role = replica')
  await db.query('DELETE FROM applications WHERE id = ANY($1::uuid[])', [created.applications])
  await db.query('COMMIT')
  await db.query('DELETE FROM audit_events WHERE resource_id = ANY($1::uuid[])', [
    [...created.applications, created.venture, created.programme].filter(Boolean),
  ])
  if (created.venture) {
    await db.query('DELETE FROM project_members WHERE project_id = $1', [created.venture])
    await db.query('DELETE FROM projects WHERE id = $1', [created.venture])
  }
  if (created.programme) {
    await db.query('DELETE FROM programme_application_forms WHERE programme_id = $1', [
      created.programme,
    ])
    await db.query('DELETE FROM programmes WHERE id = $1', [created.programme])
  }
  await db.end()
  console.log(JSON.stringify(evidence, null, 2))
  process.exit(evidence.ok ? 0 : 1)
}
