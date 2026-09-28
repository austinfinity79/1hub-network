import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  deliverMagicLink,
  magicLinkUrl,
  publicBaseUrl,
  readDevOutbox,
  renderMagicLinkEmail,
} from './magic-link-email'

/** TASK 22-PREVIEW-AUTH — link origin, e-mail copy and transport choice (DEC-AUTH-EMAIL-D3). */
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('publicBaseUrl', () => {
  it('uses APP_PUBLIC_BASE_URL and requires HTTPS', () => {
    vi.stubEnv('ENABLE_DEV_ROUTES', '')
    vi.stubEnv('APP_PUBLIC_BASE_URL', 'https://1hubnetwork.io.vn/')
    expect(publicBaseUrl('http://10.0.0.5:3000')).toBe('https://1hubnetwork.io.vn')
    vi.stubEnv('APP_PUBLIC_BASE_URL', 'http://1hubnetwork.io.vn')
    expect(() => publicBaseUrl()).toThrow(/base_url_not_https/)
    vi.stubEnv('APP_PUBLIC_BASE_URL', 'http://localhost:3972')
    expect(() => publicBaseUrl()).toThrow(/base_url_not_https/)
  })

  it('without a configured origin: the request origin with dev routes only, else it fails closed', () => {
    vi.stubEnv('APP_PUBLIC_BASE_URL', '')
    vi.stubEnv('ENABLE_DEV_ROUTES', '')
    expect(() => publicBaseUrl('http://localhost:3972')).toThrow(/base_url_not_configured/)
    vi.stubEnv('ENABLE_DEV_ROUTES', '1')
    expect(publicBaseUrl('http://localhost:3972/api/v1/auth/magic-link')).toBe(
      'http://localhost:3972',
    )
  })
})

describe('renderMagicLinkEmail', () => {
  it('carries the subject, one CTA to the callback, the 15-minute single-use note and the ignore line', () => {
    const link = magicLinkUrl('tok+/=', 'https://1hubnetwork.io.vn')
    expect(link).toBe('https://1hubnetwork.io.vn/auth/callback?token=tok%2B%2F%3D')
    const email = renderMagicLinkEmail('a@example.test', link)
    expect(email.subject).toBe('Đăng nhập 1hub.network')
    expect(email.html.match(/<a /g)).toHaveLength(1)
    expect(email.html).toContain(`href="${link}"`)
    for (const body of [email.html, email.text]) {
      expect(body).toContain('15 phút và chỉ dùng được một lần')
      expect(body).toContain('Nếu bạn không yêu cầu đăng nhập, hãy bỏ qua email này.')
    }
    expect(email.text).toContain(link)
  })
})

describe('deliverMagicLink', () => {
  it('sends through Resend with the public HTTPS link and logs only the id and a masked address', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_never_logged')
    vi.stubEnv('EMAIL_FROM', '1Hub Network <no-reply@1hubnetwork.io.vn>')
    vi.stubEnv('APP_PUBLIC_BASE_URL', 'https://1hubnetwork.io.vn')
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: 'msg_2' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await deliverMagicLink('member@example.test', 'secret-token', 'http://internal:3000')
    const sent = JSON.parse(
      String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    )
    expect(sent.html).toContain('https://1hubnetwork.io.vn/auth/callback?token=secret-token')
    const logged = JSON.stringify(info.mock.calls)
    expect(logged).toContain('msg_2')
    expect(logged).not.toContain('secret-token')
    expect(logged).not.toContain('re_never_logged')
    expect(logged).not.toContain('member@example.test')
  })

  it('uses the dev outbox only with dev routes on and no key; otherwise fails closed', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('APP_PUBLIC_BASE_URL', '')
    vi.stubEnv('ENABLE_DEV_ROUTES', '1')
    await deliverMagicLink('dev@example.test', 'tok', 'http://localhost:3972')
    expect(readDevOutbox('dev@example.test')).toEqual({
      link: 'http://localhost:3972/auth/callback?token=tok',
    })
    vi.stubEnv('ENABLE_DEV_ROUTES', '')
    expect(readDevOutbox('dev@example.test')).toBeNull()
    await expect(
      deliverMagicLink('x@example.test', 'tok', 'http://localhost:3972'),
    ).rejects.toMatchObject({ reason: 'base_url_not_configured' })
  })
})
