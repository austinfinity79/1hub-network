import { expect, test } from '@playwright/test'

/**
 * M0-T09 — authorization smoke through a real browser.
 *
 * Proves that capabilities and managed_scopes are derived server-side from the
 * session, and that nothing the browser can change creates privilege.
 */

const SESSION = '/api/v1/session'
const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'

type SessionBody = {
  authenticated: boolean
  capabilities?: string[]
  managed_scopes?: { scope_type: string; scope_id: string; role_code: string }[]
}

async function sessionAs(request: import('@playwright/test').APIRequestContext, email: string) {
  await request.post('/dev/login', { data: { email } })
  return (await (await request.get(SESSION)).json()) as SessionBody
}

test.describe('M0-T09 session authorization', () => {
  test('an unauthenticated browser has no capabilities at all', async ({ request }) => {
    const body = (await (await request.get(SESSION)).json()) as SessionBody

    expect(body.authenticated).toBe(false)
    expect(body.capabilities).toBeUndefined()
    expect(body.managed_scopes).toBeUndefined()
  })

  test('a plain member receives no ops capabilities', async ({ request }) => {
    const body = await sessionAs(request, 'member@example.test')

    expect(body.authenticated).toBe(true)
    // Membership alone grants nothing, per the approved matrix.
    expect(body.capabilities).toEqual([])
    expect(body.managed_scopes).toEqual([])
  })

  test('a chapter leader receives capabilities scoped to their own organization', async ({
    request,
  }) => {
    const body = await sessionAs(request, 'leader@example.test')

    expect(body.capabilities).toContain('member:read')
    expect(body.capabilities).toContain('event:manage')
    expect(body.managed_scopes).toEqual([
      { scope_type: 'ORGANIZATION', scope_id: CHAPTER_01, role_code: 'HUB_COMMUNITY_LEADER' },
    ])
  })

  test('a platform admin receives the platform scope', async ({ request }) => {
    const body = await sessionAs(request, 'ops@example.test')

    expect(body.managed_scopes).toEqual([
      { scope_type: 'PLATFORM', scope_id: '', role_code: 'PLATFORM_ADMIN' },
    ])
  })

  test('exposes no raw RoleAssignment column', async ({ request }) => {
    const body = await sessionAs(request, 'leader@example.test')

    for (const scope of body.managed_scopes ?? []) {
      expect(Object.keys(scope).sort()).toEqual(['role_code', 'scope_id', 'scope_type'])
    }
    // Database column names must not leak into the wire shape.
    const raw = JSON.stringify(body)
    for (const column of ['individual_profile_id', 'valid_from', 'valid_to', 'assigned_by']) {
      expect(raw, `${column} leaked`).not.toContain(column)
    }
  })
})

test.describe('M0-T09 the browser cannot create privilege', () => {
  test('client state cannot grant a capability', async ({ page, request }) => {
    await request.post('/dev/login', { data: { email: 'member@example.test' } })
    await page.goto(SESSION)

    // Write plausible privilege into every client-side store available.
    await page.evaluate(() => {
      localStorage.setItem('role', 'PLATFORM_ADMIN')
      localStorage.setItem('capabilities', JSON.stringify(['org:manage', 'event:manage']))
      sessionStorage.setItem('scope', 'PLATFORM')
      document.cookie = 'role=PLATFORM_ADMIN; path=/'
    })

    const body = (await (await request.get(SESSION)).json()) as SessionBody
    expect(body.capabilities).toEqual([])
    expect(body.managed_scopes).toEqual([])
  })

  test('forged headers and body do not grant a capability', async ({ request }) => {
    await request.post('/dev/login', { data: { email: 'member@example.test' } })

    const response = await request.get(SESSION, {
      headers: {
        'x-role': 'PLATFORM_ADMIN',
        'x-capabilities': 'org:manage,event:manage',
        'x-scope-id': CHAPTER_01,
      },
    })
    const body = (await response.json()) as SessionBody

    expect(body.capabilities).toEqual([])
    expect(body.managed_scopes).toEqual([])
  })

  test('logout removes privileged session state', async ({ request }) => {
    const before = await sessionAs(request, 'leader@example.test')
    expect(before.capabilities?.length).toBeGreaterThan(0)

    await request.post('/api/v1/auth/logout')

    const after = (await (await request.get(SESSION)).json()) as SessionBody
    expect(after.authenticated).toBe(false)
    expect(after.capabilities).toBeUndefined()
  })
})
