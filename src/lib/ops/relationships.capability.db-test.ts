import { afterAll, describe, expect, it, vi } from 'vitest'

import { ApiError, isApiError } from '@/lib/api/errors'
import { closePool, query } from '@/lib/db/client'

import {
  closeRelationship,
  createRelationship,
  getOrganizationRelationships,
} from './relationships'

/**
 * WF03-S08 — `org:manage` (and every other capability) does not substitute
 * `org:manage_relationship`. No seeded role holds one without the other, so the
 * authorizer is replaced by one that grants EVERY capability except
 * `org:manage_relationship`, for every organization.
 */

vi.mock('@/lib/authz/authorize', () => {
  const allowed = (capability: string) => capability !== 'org:manage_relationship'
  return {
    can: async (_actor: unknown, capability: string) => allowed(capability),
    require: async (_actor: unknown, capability: string) => {
      if (!allowed(capability))
        throw new ApiError('SCOPE_FORBIDDEN', 403, 'You do not have access to this organization.')
    },
  }
})

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CLUB_01 = '10000000-0000-0000-0000-000000000103'
const ADMIN = '30000000-0000-0000-0000-000000000003'

afterAll(async () => {
  await closePool()
})

async function status(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    if (isApiError(error)) return error.status
    throw error
  }
  return 200
}

describe('WF03-S08 capability', () => {
  it('without org:manage_relationship every read and mutation is 403, even with org:manage', async () => {
    const before = await query(
      `SELECT id, state, ended_at FROM organization_relationships ORDER BY id`,
    )
    expect(await status(getOrganizationRelationships(ADMIN, CHAPTER_01))).toBe(403)
    expect(
      await status(
        createRelationship(
          ADMIN,
          CHAPTER_01,
          { target_organization_id: CLUB_01, relationship_type: 'PARENT' },
          'cap-test',
        ),
      ),
    ).toBe(403)
    expect(
      await status(
        closeRelationship(
          ADMIN,
          CHAPTER_01,
          'd0000000-0000-0000-0000-000000000002',
          {},
          'cap-test',
        ),
      ),
    ).toBe(403)
    expect(
      await query(`SELECT id, state, ended_at FROM organization_relationships ORDER BY id`),
    ).toEqual(before)
  })
})
