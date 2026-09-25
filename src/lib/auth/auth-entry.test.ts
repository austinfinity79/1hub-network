import { describe, expect, it } from 'vitest'

import { isPlausibleEmail, normalizeEmail } from './email'
import {
  clearPendingRequest,
  isMagicLinkRequestAccepted,
  PENDING_REQUEST_STORAGE_KEY,
  readPendingRequest,
  savePendingRequest,
} from './pending-request'
import * as tokens from './tokens'

/** WF01-S01 — browser-safe helpers behind the auth entry form. */

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

const ACCEPTED = {
  request_id: 'authreq_123',
  email_masked: 'm***@example.test',
  resend_after_seconds: 60,
  expires_in_seconds: 900,
}

describe('shared email rule', () => {
  it('is the exact rule the server enforces, re-exported unchanged', () => {
    expect(tokens.isPlausibleEmail).toBe(isPlausibleEmail)
    expect(tokens.normalizeEmail).toBe(normalizeEmail)
  })

  it.each([
    ['member@example.test', true],
    ['  Member@Example.Test ', true],
    ['', false],
    ['no-at-sign', false],
    ['a@b', false],
    ['two@@example.test', false],
    ['space in@example.test', false],
  ])('judges %j plausible = %s', (value, ok) => {
    expect(isPlausibleEmail(value)).toBe(ok)
  })
})

describe('pending magic-link request handoff', () => {
  it('stores only the four contract fields', () => {
    const storage = memoryStorage()
    savePendingRequest(storage, { ...ACCEPTED, token: 'must-not-leak' } as typeof ACCEPTED)

    const raw = storage.map.get(PENDING_REQUEST_STORAGE_KEY)!
    expect(JSON.parse(raw)).toEqual(ACCEPTED)
    expect(raw).not.toContain('must-not-leak')
  })

  it('round-trips and clears', () => {
    const storage = memoryStorage()
    savePendingRequest(storage, ACCEPTED)
    expect(readPendingRequest(storage)).toEqual(ACCEPTED)
    clearPendingRequest(storage)
    expect(readPendingRequest(storage)).toBeNull()
  })

  it('rejects malformed stored state instead of trusting it', () => {
    const storage = memoryStorage()
    storage.setItem(PENDING_REQUEST_STORAGE_KEY, '{not json')
    expect(readPendingRequest(storage)).toBeNull()
    storage.setItem(PENDING_REQUEST_STORAGE_KEY, JSON.stringify({ request_id: 1 }))
    expect(readPendingRequest(storage)).toBeNull()
    expect(isMagicLinkRequestAccepted(ACCEPTED)).toBe(true)
  })
})
