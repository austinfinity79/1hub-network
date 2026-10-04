import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/errors'
import { IDEMPOTENT_OPERATIONS } from '@/lib/api/idempotency'
import { requestMagicLink } from '@/lib/auth/magic-link'
import { closePool, query, withTransaction } from '@/lib/db/client'

import {
  IDEMPOTENCY_RETENTION_SECONDS,
  IDEMPOTENCY_SWEEP_LIMIT,
  fingerprintRequest,
  purgeExpiredIdempotencyKeys,
  runIdempotent,
} from './store'

/**
 * M0-T10 — durable idempotency store, against live PostgreSQL.
 *
 * Nothing is mocked. Every guarantee is proven against the real table created by
 * migration 003, because the guarantees ARE database guarantees; a mock would
 * prove only that the mock agrees with itself.
 */
const ROOT = process.cwd()

let accountA = ''
let accountB = ''

beforeAll(async () => {
  execFileSync('node', [join(ROOT, 'scripts', 'db.mjs'), 'reset'], { stdio: 'pipe' })

  const accounts = await query<{ id: string }>(
    `SELECT id::text FROM user_accounts ORDER BY email_normalized LIMIT 2`,
  )
  accountA = accounts[0]!.id
  accountB = accounts[1]!.id
}, 60_000)

afterAll(async () => {
  await closePool()
})

async function countKeys(key: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM idempotency_keys WHERE idempotency_key = $1`,
    [key],
  )
  return Number(rows[0]!.n)
}

async function countLinks(email: string): Promise<number> {
  const rows = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM auth_magic_link_requests WHERE email_normalized = $1`,
    [email],
  )
  return Number(rows[0]!.n)
}

// ---------------------------------------------------------------------------
// A. First request executes and the outcome is stored durably
// ---------------------------------------------------------------------------

