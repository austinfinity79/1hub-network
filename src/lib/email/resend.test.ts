import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmailDeliveryError, resendConfigured, sendWithResend } from './resend'

/** TASK 22-PREVIEW-AUTH — the Resend adapter never leaks its key and never fakes a send. */
const KEY = 're_test_key_never_printed'
const message = { to: 'a@example.test', subject: 'S', html: '<p>h</p>', text: 't' }

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', KEY)
  vi.stubEnv('EMAIL_FROM', '1Hub Network <no-reply@1hubnetwork.io.vn>')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('sendWithResend', () => {
  it('posts one message from EMAIL_FROM with the bearer key and returns the provider id', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: 'msg_1' }), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)
    await expect(sendWithResend(message)).resolves.toEqual({ id: 'msg_1' })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`)
    expect(JSON.parse(String(init.body))).toMatchObject({
      from: '1Hub Network <no-reply@1hubnetwork.io.vn>',
      to: ['a@example.test'],
      subject: 'S',
    })
  })

  it('throws on a provider refusal, with a reason that holds no key, recipient or body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ name: 'validation_error', message: KEY }), { status: 403 }),
      ),
    )
    const error = await sendWithResend(message).catch((e: unknown) => e)
    expect(error).toBeInstanceOf(EmailDeliveryError)
    expect((error as EmailDeliveryError).reason).toBe('provider_403_validation_error')
    expect(String((error as Error).message)).not.toContain(KEY)
    expect(String((error as Error).message)).not.toContain('a@example.test')
  })

  it('throws on network failure and when unconfigured; never reports success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new Error(KEY))),
    )
    await expect(sendWithResend(message)).rejects.toMatchObject({ reason: 'network' })
    vi.stubEnv('RESEND_API_KEY', '')
    expect(resendConfigured()).toBe(false)
    await expect(sendWithResend(message)).rejects.toMatchObject({ reason: 'not_configured' })
  })
})
