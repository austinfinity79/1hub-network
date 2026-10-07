import { afterAll, describe, expect, it } from 'vitest'

import { closePool, query } from '@/lib/db/client'

import { isPublicProductLogo } from './public-logo'

/**
 * DEMO-CONTENT-V2-PATCH-A (fix) — the public logo rule against live
 * PostgreSQL: only the current logo of a STARTUP · ACTIVE · PUBLIC venture is
 * public; the same id on any other venture state, or as an avatar, is not.
 */

const created: string[] = []
const tag = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const assetId = () =>
  `asset_${tag()
    .replace(/[^0-9a-f]/g, '')
    .padEnd(32, 'a')
    .slice(0, 32)}`

afterAll(async () => {
  await query(`DELETE FROM projects WHERE slug LIKE 'logo-test-%'`)
  await query(`DELETE FROM user_accounts WHERE id = ANY($1::uuid[])`, [created])
  await closePool()
})

async function owner(): Promise<{ accountId: string; profileId: string }> {
  const email = `logo-test-${tag()}@example.test`
  const [a] = await query<{ id: string }>(
    `INSERT INTO user_accounts (email, email_normalized) VALUES ($1, $1) RETURNING id::text`,
    [email],
  )
  created.push(a!.id)
  const [p] = await query<{ id: string }>(
    `INSERT INTO individual_profiles (account_id, display_name, status) VALUES ($1, 'Logo Test', 'ACTIVE') RETURNING id::text`,
    [a!.id],
  )
  return { accountId: a!.id, profileId: p!.id }
}

async function venture(
  profileId: string,
  logo: string,
  { status = 'ACTIVE', visibility = 'PUBLIC', type = 'STARTUP' } = {},
): Promise<string> {
  const [v] = await query<{ id: string }>(
    `INSERT INTO projects (type, owner_profile_id, slug, name, status, visibility, logo_asset_id)
     VALUES ($1::project_type, $2, $3, 'Logo Test', $4::project_status, $5::visibility_level, $6) RETURNING id::text`,
    [type, profileId, `logo-test-${tag()}`, status, visibility, logo],
  )
  return v!.id
}

describe('isPublicProductLogo', () => {
  it('is true only for the current logo of a published startup', async () => {
    const o = await owner()
    const published = assetId()
    const id = await venture(o.profileId, published)
    expect(await isPublicProductLogo(published)).toBe(true)

    // The same venture leaving the public predicate takes its logo with it.
    for (const [column, value] of [
      ['status', 'ARCHIVED'],
      ['visibility', 'PRIVATE'],
    ] as const) {
      await query(`UPDATE projects SET ${column} = $2 WHERE id = $1`, [id, value])
      expect(await isPublicProductLogo(published), `${column}=${value}`).toBe(false)
      await query(`UPDATE projects SET status = 'ACTIVE', visibility = 'PUBLIC' WHERE id = $1`, [
        id,
      ])
    }
    // A replaced logo is no longer public.
    await query(`UPDATE projects SET logo_asset_id = NULL WHERE id = $1`, [id])
    expect(await isPublicProductLogo(published)).toBe(false)
  })

  it('is false for other venture states, project ventures, avatars and malformed ids', async () => {
    const o = await owner()
    const draft = assetId()
    await venture(o.profileId, draft, { status: 'DRAFT', visibility: 'PRIVATE' })
    const project = assetId()
    await venture(o.profileId, project, { type: 'PROJECT' })
    const avatar = assetId()
    await query(`UPDATE individual_profiles SET avatar_asset_id = $2 WHERE id = $1`, [
      o.profileId,
      avatar,
    ])
    for (const id of [draft, project, avatar, 'asset_xyz', "x' OR '1'='1"])
      expect(await isPublicProductLogo(id), id).toBe(false)
  })
})