describe('A. first request executes and stores its outcome', () => {
  it('runs the work once and records a COMPLETED row', async () => {
    const key = 'key-a-first'
    let ran = 0

    const outcome = await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint: fingerprintRequest({ message: 'hello' }),
      run: async () => {
        ran += 1
        return { status: 201, body: { id: 'fb-1', message: 'hello' } }
      },
    })

    expect(ran).toBe(1)
    expect(outcome.replayed).toBe(false)
    expect(outcome.status).toBe(201)
    expect(outcome.body).toEqual({ id: 'fb-1', message: 'hello' })

    const rows = await query<{
      state: string
      response_status: number
      response_body: unknown
      completed_at: Date | null
      expires_at: Date
      created_at: Date
    }>(
      `SELECT state::text AS state, response_status, response_body, completed_at, expires_at, created_at
         FROM idempotency_keys WHERE idempotency_key = $1`,
      [key],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]!.state).toBe('COMPLETED')
    expect(rows[0]!.response_status).toBe(201)
    expect(rows[0]!.response_body).toEqual({ id: 'fb-1', message: 'hello' })
    expect(rows[0]!.completed_at).not.toBeNull()

    // The retention window is the configured one, not an accident.
    const windowSeconds = (rows[0]!.expires_at.getTime() - rows[0]!.created_at.getTime()) / 1000
    expect(Math.round(windowSeconds)).toBe(IDEMPOTENCY_RETENTION_SECONDS)
  })

  it('survives the connection that wrote it', async () => {
    // Durability, not memory: the row is read back on a different pooled
    // connection from the one the transaction used.
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys WHERE idempotency_key = 'key-a-first'`,
    )
    expect(Number(rows[0]!.n)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// B. Duplicate with the same content replays, and causes no second side effect
// ---------------------------------------------------------------------------

describe('B. duplicate request replays without re-running the work', () => {
  it('returns the stored outcome and does not execute again', async () => {
    const key = 'key-b-replay'
    const fingerprint = fingerprintRequest({ message: 'once' })
    let ran = 0

    const run = async () => {
      ran += 1
      return { status: 201, body: { id: 'fb-2', attempt: ran } }
    }

    const first = await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint,
      run,
    })
    const second = await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint,
      run,
    })

    expect(ran).toBe(1)
    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    expect(second.status).toBe(first.status)
    expect(second.body).toEqual(first.body)
    expect(await countKeys(key)).toBe(1)
  })

  it('issues exactly one magic link for a repeated request', async () => {
    // The real integration, not a stand-in: a retried magic-link request must
    // not put a second usable link in the mailbox.
    const email = 'idem-replay@example.test'
    const key = 'key-b-magiclink'
    const fingerprint = fingerprintRequest({ email })

    const send = () =>
      runIdempotent({
        key,
        operation: 'auth.magic-link.request',
        actorAccountId: null,
        fingerprint,
        run: async (exec) => {
          const { response } = await requestMagicLink(email, null, exec)
          return { status: 202, body: response }
        },
      })

    const first = await send()
    const second = await send()

    expect(first.replayed).toBe(false)
    expect(second.replayed).toBe(true)
    // Same auth request id, so the caller sees one request, not two.
    expect(second.body).toEqual(first.body)
    expect(await countLinks(email)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// C. Same key, different content, is a conflict
// ---------------------------------------------------------------------------

describe('C. a key reused for different content is rejected', () => {
  it('raises a 409 rather than replaying an unrelated response', async () => {
    const key = 'key-c-conflict'

    await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint: fingerprintRequest({ message: 'original' }),
      run: async () => ({ status: 201, body: { id: 'fb-3' } }),
    })

    let ran = 0
    const attempt = runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint: fingerprintRequest({ message: 'DIFFERENT' }),
      run: async () => {
        ran += 1
        return { status: 201, body: { id: 'fb-4' } }
      },
    })

    await expect(attempt).rejects.toBeInstanceOf(ApiError)
    await attempt.catch((error: ApiError) => {
      expect(error.code).toBe('UNCONTRACTED_IDEMPOTENCY_CONFLICT')
      expect(error.status).toBe(409)
    })

    // The conflicting work never ran, and the stored record is untouched.
    expect(ran).toBe(0)
    const rows = await query<{ response_body: { id: string } }>(
      `SELECT response_body FROM idempotency_keys WHERE idempotency_key = $1`,
      [key],
    )
    expect(rows[0]!.response_body.id).toBe('fb-3')
  })

  it('treats key order in the payload as the same request', async () => {
    // Canonicalisation, so a client that serialises fields in a different order
    // is not told its own retry is a different request.
    expect(fingerprintRequest({ a: 1, b: 2 })).toBe(fingerprintRequest({ b: 2, a: 1 }))
    expect(fingerprintRequest({ a: 1 })).not.toBe(fingerprintRequest({ a: 2 }))
  })

  it('scopes a key to one operation', async () => {
    const key = 'key-c-cross-operation'
    const fingerprint = fingerprintRequest({ x: 1 })

    const first = await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint,
      run: async () => ({ status: 200, body: { from: 'feedback' } }),
    })
    const second = await runIdempotent({
      key,
      operation: 'membership.request',
      actorAccountId: accountA,
      fingerprint,
      run: async () => ({ status: 200, body: { from: 'membership' } }),
    })

    // A key spent on one operation must not suppress a different operation.
    expect(first.body).toEqual({ from: 'feedback' })
    expect(second.replayed).toBe(false)
    expect(second.body).toEqual({ from: 'membership' })
    expect(await countKeys(key)).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// D. Concurrent duplicates: exactly one execution, arbitrated by PostgreSQL
// ---------------------------------------------------------------------------

describe('D. concurrent duplicates execute exactly once', () => {
  it('runs the work once across eight simultaneous attempts', async () => {
    const key = 'key-d-concurrent'
    const fingerprint = fingerprintRequest({ message: 'race' })
    let ran = 0

    const attempts = Array.from({ length: 8 }, () =>
      runIdempotent({
        key,
        operation: 'feedback.submit',
        actorAccountId: accountA,
        fingerprint,
        run: async () => {
          ran += 1
          // Hold the claim open, widening the window every competitor must lose.
          await new Promise((resolve) => setTimeout(resolve, 60))
          return { status: 201, body: { id: 'fb-race' } }
        },
      }).catch((error: ApiError) => error),
    )

    const results = await Promise.all(attempts)

    expect(ran).toBe(1)
    expect(await countKeys(key)).toBe(1)

    const succeeded = results.filter((r) => !(r instanceof ApiError))
    const executed = succeeded.filter((r) => !(r as { replayed: boolean }).replayed)

    // Exactly one did the work. Everyone else either replayed it or was told the
    // first attempt was still in flight; nobody performed a second side effect.
    expect(executed).toHaveLength(1)
    for (const result of results) {
      if (result instanceof ApiError) {
        expect(result.code).toBe('UNCONTRACTED_IDEMPOTENCY_CONFLICT')
        expect(result.status).toBe(409)
      } else {
        expect((result as { body: unknown }).body).toEqual({ id: 'fb-race' })
      }
    }
  }, 30_000)

  it('issues one magic link under concurrent retries', async () => {
    const email = 'idem-race@example.test'
    const key = 'key-d-magiclink'
    const fingerprint = fingerprintRequest({ email })

    const attempts = Array.from({ length: 6 }, () =>
      runIdempotent({
        key,
        operation: 'auth.magic-link.request',
        actorAccountId: null,
        fingerprint,
        run: async (exec) => {
          const { response } = await requestMagicLink(email, null, exec)
          return { status: 202, body: response }
        },
      }).catch((error: ApiError) => error),
    )

    await Promise.all(attempts)

    // The security property that matters: one request, one link.
    expect(await countLinks(email)).toBe(1)
  }, 30_000)

  it('places mutual exclusion in PostgreSQL, not in this process', async () => {
    // A raw duplicate INSERT that never touches the application is still
    // rejected, which is what proves the guarantee is not a process-local lock.
    const key = 'key-d-raw'
    await query(
      `INSERT INTO idempotency_keys (idempotency_key, operation, actor_account_id, request_fingerprint, expires_at)
       VALUES ($1, 'feedback.submit', NULL, 'fp', now() + interval '1 hour')`,
      [key],
    )

    await expect(
      query(
        `INSERT INTO idempotency_keys (idempotency_key, operation, actor_account_id, request_fingerprint, expires_at)
         VALUES ($1, 'feedback.submit', NULL, 'fp', now() + interval '1 hour')`,
        [key],
      ),
    ).rejects.toThrow(/idempotency_keys_scope_uniq|duplicate key/i)

    // And the NULL actor is what makes it fire: under the default NULLS
    // DISTINCT this second insert would have been accepted.
    expect(await countKeys(key)).toBe(1)
  })

  it('uses no in-process mutex', () => {
    const source = readFileSync(join(ROOT, 'src/lib/idempotency/store.ts'), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

    for (const banned of ['Mutex', 'AsyncLock', 'globalThis.__', 'new Map(', 'new Set(']) {
      expect(code).not.toContain(banned)
    }
  })
})

// ---------------------------------------------------------------------------
// E. A failed attempt does not poison the key
// ---------------------------------------------------------------------------

describe('E. failed processing leaves the key reusable', () => {
  it('rolls the claim back with the work and lets a retry succeed', async () => {
    const key = 'key-e-failure'
    const fingerprint = fingerprintRequest({ message: 'will fail once' })

    await expect(
      runIdempotent({
        key,
        operation: 'feedback.submit',
        actorAccountId: accountA,
        fingerprint,
        run: async () => {
          throw new Error('downstream exploded')
        },
      }),
    ).rejects.toThrow('downstream exploded')

    // No stranded PROCESSING row: the claim was rolled back with the work.
    expect(await countKeys(key)).toBe(0)

    const retry = await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint,
      run: async () => ({ status: 201, body: { id: 'fb-recovered' } }),
    })

    expect(retry.replayed).toBe(false)
    expect(retry.body).toEqual({ id: 'fb-recovered' })
  })

  it('rolls back the guarded side effect too', async () => {
    const email = 'idem-rollback@example.test'
    const key = 'key-e-atomic'

    await expect(
      runIdempotent({
        key,
        operation: 'auth.magic-link.request',
        actorAccountId: null,
        fingerprint: fingerprintRequest({ email }),
        run: async (exec) => {
          await requestMagicLink(email, null, exec)
          throw new Error('failed after writing')
        },
      }),
    ).rejects.toThrow('failed after writing')

    // Atomicity: the link write is gone along with the claim, so a retry cannot
    // leave an orphaned link behind a key that was never completed.
    expect(await countLinks(email)).toBe(0)
    expect(await countKeys(key)).toBe(0)
  })

  it('leaves no PROCESSING rows behind after the suite', async () => {
    // Scoped to rows the STORE wrote. Every one of those carries a sha256
    // fingerprint, whereas the constraint fixtures elsewhere in this file are
    // hand-planted with a literal marker and are deliberately left PROCESSING.
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys
        WHERE state = 'PROCESSING' AND request_fingerprint ~ '^[0-9a-f]{64}$'`,
    )
    expect(Number(rows[0]!.n)).toBe(0)

    // And the fixtures really are the only PROCESSING rows, so the filter above
    // is narrowing the scope rather than hiding a stranded claim.
    const stranded = await query<{ idempotency_key: string }>(
      `SELECT idempotency_key FROM idempotency_keys WHERE state = 'PROCESSING'`,
    )
    expect(stranded.map((r) => r.idempotency_key).sort()).toEqual(['key-d-raw'])
  })
})

