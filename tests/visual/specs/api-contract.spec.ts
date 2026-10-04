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

  test('reports no authenticated identity for a request without a session', async ({ request }) => {
    // Written in M0-T05, before the session store existed; since M0-T08 the
    // store is real, and a request carrying no session cookie must still get no
    // fabricated account, profile or capabilities.
    const response = await request.get(`${BASE}/session`)
    const body = (await response.json()) as Record<string, unknown>

    expect(body.authenticated).toBe(false)
    expect(body).not.toHaveProperty('account')
    expect(body).not.toHaveProperty('profile')
    expect(body).not.toHaveProperty('capabilities')
  })
})

test.describe('M0-T05 API surface discipline', () => {
  test('exposes no business endpoint beyond the implemented screens', async ({ request }) => {
    // M0-T08 implemented the auth endpoints, so they are no longer absent; they
    // are covered by auth-session.spec.ts. WF01-S06 implemented /me/profile and
    // /vocabularies/{type} (wf01-s06-onboarding-profile.spec.ts); WF02-T00
    // implemented /me/network (wf02-t00-member-foundation.spec.ts); WF03-T00
    // implemented GET /ops/organizations (wf03-t00-ops-foundation.spec.ts), WF03-S02
    // GET /ops/organizations/{id}/dashboard (wf03-s02-organization-dashboard.spec.ts),
    // WF03-S03 GET /ops/organizations/{id}/members (wf03-s03-organization-members.spec.ts),
    // WF03-S04 member detail, membership review and leadership
    // (wf03-s04-membership-review.spec.ts), WF03-S06 PATCH …/profile
    // (wf03-s06-organization-profile.spec.ts), WF03-S08 GET/POST …/relationships and
    // …/relationships/{id}/close (wf03-s08-organization-relationships.spec.ts), WF03-S07
    // events (wf03-s07-event-management.spec.ts), WF03-S09 GET /organizations/by-slug/{slug}
    // (wf03-s09-public-organization.spec.ts), WF02-S08 GET /me/ventures (asserted
    // below; wf02-s08-projects.spec.ts), and ADMIN-PROD-05 GET /ops/feedback (05 §28;
    // admin-prod-05-api.spec.ts). Other business endpoints still belong to later
    // screens; answering now would be scope leakage.
    for (const path of [
      '/ops/organizations/10000000-0000-0000-0000-000000000101/programmes',
      '/vocabularies/STARTUP_STAGE',
    ]) {
      const response = await request.get(`${BASE}${path}`)
      expect(response.status(), `${path} should not be implemented yet`).toBe(404)
    }
  })

  test('GET /me/ventures is implemented as contracted: a session gets { items, page }', async ({
    request,
  }) => {
    // Contract 05 §5.3 and 05:1331 (listOwnVentures, WF02-S01 / WF02-S08).
    const guest = await request.get(`${BASE}/me/ventures`)
    expect(guest.status()).toBe(401)
    const body = (await guest.json()) as { error: { code: string; request_id: string } }
    expect(body.error.code).toBe('UNCONTRACTED_UNAUTHENTICATED')
    expect(body.error.request_id).toMatch(/^req_/)

    expect(
      (await request.post('/dev/login', { data: { email: 'member@example.test' } })).ok(),
    ).toBe(true)
    const own = await request.get(`${BASE}/me/ventures`)
    expect(own.status()).toBe(200)
    const list = (await own.json()) as { items: unknown[]; page: unknown }
    expect(Array.isArray(list.items)).toBe(true)
    expect(list.page).toBeTruthy()
  })

  test('auth endpoints exist but reject the wrong method', async ({ request }) => {
    // POST-only endpoints answer 405, not 404: they exist as of M0-T08.
    for (const path of ['/auth/magic-link', '/auth/magic-link/consume', '/auth/logout']) {
      const response = await request.get(`${BASE}${path}`)
      expect(response.status(), `${path} should exist as POST-only`).toBe(405)
    }
  })

  test('serves the API only under the versioned base path', async ({ request }) => {
    const unversioned = await request.get('/api/session')

    expect(unversioned.status()).toBe(404)
  })
})
