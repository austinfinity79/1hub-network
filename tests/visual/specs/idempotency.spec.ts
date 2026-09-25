import { expect, test } from '@playwright/test'

/**
 * M0-T10 — idempotency through the real HTTP endpoint.
 *
 * The integration suite proves the store. This proves the wiring: that the
 * header actually reaches it over the wire, that a retry replays rather than
 * issuing a second link, and that the conflict surfaces in the frozen error
 * envelope rather than as an unshaped 500.
 */

const MAGIC_LINK = '/api/v1/auth/magic-link'

function uniqueKey(label: string): string {
  return `pw-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

test.describe('M0-T10 idempotent magic-link requests', () => {
  test('a retry with the same key returns the first response', async ({ request }) => {
    const key = uniqueKey('replay')
    const data = { email: 'pw-idem-replay@example.test' }

    const first = await request.post(MAGIC_LINK, { data, headers: { 'Idempotency-Key': key } })
    const second = await request.post(MAGIC_LINK, { data, headers: { 'Idempotency-Key': key } })

    expect(first.status()).toBe(202)
    expect(second.status()).toBe(202)

    const firstBody = await first.json()
    const secondBody = await second.json()

    // Identical, including request_id: one authentication request, not two.
    expect(secondBody).toEqual(firstBody)
    expect(typeof firstBody.request_id).toBe('string')
  })

  test('a different case of the same address still replays', async ({ request }) => {
    const key = uniqueKey('case')

    const first = await request.post(MAGIC_LINK, {
      data: { email: 'pw-idem-case@example.test' },
      headers: { 'Idempotency-Key': key },
    })
    const second = await request.post(MAGIC_LINK, {
      data: { email: 'PW-Idem-Case@Example.Test' },
      headers: { 'Idempotency-Key': key },
    })

    expect(first.status()).toBe(202)
    expect(second.status()).toBe(202)
    expect(await second.json()).toEqual(await first.json())
  })

  test('reusing a key for a different address is a 409 in the frozen envelope', async ({
    request,
  }) => {
    const key = uniqueKey('conflict')

    const first = await request.post(MAGIC_LINK, {
      data: { email: 'pw-idem-first@example.test' },
      headers: { 'Idempotency-Key': key },
    })
    expect(first.status()).toBe(202)

    const clash = await request.post(MAGIC_LINK, {
      data: { email: 'pw-idem-other@example.test' },
      headers: { 'Idempotency-Key': key },
    })

    expect(clash.status()).toBe(409)

    const body = await clash.json()
    // The envelope is the frozen one; only the code is namespaced uncontracted.
    expect(Object.keys(body)).toEqual(['error'])
    expect(body.error.code).toBe('UNCONTRACTED_IDEMPOTENCY_CONFLICT')
    expect(typeof body.error.message).toBe('string')
    expect(typeof body.error.request_id).toBe('string')
  })

  test('distinct keys remain independent requests', async ({ request }) => {
    const data = { email: 'pw-idem-distinct@example.test' }

    const first = await request.post(MAGIC_LINK, {
      data,
      headers: { 'Idempotency-Key': uniqueKey('distinct-a') },
    })
    const second = await request.post(MAGIC_LINK, {
      data,
      headers: { 'Idempotency-Key': uniqueKey('distinct-b') },
    })

    expect(first.status()).toBe(202)
    expect(second.status()).toBe(202)
    // Different keys mean genuinely separate requests, so the ids differ.
    expect((await second.json()).request_id).not.toBe((await first.json()).request_id)
  })

  test('concurrent retries of one key yield one response', async ({ request }) => {
    const key = uniqueKey('race')
    const data = { email: 'pw-idem-race@example.test' }

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post(MAGIC_LINK, { data, headers: { 'Idempotency-Key': key } }),
      ),
    )

    const accepted = responses.filter((r) => r.status() === 202)
    expect(accepted.length).toBeGreaterThanOrEqual(1)

    // Every accepted response describes the same single request.
    const bodies = await Promise.all(accepted.map((r) => r.json()))
    const ids = new Set(bodies.map((b) => b.request_id))
    expect(ids.size).toBe(1)

    // Anything not accepted is the documented conflict, never a 500.
    for (const response of responses) {
      if (response.status() === 202) continue
      expect(response.status()).toBe(409)
      expect((await response.json()).error.code).toBe('UNCONTRACTED_IDEMPOTENCY_CONFLICT')
    }
  })

  test('a request without the header is still processed', async ({ request }) => {
    // PROVISIONAL leniency, documented in IDEMPOTENCY_STORE_P0.md: the contract
    // requires the client to send the header but names no error code for its
    // absence, so the server does not invent one.
    const response = await request.post(MAGIC_LINK, {
      data: { email: 'pw-idem-noheader@example.test' },
    })

    expect(response.status()).toBe(202)
  })

  test('an over-length key is ignored rather than stored', async ({ request }) => {
    // readIdempotencyKey caps the key at 255 characters, so an over-length one
    // falls through to the non-idempotent path instead of being stored. The
    // control-character rejection is proven in the unit suite instead: this HTTP
    // client refuses to transmit those bytes at all, so the server never sees
    // them and the assertion could not reach the code it claims to test.
    const response = await request.post(MAGIC_LINK, {
      data: { email: 'pw-idem-badkey@example.test' },
      headers: { 'Idempotency-Key': 'k'.repeat(300) },
    })

    expect(response.status()).toBe(202)

    // Proven by consequence: an ignored key stores nothing, so the same
    // over-length key cannot replay and the second request is served afresh.
    const again = await request.post(MAGIC_LINK, {
      data: { email: 'pw-idem-badkey@example.test' },
      headers: { 'Idempotency-Key': 'k'.repeat(300) },
    })

    expect(again.status()).toBe(202)
    expect((await again.json()).request_id).not.toBe((await response.json()).request_id)
  })
})