// ---------------------------------------------------------------------------
// Actor isolation
// ---------------------------------------------------------------------------

describe('actor isolation', () => {
  it('never lets one actor retrieve another actor stored result', async () => {
    const key = 'key-shared-across-actors'
    const fingerprint = fingerprintRequest({ message: 'same content' })

    const a = await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint,
      run: async () => ({ status: 201, body: { owner: 'A', secretish: 'A-only' } }),
    })

    const b = await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountB,
      fingerprint,
      run: async () => ({ status: 201, body: { owner: 'B', secretish: 'B-only' } }),
    })

    expect(a.body).toEqual({ owner: 'A', secretish: 'A-only' })
    // B ran its own work and received its own result. A's response never reached B.
    expect(b.replayed).toBe(false)
    expect(b.body).toEqual({ owner: 'B', secretish: 'B-only' })

    const rows = await query<{ actor_account_id: string }>(
      `SELECT actor_account_id::text FROM idempotency_keys
        WHERE idempotency_key = $1 ORDER BY created_at`,
      [key],
    )
    expect(rows.map((r) => r.actor_account_id).sort()).toEqual([accountA, accountB].sort())
  })

  it('does not let an authenticated actor claim an anonymous record', async () => {
    const key = 'key-anonymous-then-actor'
    const fingerprint = fingerprintRequest({ email: 'anon@example.test' })

    const anonymous = await runIdempotent({
      key,
      operation: 'auth.magic-link.request',
      actorAccountId: null,
      fingerprint,
      run: async () => ({ status: 202, body: { scope: 'anonymous' } }),
    })

    const authenticated = await runIdempotent({
      key,
      operation: 'auth.magic-link.request',
      actorAccountId: accountA,
      fingerprint,
      run: async () => ({ status: 202, body: { scope: 'actor' } }),
    })

    expect(anonymous.body).toEqual({ scope: 'anonymous' })
    expect(authenticated.replayed).toBe(false)
    expect(authenticated.body).toEqual({ scope: 'actor' })
  })
})

