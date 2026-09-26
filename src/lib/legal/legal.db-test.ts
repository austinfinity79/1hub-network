import { afterAll, describe, expect, it } from 'vitest'

import { closePool, query, withTransaction } from '@/lib/db/client'
import { getVisibility, parseVisibility, putVisibility } from '@/lib/profile/visibility'

import { acceptConsent, getCurrentDocuments, getLegalState, listConsents } from './legal'

/**
 * WF01-S07 — legal acceptance and PROFILE_DISCOVERY against live PostgreSQL.
 * DEC-WF01-S07-D1 (two records), D2/D4 (discovery), D8 (stale version).
 * Versions are read from the database, never asserted as literals.
 */

afterAll(async () => {
  await closePool()
})

async function newAccount(): Promise<string> {
  const email = `lgl-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`
  const [row] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized, status) VALUES ($1, $1, 'ACTIVE') RETURNING id::text`,
    [email],
  )
  return row!.id
}

const accept = (accountId: string, consent_type: string, policy_version: unknown) =>
  withTransaction((exec) =>
    acceptConsent(exec, accountId, { consent_type, policy_version }, 'req-test'),
  )

describe('current legal documents', () => {
  it('returns one current document per required type, latest effective, not retired', async () => {
    const docs = await getCurrentDocuments()
    expect(docs.map((d) => d.type)).toEqual(['TERMS_ACCEPTANCE', 'PRIVACY_DATA_PROCESSING'])

    const version = `db-test-${Date.now()}`
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ('PRIVACY_DATA_PROCESSING', $1, 'T', $2, now())`,
      [version, `/legal/privacy/${version}`],
    )
    try {
      expect((await getCurrentDocuments())[1]!.version).toBe(version)
      await query(`UPDATE legal_documents SET retired_at = now() WHERE version = $1`, [version])
      expect((await getCurrentDocuments())[1]!.version).toBe(docs[1]!.version)
    } finally {
      await query(`UPDATE legal_documents SET retired_at = now() WHERE version = $1`, [version])
    }
  })
})

describe('consent acceptance', () => {
  it('keeps Terms and Privacy as two separate records; state satisfied only with both', async () => {
    const accountId = await newAccount()
    const [terms, privacy] = await getCurrentDocuments()
    expect((await getLegalState(accountId)).satisfied).toBe(false)

    const first = await accept(accountId, 'TERMS_ACCEPTANCE', terms!.version)
    expect(first.status).toBe(201)
    expect((await getLegalState(accountId)).accepted).toEqual({
      TERMS_ACCEPTANCE: true,
      PRIVACY_DATA_PROCESSING: false,
    })
    await accept(accountId, 'PRIVACY_DATA_PROCESSING', privacy!.version)
    expect((await getLegalState(accountId)).satisfied).toBe(true)
    expect((await listConsents(accountId)).map((c) => c.type).sort()).toEqual([
      'PRIVACY_DATA_PROCESSING',
      'TERMS_ACCEPTANCE',
    ])
  })

  it('a second acceptance of the same document returns the existing record (200)', async () => {
    const accountId = await newAccount()
    const [terms] = await getCurrentDocuments()
    const a = await accept(accountId, 'TERMS_ACCEPTANCE', terms!.version)
    const b = await accept(accountId, 'TERMS_ACCEPTANCE', terms!.version)
    expect(b.status).toBe(200)
    expect(b.body.id).toBe(a.body.id)
    const events = await query(
      `SELECT 1 FROM audit_events WHERE actor_account_id = $1 AND action = 'CONSENT_ACCEPTED'`,
      [accountId],
    )
    expect(events).toHaveLength(1)
  })

  it('refuses a stale version with 409 and an unknown type with 404, writing nothing', async () => {
    const accountId = await newAccount()
    await expect(accept(accountId, 'TERMS_ACCEPTANCE', 'stale')).rejects.toMatchObject({
      code: 'LEGAL_DOCUMENT_VERSION_STALE',
      status: 409,
    })
    await expect(accept(accountId, 'MARKETING', 'x')).rejects.toMatchObject({ status: 404 })
    expect(await listConsents(accountId)).toEqual([])
  })

  it('an acceptance of a superseded version no longer satisfies the requirement', async () => {
    const accountId = await newAccount()
    const [terms, privacy] = await getCurrentDocuments()
    await accept(accountId, 'TERMS_ACCEPTANCE', terms!.version)
    await accept(accountId, 'PRIVACY_DATA_PROCESSING', privacy!.version)
    const version = `db-test-v2-${Date.now()}`
    await query(
      `INSERT INTO legal_documents (document_type, version, title, content_uri, effective_at)
       VALUES ('TERMS_ACCEPTANCE', $1, 'T', $2, now())`,
      [version, `/legal/terms/${version}`],
    )
    try {
      const state = await getLegalState(accountId)
      expect(state.accepted.TERMS_ACCEPTANCE).toBe(false)
      expect(state.satisfied).toBe(false)
      // History is kept.
      expect(await listConsents(accountId)).toHaveLength(2)
    } finally {
      await query(`UPDATE legal_documents SET retired_at = now() WHERE version = $1`, [version])
    }
  })
})

describe('PROFILE_DISCOVERY', () => {
  it('defaults to NETWORK_ONLY without any stored row', async () => {
    expect(await getVisibility(await newAccount())).toEqual({
      groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' }],
    })
  })

  it('stores only departures from the default and audits real changes', async () => {
    const accountId = await newAccount()
    const set = (level: string) =>
      putVisibility(accountId, { groups: [{ group_code: 'PROFILE_DISCOVERY', level }] }, 'req')
    await set('PRIVATE')
    const row = async () =>
      (
        await query<{ group_overrides: unknown }>(
          `SELECT v.group_overrides FROM profile_visibility_settings v
             JOIN individual_profiles p ON p.id = v.profile_id WHERE p.account_id = $1`,
          [accountId],
        )
      )[0]!.group_overrides
    expect(await row()).toEqual({ PROFILE_DISCOVERY: 'PRIVATE' })
    await set('NETWORK_ONLY')
    expect(await row()).toEqual({})
    await set('NETWORK_ONLY')
    const events = await query(
      `SELECT 1 FROM audit_events WHERE actor_account_id = $1 AND action = 'PROFILE_VISIBILITY_CHANGED'`,
      [accountId],
    )
    expect(events).toHaveLength(2)
  })

  it.each([
    null,
    {},
    { groups: [] },
    { groups: [{ group_code: 'BASIC_PUBLIC', level: 'PUBLIC' }] },
    { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'PUBLIC' }] },
    { groups: [{ group_code: 'PROFILE_DISCOVERY', level: 'GRANTED_ACCESS' }] },
    {
      groups: [
        { group_code: 'PROFILE_DISCOVERY', level: 'PRIVATE' },
        { group_code: 'PROFILE_DISCOVERY', level: 'NETWORK_ONLY' },
      ],
    },
  ])('rejects %j', (body) => {
    expect(() => parseVisibility(body)).toThrow(
      expect.objectContaining({ code: 'VISIBILITY_VALIDATION_FAILED', status: 422 }),
    )
  })
})
