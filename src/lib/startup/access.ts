import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { query, type Executor } from '@/lib/db/client'

/**
 * THAO-06 — who is looking at a startup, decided on the server for every read
 * and write of Startup Profile v2 (DEC-THAO-SP).
 *
 * The startup is addressed by its public slug (the route key of
 * `/products/[slug]`), never by an id from the client. It is a STARTUP-type
 * venture. `listed` is the public predicate of the directory (ACTIVE + PUBLIC,
 * DEC-W6P-D02). A viewer is `member` with a live session of an ACTIVE account;
 * `role` is their own relation to the venture: OWNER (`owner_profile_id`),
 * EDIT / VIEW (their ACTIVE `project_members` row), or null.
 *
 * Reading rules built on this:
 * - a startup that is not listed exists only for its own team (owner or member);
 *   anyone else gets the same answer as for an unknown slug;
 * - `canEdit` = OWNER or EDIT on a venture that is not ARCHIVED.
 */

export type VentureRole = 'OWNER' | 'EDIT' | 'VIEW'

export type StartupAccess = {
  ventureId: string
  slug: string
  name: string
  listed: boolean
  archived: boolean
  accountId: string | null
  member: boolean
  role: VentureRole | null
  canEdit: boolean
}

export type Viewer = { accountId: string | null; profileId: string | null; member: boolean }

export const GUEST: Viewer = { accountId: null, profileId: null, member: false }

/** The viewer of a request: a live session of an ACTIVE account, else a guest. */
export async function viewerOf(headers: Headers, exec: Executor = query): Promise<Viewer> {
  const session = await resolveSession(readSessionToken(headers))
  if (!session) return GUEST
  const [row] = await exec<{ status: string; profile_id: string | null }>(
    `SELECT ua.status::text AS status, ip.id::text AS profile_id
       FROM user_accounts ua LEFT JOIN individual_profiles ip ON ip.account_id = ua.id
      WHERE ua.id = $1`,
    [session.accountId],
  )
  if (row?.status !== 'ACTIVE') return GUEST
  return { accountId: session.accountId, profileId: row.profile_id, member: true }
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/

/**
 * The startup behind `slug` as `viewer` may see it, or null: unknown slug,
 * not a STARTUP, or neither listed nor the viewer's own team.
 */
export async function startupAccess(
  slug: string,
  viewer: Viewer,
  exec: Executor = query,
  lock = false,
): Promise<StartupAccess | null> {
  if (!SLUG.test(slug)) return null
  const [row] = await exec<{
    id: string
    slug: string
    name: string
    status: string
    visibility: string
    owner: boolean
    permission: 'EDIT' | 'VIEW' | null
  }>(
    `SELECT p.id::text, p.slug, p.name, p.status::text AS status, p.visibility::text AS visibility,
            (p.owner_profile_id = $2::uuid) AS owner, m.permission
       FROM projects p
       LEFT JOIN project_members m
              ON m.project_id = p.id AND m.profile_id = $2::uuid AND m.state = 'ACTIVE'
      WHERE p.slug = $1 AND p.type = 'STARTUP' ${lock ? 'FOR UPDATE OF p' : ''}`,
    [slug, viewer.profileId],
  )
  if (!row) return null
  const listed = row.status === 'ACTIVE' && row.visibility === 'PUBLIC'
  const role: VentureRole | null = !viewer.member
    ? null
    : row.owner
      ? 'OWNER'
      : row.permission === 'EDIT'
        ? 'EDIT'
        : row.permission === 'VIEW'
          ? 'VIEW'
          : null
  if (!listed && !role) return null
  const archived = row.status === 'ARCHIVED'
  return {
    ventureId: row.id,
    slug: row.slug,
    name: row.name,
    listed,
    archived,
    accountId: viewer.accountId,
    member: viewer.member,
    role,
    canEdit: (role === 'OWNER' || role === 'EDIT') && !archived,
  }
}