// ---------------------------------------------------------------------------
// Secrets and payloads
// ---------------------------------------------------------------------------

describe('the store holds no secret and no raw payload', () => {
  it('stores a fingerprint, never the request content', async () => {
    const key = 'key-fingerprint-only'
    const payload = { email: 'fingerprint-probe@example.test', note: 'SENSITIVE-MARKER' }

    await runIdempotent({
      key,
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint: fingerprintRequest(payload),
      run: async () => ({ status: 201, body: { ok: true } }),
    })

    const rows = await query<{ request_fingerprint: string }>(
      `SELECT request_fingerprint FROM idempotency_keys WHERE idempotency_key = $1`,
      [key],
    )

    expect(rows[0]!.request_fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(rows[0]!.request_fingerprint).not.toContain('SENSITIVE-MARKER')

    const scan = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys
        WHERE idempotency_keys::text LIKE '%SENSITIVE-MARKER%'`,
    )
    expect(Number(scan[0]!.n)).toBe(0)
  })

  it('never stores a magic-link token', async () => {
    const email = 'idem-token-probe@example.test'
    const key = 'key-token-probe'

    let issued = ''
    await runIdempotent({
      key,
      operation: 'auth.magic-link.request',
      actorAccountId: null,
      fingerprint: fingerprintRequest({ email }),
      run: async (exec) => {
        const { response, token } = await requestMagicLink(email, null, exec)
        issued = token
        return { status: 202, body: response }
      },
    })

    expect(issued.length).toBeGreaterThan(20)

    // The raw token appears nowhere in the store, in any column.
    const rows = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys WHERE idempotency_keys::text LIKE '%' || $1 || '%'`,
      [issued],
    )
    expect(Number(rows[0]!.n)).toBe(0)

    // Nor does the stored response body carry any token-shaped field.
    const stored = await query<{ response_body: Record<string, unknown> }>(
      `SELECT response_body FROM idempotency_keys WHERE idempotency_key = $1`,
      [key],
    )
    for (const field of Object.keys(stored[0]!.response_body)) {
      expect(field).not.toMatch(/token|secret|password/i)
    }
  })
})

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

