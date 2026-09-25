import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from './client'
import { DEFAULT_PAGE_LIMIT, MAX_PAGE_LIMIT, listEnvelope, parseListQuery } from './envelope'
import { ApiError, isApiError, notFound, unauthenticated } from './errors'
import { IDEMPOTENCY_HEADER, readIdempotencyKey, requiresIdempotencyKey } from './idempotency'
import { REQUEST_ID_HEADER, newRequestId, resolveRequestId } from './request-id'

describe('M0-T05 error envelope', () => {
  it('produces exactly the frozen shape', () => {
    const error = new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Profile data is invalid.', {
      region_id: 'A valid region is required.',
    })

    expect(error.toEnvelope('req_abc')).toEqual({
      error: {
        code: 'PROFILE_VALIDATION_FAILED',
        message: 'Profile data is invalid.',
        fields: { region_id: 'A valid region is required.' },
        request_id: 'req_abc',
      },
    })
  })

  it('omits fields entirely when there are none, rather than sending null', () => {
    const envelope = new ApiError('AUTH_LINK_EXPIRED', 400, 'Link expired.').toEnvelope('req_1')

    expect(envelope.error).not.toHaveProperty('fields')
    expect(envelope.error.request_id).toBe('req_1')
  })

  it('distinguishes a contracted failure from a contract gap', () => {
    expect(new ApiError('SCOPE_FORBIDDEN', 403, 'No.').isContracted).toBe(true)
    expect(unauthenticated().isContracted).toBe(false)
    expect(notFound().status).toBe(404)
  })
})

describe('M0-T05 request correlation', () => {
  it('generates an id when the client sends none', () => {
    const id = resolveRequestId(new Headers())

    expect(id).toMatch(/^req_/)
    expect(resolveRequestId(new Headers())).not.toBe(id)
  })

  it('honours a client-supplied id', () => {
    const headers = new Headers({ [REQUEST_ID_HEADER]: 'req_from_client' })

    expect(resolveRequestId(headers)).toBe('req_from_client')
  })

  it('rejects an oversized id instead of echoing it into logs', () => {
    const tooLong = new Headers({ [REQUEST_ID_HEADER]: 'x'.repeat(500) })

    expect(resolveRequestId(tooLong)).toMatch(/^req_/)
  })

  it('rejects the control characters Headers itself lets through', () => {
    // Headers rejects NUL and CR on construction, but ESC, VT and TAB all pass
    // and would corrupt a log line, so the guard is reachable and necessary.
    for (const injected of ['abc\u001bdef', 'abc\u000bdef', 'abc\tdef']) {
      const headers = new Headers({ [REQUEST_ID_HEADER]: injected })
      expect(resolveRequestId(headers), injected).toMatch(/^req_/)
    }
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => newRequestId()))
    expect(ids.size).toBe(50)
  })
})

describe('M0-T05 list envelope', () => {
  it('matches the contract shape with a default limit', () => {
    expect(listEnvelope([])).toEqual({
      items: [],
      page: { next_cursor: null, limit: DEFAULT_PAGE_LIMIT },
    })
  })

  it('carries items and a cursor when given them', () => {
    expect(listEnvelope([{ id: 'a' }], { nextCursor: 'c1', limit: 10 })).toEqual({
      items: [{ id: 'a' }],
      page: { next_cursor: 'c1', limit: 10 },
    })
  })

  it('parses cursor and limit, clamping an absurd limit', () => {
    expect(parseListQuery(new URLSearchParams('cursor=c1&limit=25'))).toEqual({
      cursor: 'c1',
      limit: 25,
    })
    expect(parseListQuery(new URLSearchParams('limit=99999')).limit).toBe(MAX_PAGE_LIMIT)
  })

  it('falls back to the default for a missing or unusable limit', () => {
    for (const query of ['', 'limit=0', 'limit=-3', 'limit=abc', 'limit=1.5']) {
      expect(parseListQuery(new URLSearchParams(query)).limit, query).toBe(DEFAULT_PAGE_LIMIT)
    }
  })
})

