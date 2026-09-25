import { expect, test } from '@playwright/test'

/**
 * M0-T05 — live API contract smoke.
 *
 * The unit tests assert the envelope builders in isolation; this asserts the
 * running server actually honours them over HTTP, which is the only evidence
 * that the Next route handler, the wrapper and the headers line up.
 *
 * Uses Playwright's request fixture rather than a page, because these are
 * server contract assertions with no UI involved.
 */

const BASE = '/api/v1'

test.describe('M0-T05 GET /session', () => {
  test('returns 200 with the unauthenticated shape the contract recommends', async ({
    request,
  }) => {
    const response = await request.get(`${BASE}/session`)

    expect(response.status()).toBe(200)
    // Contract 05:149 permits 200 or 401 and requires one consistent choice.
    // This implementation takes the contract's own recommendation.
    expect(await response.json()).toEqual({ authenticated: false })
  })

  test('always returns a request id header', async ({ request }) => {
    const response = await request.get(`${BASE}/session`)
    const requestId = response.headers()['x-request-id']

    expect(requestId).toBeTruthy()
    expect(requestId).toMatch(/^req_/)
  })

  test('echoes a client-supplied request id for correlation', async ({ request }) => {
    const response = await request.get(`${BASE}/session`, {
      headers: { 'X-Request-ID': 'req_client_supplied' },
    })

    expect(response.headers()['x-request-id']).toBe('req_client_supplied')
  })

  test('serves JSON', async ({ request }) => {
    const response = await request.get(`${BASE}/session`)

    expect(response.headers()['content-type']).toContain('application/json')
  })

  test('reports no authenticated identity, since no session store exists yet', async ({
    request,
  }) => {
    // M0-T05 has no database and no session store, so the endpoint must not
    // fabricate an account. A stub with invented data would be a fake success.
    const response = await request.get(`${BASE}/session`)
    const body = (await response.json()) as Record<string, unknown>

    expect(body.authenticated).toBe(false)
    expect(body).not.toHaveProperty('account')
    expect(body).not.toHaveProperty('profile')
    expect(body).not.toHaveProperty('capabilities')
  })
})

test.describe('M0-T05 API surface discipline', () => {
  test('exposes no endpoint beyond the one M0-T05 implements', async ({ request }) => {
    // Business endpoints belong to M1 onward. Anything answering here now would
    // be scope leakage.
    for (const path of [
      '/auth/magic-link',
      '/me/profile',
      '/me/network',
      '/ops/organizations',
      '/vocabularies/REGION',
    ]) {
      const response = await request.get(`${BASE}${path}`)
      expect(response.status(), `${path} should not be implemented yet`).toBe(404)
    }
  })

  test('serves the API only under the versioned base path', async ({ request }) => {
    const unversioned = await request.get('/api/session')

    expect(unversioned.status()).toBe(404)
  })
})
