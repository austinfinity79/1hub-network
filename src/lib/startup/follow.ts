import { notFound, unauthenticated } from '@/lib/api/errors'
import { query, withTransaction, type Executor } from '@/lib/db/client'

import { startupAccess, type StartupAccess, type Viewer } from './access'

/**
 * THAO-06 Follow v1 (DEC-THAO-SP-D4): a signed-in ACTIVE account follows a
 * listed (published) startup. Startup is the only target type. The answer is
 * the caller's own state only: no follower count, no follower list, ever.
 * No notification. Follow / unfollow are idempotent (PUT / DELETE).
 */

export type FollowDTO = { following: boolean }

async function target(viewer: Viewer, slug: string, exec: Executor): Promise<StartupAccess> {
  if (!viewer.member || !viewer.accountId) throw unauthenticated()
  const access = await startupAccess(slug, viewer, exec)
  // Only a published startup can be followed; anything else is the same 404.
  if (!access || !access.listed) throw notFound()
  return access
}

export async function readFollow(
  viewer: Viewer,
  access: StartupAccess,
  exec: Executor = query,
): Promise<FollowDTO> {
  if (!viewer.member || !viewer.accountId) return { following: false }
  const [row] = await exec<{ one: number }>(
    `SELECT 1 AS one FROM venture_follows WHERE follower_account_id = $1 AND venture_id = $2`,
    [viewer.accountId, access.ventureId],
  )
  return { following: Boolean(row) }
}

/**
 * The published startups this viewer follows, by slug: their own state only,
 * for the `/products` cards (THAO-M3-QA-01). Guests and inactive accounts: none.
 */
export async function followedSlugs(viewer: Viewer): Promise<string[]> {
  if (!viewer.member || !viewer.accountId) return []
  const rows = await query<{ slug: string }>(
    `SELECT p.slug FROM venture_follows f JOIN projects p ON p.id = f.venture_id
      WHERE f.follower_account_id = $1
        AND p.type = 'STARTUP' AND p.status = 'ACTIVE' AND p.visibility = 'PUBLIC'`,
    [viewer.accountId],
  )
  return rows.map((r) => r.slug)
}

export async function followStatus(viewer: Viewer, slug: string): Promise<FollowDTO> {
  const access = await target(viewer, slug, query)
  return readFollow(viewer, access)
}

export async function follow(viewer: Viewer, slug: string): Promise<FollowDTO> {
  return withTransaction(async (exec) => {
    const access = await target(viewer, slug, exec)
    await exec(
      `INSERT INTO venture_follows (follower_account_id, venture_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [viewer.accountId, access.ventureId],
    )
    return { following: true }
  })
}

export async function unfollow(viewer: Viewer, slug: string): Promise<FollowDTO> {
  return withTransaction(async (exec) => {
    const access = await target(viewer, slug, exec)
    await exec(`DELETE FROM venture_follows WHERE follower_account_id = $1 AND venture_id = $2`, [
      viewer.accountId,
      access.ventureId,
    ])
    return { following: false }
  })
}
