import { expect, test, type APIRequestContext } from '@playwright/test'

import { SESSION_COOKIE_NAME } from '../../../src/lib/auth/config'
import { createSession } from '../../../src/lib/auth/sessions'
import { closePool } from '../../../src/lib/db/client'
import {
  clearLibraryFixture,
  LIBRARY_FX,
  seedLibraryFixture,
  type LibraryFixture,
} from '../../../src/lib/library/testing'
import { writeJsonReport } from '../pixel-qa/report'

/**
 * WF06-PROD-03 — the Library read API over real HTTP on the built server
 * (API §25): route inventory, methods, the session cookie, spoofed headers and
 * forged parameters, the error envelope and a timing smoke. Handler-level
 * cases (merge, external failure, pagination, data exclusion, query counts)
 * are in `src/lib/library/library-routes.db-test.ts`.
 */

let fx: LibraryFixture
let member: Record<string, string>

test.beforeAll(async () => {
  fx = await seedLibraryFixture()
  const { token } = await createSession(fx.accounts.stranger)
  member = { cookie: `${SESSION_COOKIE_NAME}=${token}` }
})

test.afterAll(async () => {
  await clearLibraryFixture()
  await closePool()
})

const ROUTES = ['startups', 'founders', 'problems'].map((r) => `/api/v1/library/${r}`)
const SPOOF = {
  'x-role': 'PLATFORM_ADMIN',
  'x-account-id': '00000000-0000-0000-0000-000000000001',
  'x-visibility': 'PUBLIC',
  'x-forwarded-user': 'admin',
}

async function json(request: APIRequestContext, url: string, headers: Record<string, string> = {}) {
  const started = Date.now()
  const response = await request.get(url, { headers })
  return { response, ms: Date.now() - started, body: await response.json() }
}

test.describe('WF06 Library read API', () => {
  test('inventory: three GET routes, read-only, no record route beside them', async ({
    request,
  }) => {
    for (const url of ROUTES) {
      const { response, body } = await json(request, url)
      expect(response.status(), url).toBe(200)
      expect(response.headers()['cache-control'], url).toBe('private, no-store')
      expect(response.headers()['x-request-id'], url).toMatch(/^req_/)
      expect(body.page.limit, url).toBe(9)
      for (const method of ['post', 'put', 'patch', 'delete'] as const) {
        expect((await request[method](url, { data: {} })).status(), `${method} ${url}`).toBe(405)
      }
    }
    const absent = [
      '/api/v1/library',
      `/api/v1/library/startups/${fx.ventures['WF06 An Khang']}`,
      `/api/v1/library/founders/${fx.owners.lan}`,
      '/api/v1/library/ventures',
      '/api/v1/library/members',
      '/api/v1/library/programmes',
      '/api/v1/library/challenges',
      '/api/v1/library/recommendations',
      '/api/v1/library/search',
    ]
    for (const url of absent) expect((await request.get(url)).status(), url).toBe(404)
  })

  test('founders: the session cookie decides; spoofed headers and forged parameters change nothing', async ({
    request,
  }) => {
    const guest = await json(request, '/api/v1/library/founders?q=WF06')
    expect(guest.body).toMatchObject({ items: [], total: 0, restricted: true })
    const spoofed = await json(request, '/api/v1/library/founders?q=WF06', SPOOF)
    expect(spoofed.body).toEqual(guest.body)

    const signedIn = await json(request, '/api/v1/library/founders?q=WF06', member)
    expect(signedIn.response.headers()['vary']).toContain('Cookie')
    expect(signedIn.body.restricted).toBe(false)
    expect(signedIn.body.items.map((f: { display_name: string }) => f.display_name)).toEqual([
      'WF06 Founder Hải',
      'WF06 Founder Lan',
    ])

    const forged = await request.get(
      `/api/v1/library/startups?q=WF06&visibility=PRIVATE&owner_profile_id=${fx.owners.hidden}&include_private=1`,
      { headers: { ...member, ...SPOOF } },
    )
    expect(forged.status()).toBe(422)
    const error = await forged.json()
    expect(error.error).toMatchObject({
      code: 'PROFILE_VALIDATION_FAILED',
      fields: {
        visibility: 'not_accepted',
        owner_profile_id: 'not_accepted',
        include_private: 'not_accepted',
      },
    })
    expect(JSON.stringify(error)).not.toMatch(/stack|select |\.ts:|node_modules/i)
  })

  test('startups: same answer for every viewer; private ventures never; timings recorded', async ({
    request,
  }) => {
    const timings: Array<{ url: string; actor: string; status: number; ms: number }> = []
    const urls = [
      '/api/v1/library/startups?q=WF06&limit=50',
      `/api/v1/library/startups?q=WF06&domain_id=${LIBRARY_FX.domain.edtech}&sort=NAME`,
      '/api/v1/library/startups',
      '/api/v1/library/founders?limit=50',
      '/api/v1/library/problems?limit=50',
      '/api/v1/library/problems?area=H%C3%A0%20N%E1%BB%99i&sort=PRIZE',
    ]
    for (const url of urls) {
      for (const [actor, headers] of [
        ['guest', {}],
        ['member', member],
      ] as const) {
        const { response, ms } = await json(request, url, headers)
        timings.push({ url, actor, status: response.status(), ms })
        expect(response.status(), url).toBe(200)
        expect(ms, url).toBeLessThan(2000)
      }
    }
    const guest = await json(request, urls[0]!)
    const signedIn = await json(request, urls[0]!, member)
    expect(signedIn.body).toEqual(guest.body)
    const text = JSON.stringify(guest.body)
    for (const hidden of ['Kín Đáo', 'Bản Nháp', 'Lưu Trữ', 'Dự Án', 'Riêng Tư']) {
      expect(text).not.toContain(hidden)
    }
    writeJsonReport('WF06-PROD-03.api-timings.json', { timings })
  })
})