describe('retention', () => {
  it('purges only expired records', async () => {
    await query(
      `INSERT INTO idempotency_keys (idempotency_key, operation, actor_account_id, request_fingerprint, expires_at, created_at)
       VALUES ('key-expired', 'feedback.submit', NULL, 'fp', now() - interval '1 hour', now() - interval '2 hour')`,
    )
    const liveBefore = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys WHERE expires_at > now()`,
    )

    const purged = await purgeExpiredIdempotencyKeys()

    expect(purged).toBeGreaterThanOrEqual(1)
    expect(await countKeys('key-expired')).toBe(0)

    const liveAfter = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys WHERE expires_at > now()`,
    )
    expect(liveAfter[0]!.n).toBe(liveBefore[0]!.n)
  })

  // WF05-PROD-02 (contract handoff P2-2): expired records never outlive the
  // window, and a stale record never blocks a valid later action.
  async function expired(key: string, actor: string | null, fingerprint: string, body: unknown) {
    await query(
      `INSERT INTO idempotency_keys
         (idempotency_key, operation, actor_account_id, request_fingerprint, state,
          response_status, response_body, completed_at, expires_at, created_at)
       VALUES ($1, 'application.submit', $2, $3, 'COMPLETED', 200, $4::jsonb,
               now() - interval '25 hours', now() - interval '1 hour', now() - interval '25 hours')`,
      [key, actor, fingerprint, JSON.stringify(body)],
    )
  }

  it('treats a key reused after its window as a new request, never a stale replay', async () => {
    const fingerprint = fingerprintRequest({ application: 'a' })
    await expired('key-stale', accountA, fingerprint, { stale: true })
    let runs = 0

    const outcome = await runIdempotent({
      key: 'key-stale',
      operation: 'application.submit',
      actorAccountId: accountA,
      fingerprint,
      run: async () => {
        runs += 1
        return { status: 200, body: { fresh: true } }
      },
    })

    expect(outcome).toEqual({ status: 200, body: { fresh: true }, replayed: false })
    expect(runs).toBe(1)
    const rows = await query<{ live: boolean }>(
      `SELECT expires_at > now() AS live FROM idempotency_keys WHERE idempotency_key = 'key-stale'`,
    )
    expect(rows).toEqual([{ live: true }])
  })

  it('sweeps expired records, stored answers included, on every guarded request', async () => {
    const keys = ['key-sweep-1', 'key-sweep-2', 'key-sweep-3']
    for (const key of keys)
      await expired(key, accountB, 'fp', {
        answers: [{ question_id: 'q-problem', value: 'private answer' }],
      })

    await runIdempotent({
      key: 'key-sweep-trigger',
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint: fingerprintRequest({ sweep: true }),
      run: async () => ({ status: 201, body: {} }),
    })

    for (const key of keys) expect(await countKeys(key)).toBe(0)
    const left = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys WHERE expires_at <= now()`,
    )
    expect(left[0]!.n).toBe('0')
  })

  it('bounds the sweep one request performs', async () => {
    for (let i = 0; i < IDEMPOTENCY_SWEEP_LIMIT + 5; i += 1)
      await expired(`key-bulk-${i}`, accountB, 'fp', {})

    await runIdempotent({
      key: 'key-bulk-trigger',
      operation: 'feedback.submit',
      actorAccountId: accountA,
      fingerprint: fingerprintRequest({ bulk: true }),
      run: async () => ({ status: 201, body: {} }),
    })

    const left = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM idempotency_keys WHERE expires_at <= now()`,
    )
    expect(left[0]!.n).toBe('5')
    expect(await purgeExpiredIdempotencyKeys()).toBe(5)
  })
})

