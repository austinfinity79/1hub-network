import { query, type Executor } from '@/lib/db/client'

import { isAssetId } from './avatar-storage'

/**
 * DEMO-CONTENT-V2-PATCH-A (fix) — the one public media rule: an asset is
 * public while it is the current logo (`projects.logo_asset_id`, the logo
 * "đang công khai" of the venture review) of a published startup, the same
 * predicate as the public directory (STARTUP · ACTIVE · PUBLIC). Anything else
 * — avatars, proposed logos, screenshots, logos of private, draft or archived
 * ventures — keeps the session rules of /media/assets.
 */
export async function isPublicProductLogo(id: string, exec: Executor = query): Promise<boolean> {
  if (!isAssetId(id)) return false
  const rows = await exec<{ one: number }>(
    `SELECT 1 AS one FROM projects
      WHERE logo_asset_id = $1 AND type = 'STARTUP' AND status = 'ACTIVE' AND visibility = 'PUBLIC'
      LIMIT 1`,
    [id],
  )
  return rows.length > 0
}