describe('M0-T05 idempotency', () => {
  it('recognises the contract operations and rejects others', () => {
    expect(requiresIdempotencyKey('consent.accept-or-revoke')).toBe(true)
    expect(requiresIdempotencyKey('profile.read')).toBe(false)
  })

  it('reads a usable key and refuses an unusable one', () => {
    expect(readIdempotencyKey(new Headers({ [IDEMPOTENCY_HEADER]: 'key-1' }))).toBe('key-1')
    expect(readIdempotencyKey(new Headers())).toBeUndefined()
    expect(
      readIdempotencyKey(new Headers({ [IDEMPOTENCY_HEADER]: 'x'.repeat(300) })),
    ).toBeUndefined()
  })
})

describe('M0-T05 client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  function jsonResponse(body: unknown, status: number, requestId = 'req_server') {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', [REQUEST_ID_HEADER]: requestId },
    })
  }

  it('calls the versioned base path and sends a request id', async () => {
    const fetchMock = stubFetch(jsonResponse({ authenticated: false }, 200))

    await apiRequest('/session')

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('/api/v1/session')
    expect((init.headers as Record<string, string>)[REQUEST_ID_HEADER]).toMatch(/^req_/)
    // The session is an HTTP-only cookie, so credentials must ride along.
    expect(init.credentials).toBe('same-origin')
  })

  it('returns the parsed body on success', async () => {
    stubFetch(jsonResponse({ authenticated: false }, 200))

    await expect(apiRequest('/session')).resolves.toEqual({ authenticated: false })
  })

  it('sends an idempotency key and a JSON body only when given them', async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true }, 200))

    await apiRequest('/me/consents/accept', {
      method: 'POST',
      body: { consent_type: 'TERMS_ACCEPTANCE' },
      idempotencyKey: 'key-9',
    })

    const [, init] = fetchMock.mock.calls[0]!
    const headers = init.headers as Record<string, string>
    expect(headers[IDEMPOTENCY_HEADER]).toBe('key-9')
    expect(headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"consent_type":"TERMS_ACCEPTANCE"}')
  })

  it('throws a typed ApiError carrying the contract code, status and fields', async () => {
    stubFetch(
      jsonResponse(
        {
          error: {
            code: 'PROFILE_VALIDATION_FAILED',
            message: 'Profile data is invalid.',
            fields: { region_id: 'A valid region is required.' },
            request_id: 'req_server',
          },
        },
        422,
      ),
    )

    const caught = await apiRequest('/me/profile', { method: 'PATCH', body: {} }).catch(
      (error: unknown) => error,
    )

    expect(isApiError(caught)).toBe(true)
    const error = caught as ApiError
    expect(error.code).toBe('PROFILE_VALIDATION_FAILED')
    expect(error.status).toBe(422)
    expect(error.fields).toEqual({ region_id: 'A valid region is required.' })
    expect(error.isContracted).toBe(true)
  })

  it('treats a non-enveloped failure as an internal fault rather than data', async () => {
    stubFetch(new Response('<html>gateway error</html>', { status: 502 }))

    const caught = (await apiRequest('/session').catch((e: unknown) => e)) as ApiError

    expect(isApiError(caught)).toBe(true)
    expect(caught.code).toBe('UNCONTRACTED_INTERNAL')
    expect(caught.isContracted).toBe(false)
  })

  it('returns undefined for 204 without trying to parse a body', async () => {
    stubFetch(new Response(null, { status: 204, headers: { [REQUEST_ID_HEADER]: 'req_x' } }))

    await expect(apiRequest('/auth/logout', { method: 'POST' })).resolves.toBeUndefined()
  })
})

// WF01-S01 exposed this: the client imported node:crypto transitively, so the
// first browser component that used it failed to build. The client's whole
// relative import graph must stay browser-safe.
describe('browser safety of the API client', () => {
  it('reaches no node: builtin through client.ts', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join, resolve } = await import('node:path')
    const seen = new Set<string>()
    const offenders: string[] = []
    const visit = (file: string) => {
      if (seen.has(file)) return
      seen.add(file)
      const source = readFileSync(file, 'utf8')
      for (const [, spec] of source.matchAll(/from\s+'([^']+)'/g)) {
        if (spec!.startsWith('node:')) offenders.push(`${file} -> ${spec}`)
        if (spec!.startsWith('./')) visit(resolve(dirname(file), `${spec}.ts`))
      }
    }
    visit(join(process.cwd(), 'src', 'lib', 'api', 'client.ts'))
    expect(seen.size).toBeGreaterThan(2)
    expect(offenders).toEqual([])
  })
})