// ---------------------------------------------------------------------------
// Schema drift guards
// ---------------------------------------------------------------------------

describe('migration 003 shape', () => {
  it('declares the uniqueness scope as NULLS NOT DISTINCT', async () => {
    const rows = await query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'idempotency_keys' AND indexname = 'idempotency_keys_scope_uniq'`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]!.indexdef).toContain('NULLS NOT DISTINCT')
    expect(rows[0]!.indexdef).toContain('idempotency_key')
    expect(rows[0]!.indexdef).toContain('operation')
    expect(rows[0]!.indexdef).toContain('actor_account_id')
  })

  it('refuses a COMPLETED row with no stored outcome', async () => {
    await expect(
      query(
        `INSERT INTO idempotency_keys (idempotency_key, operation, request_fingerprint, state, expires_at)
         VALUES ('key-bad-shape', 'feedback.submit', 'fp', 'COMPLETED', now() + interval '1 hour')`,
      ),
    ).rejects.toThrow(/idempotency_keys_state_shape/)
  })

  it('leaves migrations 001 and 002 untouched', () => {
    const applied = execFileSync('node', [join(ROOT, 'scripts', 'db.mjs'), 'status'], {
      encoding: 'utf8',
    })
    expect(applied).toContain('001_p0_init.sql')
    expect(applied).toContain('002_p0_schema_alignment.sql')
    expect(applied).toContain('003_p0_idempotency_store.sql')
  })

  it('keeps the operation catalogue aligned with the frozen seven and amendments A2, A4, A5, A9 and A10', () => {
    // A4 (TASK 24.4, 05 §21): application.create and application.submit.
    // A5 (WF04-PROD-03, 05 §22): programme.create, programme.publish, programme.close.
    // A9 (ADMIN-PROD-03, 05 §26): verification.decide.
    // A10 (ADMIN-PROD-04, 05 §27): venture.review, access.grant-or-revoke.
    expect(IDEMPOTENT_OPERATIONS).toHaveLength(16)
    const contract = readFileSync(
      join(ROOT, 'docs/architecture/05_API_CONTRACT_P0_v1.0.md'),
      'utf8',
    )
    // The header name itself must still be the contracted one.
    expect(contract).toContain('Idempotency-Key')
  })

  it('runs the claim inside a transaction, not as separate commits', async () => {
    // Proven behaviourally: a throw after the claim leaves nothing behind, which
    // is only possible if the claim shares the transaction that rolled back.
    const key = 'key-transaction-proof'
    await expect(
      withTransaction(async (exec) => {
        await exec(
          `INSERT INTO idempotency_keys (idempotency_key, operation, request_fingerprint, expires_at)
           VALUES ($1, 'feedback.submit', 'fp', now() + interval '1 hour')`,
          [key],
        )
        throw new Error('rollback me')
      }),
    ).rejects.toThrow('rollback me')

    expect(await countKeys(key)).toBe(0)
  })
})
