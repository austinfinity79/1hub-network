import { query, type Executor } from '@/lib/db/client'

/**
 * WF02-T00 — the owner's network read model, GET /me/network (05 §5.1).
 *
 * Built only from canonical records of the session's own profile; the caller
 * passes the session account id, never a profile id. Membership, leadership
 * and venture relations stay three separate lists (CLAUDE.md §3), and none of
 * them is a permission: capabilities come only from RoleAssignment (Matrix
 * E.2/E.3), so nothing here is read by authorization.
 *
 * - `memberships`: CommunityMembership in the MembershipDTO shape (05 §11.3),
 *   every lifecycle state, so PENDING_APPROVAL shows as pending.
 * - `leadership`: LeadershipRecord. The table stores no provenance, so none is
 *   claimed.
 * - `roles`: canonical Project/Startup relations (DEC-WF02-H5): OWNER through
 *   `projects.owner_profile_id`, MEMBER through an ACTIVE `project_members`
 *   row. `role_label` is display text only and never derives a permission
 *   (DEC-WF02-H7).
 * - `activity_summary`: always empty. P0 produces no ActivityRecord
 *   (DEC-WF02-H5), and nothing is fabricated.
 *
 * Never serialised: roster/bootstrap rows, organisation or project metadata,
 * slugs, account or contact data, approver identity (P11 open).
 */

/** Provenance codes frozen by Data SOT §7. */
export type SourceType =
  'SELF_DECLARED' | 'SYSTEM_RECORDED' | 'ORGANIZATION_VERIFIED' | 'IDENTITY_VERIFIED'

const SOURCE_TYPES: readonly SourceType[] = [
  'SELF_DECLARED',
  'SYSTEM_RECORDED',
  'ORGANIZATION_VERIFIED',
  'IDENTITY_VERIFIED',
]

/**
 * Stored `community_memberships.source` → SOT §7 code (DEC-WF02-T00-D2).
 * `PRESEED` is the dev seed's spelling of a confirmed roster match (Freeze §D2:
 * preseed = known HUB roster), which the roster importer stores as
 * ORGANIZATION_VERIFIED. Any other unknown value is reported as null, never
 * guessed.
 */
export function toSourceType(stored: string | null): SourceType | null {
  if (stored === 'PRESEED') return 'ORGANIZATION_VERIFIED'
  return (SOURCE_TYPES as readonly (string | null)[]).includes(stored)
    ? (stored as SourceType)
    : null
}

export type OrganizationRef = { id: string; name: string; type: string }

export type MembershipDTO = {
  id: string
  organization: OrganizationRef
  status: string
  source_type: SourceType | null
  valid_from: string | null
  valid_to: string | null
}

export type LeadershipDTO = {
  id: string
  organization: OrganizationRef
  title: string
  status: string
  valid_from: string
  valid_to: string | null
}

export type VentureRoleDTO = {
  venture: { id: string; type: string; name: string; status: string }
  relation: 'OWNER' | 'MEMBER'
  /** Display text for MEMBER relations; never a permission (DEC-WF02-H7). */
  role_label: string | null
}

export type NetworkDTO = {
  memberships: MembershipDTO[]
  leadership: LeadershipDTO[]
  roles: VentureRoleDTO[]
  activity_summary: []
}

// Calendar dates in the product timezone, as in the 05 §11.3 example.
const DATE = (column: string) =>
  `to_char((${column} AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD')`

type MembershipRow = {
  id: string
  org_id: string
  org_name: string
  org_type: string
  status: string
  source: string
  valid_from: string | null
  valid_to: string | null
}

type LeadershipRow = Omit<MembershipRow, 'source' | 'valid_from'> & {
  title: string
  valid_from: string
}

type VentureRow = {
  id: string
  type: string
  name: string
  status: string
  relation: 'OWNER' | 'MEMBER'
  role_label: string | null
}

const org = (row: { org_id: string; org_name: string; org_type: string }): OrganizationRef => ({
  id: row.org_id,
  name: row.org_name,
  type: row.org_type,
})

export async function getOwnNetwork(
  accountId: string,
  exec: Executor = query,
): Promise<NetworkDTO> {
  const [profile] = await exec<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  if (!profile) return { memberships: [], leadership: [], roles: [], activity_summary: [] }

  const memberships = await exec<MembershipRow>(
    `SELECT m.id::text, o.id::text AS org_id, o.name AS org_name, o.type::text AS org_type,
            m.state::text AS status, m.source,
            ${DATE('m.started_at')} AS valid_from, ${DATE('m.ended_at')} AS valid_to
       FROM community_memberships m
       JOIN organizations o ON o.id = m.organization_id
      WHERE m.profile_id = $1
      ORDER BY o.name, m.created_at, m.id`,
    [profile.id],
  )

  const leadership = await exec<LeadershipRow>(
    `SELECT l.id::text, o.id::text AS org_id, o.name AS org_name, o.type::text AS org_type,
            l.role_label AS title, l.state::text AS status,
            ${DATE('l.started_at')} AS valid_from, ${DATE('l.ended_at')} AS valid_to
       FROM leadership_records l
       JOIN organizations o ON o.id = l.organization_id
      WHERE l.profile_id = $1
      ORDER BY o.name, l.started_at, l.id`,
    [profile.id],
  )

  // Owner relations first; a member row on an owned venture is not repeated.
  const ventures = await exec<VentureRow>(
    `SELECT p.id::text, p.type::text AS type, p.name, p.status::text AS status,
            'OWNER' AS relation, NULL AS role_label
       FROM projects p
      WHERE p.owner_profile_id = $1
     UNION ALL
     SELECT p.id::text, p.type::text, p.name, p.status::text, 'MEMBER', pm.role_label
       FROM project_members pm
       JOIN projects p ON p.id = pm.project_id
      WHERE pm.profile_id = $1 AND pm.state = 'ACTIVE' AND p.owner_profile_id <> $1
      ORDER BY relation DESC, name, id`,
    [profile.id],
  )

  return {
    memberships: memberships.map((row) => ({
      id: row.id,
      organization: org(row),
      status: row.status,
      source_type: toSourceType(row.source),
      valid_from: row.valid_from,
      valid_to: row.valid_to,
    })),
    leadership: leadership.map((row) => ({
      id: row.id,
      organization: org(row),
      title: row.title,
      status: row.status,
      valid_from: row.valid_from,
      valid_to: row.valid_to,
    })),
    roles: ventures.map((row) => ({
      venture: { id: row.id, type: row.type, name: row.name, status: row.status },
      relation: row.relation,
      role_label: row.relation === 'MEMBER' ? row.role_label : null,
    })),
    activity_summary: [],
  }
}
