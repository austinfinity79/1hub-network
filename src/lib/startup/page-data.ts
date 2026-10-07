import { headers } from 'next/headers'

import { findPublicStartup, type StartupPage } from '@/lib/public/directory-data'
import { publicShellData, type PublicShellData } from '@/lib/public/shell-data'

import { startupAccess, viewerOf, type StartupAccess, type Viewer } from './access'
import { readFollow } from './follow'

/**
 * THAO-06 — what every tab of `/products/[slug]` needs, read once on the
 * server: the shell, the published startup as this viewer may see it (team per
 * DEC-THAO-SP-D1), the viewer's relation to it, and their own follow state.
 * Null for anything that is not a published startup (the route's 404).
 */
export type StartupPageData = {
  shell: PublicShellData
  startup: StartupPage
  viewer: Viewer
  access: StartupAccess
  following: boolean
}

export async function startupPageData(slug: string): Promise<StartupPageData | null> {
  const viewer = await viewerOf(await headers())
  const [shell, startup, access] = await Promise.all([
    publicShellData(),
    findPublicStartup(slug, viewer.member ? 'NETWORK' : 'GUEST'),
    startupAccess(slug, viewer),
  ])
  if (!startup || !access?.listed) return null
  const { following } = await readFollow(viewer, access)
  return { shell, startup, viewer, access, following }
}
