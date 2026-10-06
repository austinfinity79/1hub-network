import { ApiError } from '@/lib/api/errors'
import { query, withTransaction, type Executor } from '@/lib/db/client'
import { REQUESTABLE_TYPES } from '@/lib/network/membership-request'
import type { OrganizationRef } from '@/lib/network/network'

import {
  duplicateRows,
  HUB_LEVELS,
  HUB_POSITIONS,
  MONTH,
  monthNow,
  periodError,
  periodText,
  POSITION_LIMITS,
  positionTitle,
  sortDeclarations,
  type HubLevel,
  type HubPosition,
  type PositionDeclaration,
} from './hub-position'

/**
 * WF01 stage 3 (ACC-08) — what the member declares about themselves
 * (BA workbook row 58; DEC-L1R-D5; S1-UAT-03, DEC-S1O).
 *
 * Two things are stored, and neither is a permission:
 *
 * - `roles`: the six self-declared ecosystem roles of ACC-08, multi-select
 *   (US-01.10: at least one to pass the stage). A profile attribute used for
 *   personalisation. It is not a RoleAssignment, a membership or a leadership
 *   record, and authorization never reads it.
 * - `hub_claims`: the HUB positions the member declares (US-01.11; rules in
 *   hub-position.ts): level, unit, position (+ Tên Ban / Ghi rõ), and the
 *   months of the term. While onboarding is open this is unsent form data on
 *   the profile (`onboarding_hub_claims`), every row "Chờ xác minh". Completing
 *   onboarding still files one ordinary membership request per unit
 *   (PENDING_APPROVAL, SELF_DECLARED; see `fileClaimedMemberships`); one
 *   verification request per position is S1-UAT-03B's.
 *
 * A row's status is never the client's: `status`, `verified` and
 * `verification_status` in a row are ignored (US-01.11 "bị bỏ qua, vẫn là Chờ
 * xác minh"); any other unknown field is refused.
 *
 * The session's account is the only profile this module reads or writes.
 */

export const DECLARED_ROLES = [
  'HUB_MEMBER',
  'INNOVATOR',
  'STARTUP_FOUNDER',
  'ORGANIZATION_REPRESENTATIVE',
  'INVESTOR_REPRESENTATIVE',
  'INNOVATION_ENTHUSIAST',
] as const

export type DeclaredRole = (typeof DECLARED_ROLES)[number]

/** US-01.11: at most ten rows (POSITION_LIMITS). */
export const CLAIM_LIMITS = { claims: POSITION_LIMITS.rows, text: POSITION_LIMITS.text } as const

export type HubClaimDTO = {
  level: HubLevel
  organization: OrganizationRef
  /** The CLB's Chapter (its canonical PARENT); null for the other levels. */
  chapter: OrganizationRef | null
  /** Null only for a draft saved before S1-UAT-03 (its text is in `title`). */
  position: HubPosition | null
  board_name: string | null
  position_other: string | null
  from: string | null
  to: string | null
  current: boolean
  /** Always "PENDING" here: declared, not yet decided by its unit. */
  status: 'PENDING'
  /** The position as the screens print it ("Trưởng Ban Truyền thông"). */
  title: string
  /** "01/2024 – Hiện tại". */
  period: string
}

export type DeclaredRolesDTO = { roles: DeclaredRole[]; hub_claims: HubClaimDTO[] }

/** A stored row: the S1-UAT-03 shape, or a draft saved before it ({organization_id, position, period}). */
export type StoredClaim =
  | PositionDeclaration
  | { organization_id: string; position: string | null; period: string | null; level?: undefined }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ROW_KEYS = [
  'level',
  'organization_id',
  'position',
  'board_name',
  'position_other',
  'from',
  'to',
  'current',
]
/** Status a client may send but never sets (US-01.11 AC "bị bỏ qua"). */
const IGNORED_ROW_KEYS = ['status', 'verified', 'verification_status']

const invalid = (field: string, reason: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, 'Role declaration is not valid.', {
    [field]: reason,
  })

const isDeclaredRole = (value: unknown): value is DeclaredRole =>
  typeof value === 'string' && (DECLARED_ROLES as readonly string[]).includes(value)

function rowText(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw invalid('hub_claims', 'invalid')
  const text = value.normalize('NFC').trim().replace(/\s+/g, ' ')
  if (text.length > CLAIM_LIMITS.text) throw invalid('hub_claims', 'too_long')
  return text || null
}

function parseRow(item: unknown, now: string): PositionDeclaration {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    throw invalid('hub_claims', 'invalid')
  }
  const entry = item as Record<string, unknown>
  for (const key of Object.keys(entry)) {
    if (!ROW_KEYS.includes(key) && !IGNORED_ROW_KEYS.includes(key)) {
      throw invalid('hub_claims', 'invalid')
    }
  }
  if (!(HUB_LEVELS as readonly unknown[]).includes(entry.level)) {
    throw invalid('hub_claims', 'level_required')
  }
  if (typeof entry.organization_id !== 'string' || !UUID.test(entry.organization_id)) {
    throw invalid('hub_claims', 'organization_required')
  }
  if (!(HUB_POSITIONS as readonly unknown[]).includes(entry.position)) {
    throw invalid('hub_claims', 'position_required')
  }
  const position = entry.position as HubPosition
  const board = rowText(entry.board_name)
  const other = rowText(entry.position_other)
  if (position === 'HEAD_OF_BOARD' && !board) throw invalid('hub_claims', 'board_name_required')
  if (position === 'OTHER' && !other) throw invalid('hub_claims', 'position_other_required')
  if (entry.current !== undefined && typeof entry.current !== 'boolean') {
    throw invalid('hub_claims', 'invalid')
  }
  const current = entry.current === true
  for (const key of ['from', 'to'] as const) {
    const value = entry[key]
    if (
      value !== undefined &&
      value !== null &&
      (typeof value !== 'string' || !MONTH.test(value))
    ) {
      throw invalid('hub_claims', 'invalid_month')
    }
  }
  const row: PositionDeclaration = {
    level: entry.level as HubLevel,
    organization_id: entry.organization_id.toLowerCase(),
    position,
    board_name: position === 'HEAD_OF_BOARD' ? board : null,
    position_other: position === 'OTHER' ? other : null,
    from: (entry.from as string | null | undefined) ?? '',
    // "Tôi đang trong nhiệm kỳ hoạt động": Đến is "Hiện tại", never a month.
    to: current ? null : ((entry.to as string | null | undefined) ?? null),
    current,
  }
  const period = periodError(row, now)
  if (period) throw invalid('hub_claims', period)
  return row
}

/** Shape validation; no database access, so nothing can be half-written. */
export function parseDeclaration(
  body: unknown,
  now: string = monthNow(),
): { roles: DeclaredRole[]; claims: PositionDeclaration[] } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw invalid('body', 'invalid')
  }
  const input = body as Record<string, unknown>
  for (const key of Object.keys(input)) {
    if (key !== 'roles' && key !== 'hub_claims') throw invalid(key, 'not_supported')
  }
  if (!Array.isArray(input.roles) || !input.roles.every(isDeclaredRole)) {
    throw invalid('roles', 'unsupported')
  }
  const roles = [...new Set(input.roles)]

  const list = input.hub_claims ?? []
  if (!Array.isArray(list)) throw invalid('hub_claims', 'invalid')
  if (list.length > CLAIM_LIMITS.claims) throw invalid('hub_claims', 'too_many')
  const claims = list.map((item) => parseRow(item, now))
  // "Trùng Đơn vị + Chức vụ + thời gian chồng lấn → chặn, báo 'Vị trí này đã khai'".
  if (duplicateRows(claims, now).length > 0) throw invalid('hub_claims', 'duplicate_position')
  if (claims.length > 0 && !roles.includes('HUB_MEMBER')) {
    throw invalid('hub_claims', 'requires_hub_member')
  }
  return { roles, claims: sortDeclarations(claims) }
}

type UnitRow = {
  id: string
  name: string
  type: string
  chapter_id: string | null
  chapter_name: string | null
}

/**
 * The units of `ids` that may be declared, with a CLB's Chapter: requestable
 * (HUB, CHAPTER, CLB, PUBLISHED) and, for a CLB, under an active PARENT
 * Chapter (DEC-WF03-C2 relationship, never the display name).
 */
async function units(exec: Executor, ids: string[]): Promise<Map<string, UnitRow>> {
  if (ids.length === 0) return new Map()
  const rows = await exec<UnitRow>(
    `SELECT o.id::text, o.name, o.type::text AS type, c.id::text AS chapter_id, c.name AS chapter_name
       FROM organizations o
       LEFT JOIN organization_relationships r
              ON r.target_org_id = o.id AND r.relationship_type = 'PARENT' AND r.state = 'ACTIVE'
       LEFT JOIN organizations c ON c.id = r.source_org_id AND c.type = 'CHAPTER'
      WHERE o.id = ANY($1::uuid[]) AND o.type::text = ANY($2::text[]) AND o.status = 'PUBLISHED'`,
    [ids, REQUESTABLE_TYPES],
  )
  return new Map(rows.map((r) => [r.id, r]))
}

async function read(exec: Executor, profileId: string): Promise<DeclaredRolesDTO> {
  const roles = await exec<{ role_code: DeclaredRole }>(
    `SELECT role_code FROM profile_declared_roles WHERE profile_id = $1`,
    [profileId],
  )
  const [profile] = await exec<{ claims: StoredClaim[] | null }>(
    `SELECT onboarding_hub_claims AS claims FROM individual_profiles WHERE id = $1`,
    [profileId],
  )
  const stored = profile?.claims ?? []
  const found = await units(
    exec,
    stored.map((c) => c.organization_id).filter((id) => UUID.test(id)),
  )
  // Units that stopped being requestable since the draft was saved are left out.
  const claims: HubClaimDTO[] = []
  for (const c of stored) {
    const unit = found.get(c.organization_id?.toLowerCase())
    if (!unit) continue
    const organization = { id: unit.id, name: unit.name, type: unit.type }
    const chapter =
      unit.type === 'CLB' && unit.chapter_id
        ? { id: unit.chapter_id, name: unit.chapter_name!, type: 'CHAPTER' }
        : null
    if (c.level === undefined) {
      // A draft from before S1-UAT-03: kept as text, to be completed on stage 3.
      claims.push({
        level: unit.type as HubLevel,
        organization,
        chapter,
        position: null,
        board_name: null,
        position_other: null,
        from: null,
        to: null,
        current: false,
        status: 'PENDING',
        title: c.position ?? '',
        period: c.period ?? '',
      })
      continue
    }
    claims.push({
      level: c.level,
      organization,
      chapter,
      position: c.position,
      board_name: c.board_name,
      position_other: c.position_other,
      from: c.from,
      to: c.to,
      current: c.current,
      status: 'PENDING',
      title: positionTitle(c),
      period: periodText(c),
    })
  }
  const declared = new Set(roles.map((r) => r.role_code))
  return {
    // The order of ACC-08, not the order of selection.
    roles: DECLARED_ROLES.filter((role) => declared.has(role)),
    hub_claims: sortDeclarations(claims),
  }
}

/**
 * The stored rows as the membership request carries them at completion: the
 * printed position and period (a pre-S1-UAT-03 draft keeps its own text).
 */
export function claimFilings(
  stored: StoredClaim[] | null,
): { organization_id: string; position: string | null; period: string | null }[] {
  return sortDeclarations(
    (stored ?? []).map((c) =>
      c.level === undefined
        ? { ...c, level: 'CHAPTER' as HubLevel, current: false, from: null }
        : c,
    ),
  ).map((c) =>
    'board_name' in c
      ? {
          organization_id: c.organization_id,
          position: positionTitle(c) || null,
          period: periodText(c) || null,
        }
      : { organization_id: c.organization_id, position: c.position, period: c.period },
  )
}

/**
 * US-01.10 / US-01.11 gate of stage 3 ("Tiếp tục"): at least one role; with
 * "Thành viên HUB Network", at least one position and every row complete in
 * the S1-UAT-03 shape. Returns the fields that are missing.
 */
export async function roleStageMissing(
  exec: Executor,
  accountId: string,
): Promise<Record<string, string>> {
  const [profile] = await exec<{ id: string; claims: StoredClaim[] | null }>(
    `SELECT id::text, onboarding_hub_claims AS claims FROM individual_profiles WHERE account_id = $1`,
    [accountId],
  )
  if (!profile) return { roles: 'missing' }
  const { roles, hub_claims } = await read(exec, profile.id)
  const missing: Record<string, string> = {}
  if (roles.length === 0) missing.roles = 'missing'
  if (roles.includes('HUB_MEMBER')) {
    const stored = profile.claims ?? []
    if (hub_claims.length === 0) missing.hub_claims = 'missing'
    else if (stored.some((c) => c.level === undefined) || hub_claims.length !== stored.length) {
      missing.hub_claims = 'incomplete'
    }
  }
  return missing
}

/**
 * The declarable units, as stage 3 offers them: the canonical catalogue
 * (db/seed/catalog_sprint1.sql, Appendix E) in its order — HUB Network Tổng,
 * the 13 Chapters, and the CLBs under the Chapters that have them.
 */
export type HubCatalog = {
  hub: OrganizationRef | null
  chapters: OrganizationRef[]
  clubs: Record<string, OrganizationRef[]>
}

export async function listHubCatalog(exec: Executor = query): Promise<HubCatalog> {
  const rows = await exec<{ id: string; name: string; type: string; parent_id: string | null }>(
    `SELECT o.id::text, o.name, o.type::text AS type, r.source_org_id::text AS parent_id
       FROM organizations o
       LEFT JOIN organization_relationships r
              ON r.target_org_id = o.id AND r.relationship_type = 'PARENT' AND r.state = 'ACTIVE'
      WHERE o.status = 'PUBLISHED' AND o.type::text = ANY($1::text[])
        AND o.metadata ? 'catalog_order'
      ORDER BY (o.metadata->>'catalog_order')::int, o.name, o.id`,
    [REQUESTABLE_TYPES],
  )
  const ref = (r: { id: string; name: string; type: string }) => ({
    id: r.id,
    name: r.name,
    type: r.type,
  })
  const chapters = rows.filter((r) => r.type === 'CHAPTER')
  const clubs: Record<string, OrganizationRef[]> = {}
  for (const club of rows.filter((r) => r.type === 'CLB' && r.parent_id)) {
    if (!chapters.some((c) => c.id === club.parent_id)) continue
    ;(clubs[club.parent_id!] ??= []).push(ref(club))
  }
  const hub = rows.find((r) => r.type === 'HUB')
  return { hub: hub ? ref(hub) : null, chapters: chapters.map(ref), clubs }
}

/**
 * The membership requests that completing onboarding filed and that still wait
 * for their unit (ACC-10 "Theo dõi xác minh chức vụ HUB"). Own records only.
 */
export type PendingClaimDTO = {
  organization: OrganizationRef
  position: string | null
  period: string | null
}

export async function listPendingClaims(accountId: string): Promise<PendingClaimDTO[]> {
  const rows = await query<{
    id: string
    name: string
    type: string
    position: string | null
    period: string | null
  }>(
    `SELECT o.id::text, o.name, o.type::text AS type, m.claimed_position AS position,
            m.claimed_period AS period
       FROM community_memberships m
       JOIN individual_profiles p ON p.id = m.profile_id
       JOIN organizations o ON o.id = m.organization_id
      WHERE p.account_id = $1 AND m.state = 'PENDING_APPROVAL' AND m.source = 'SELF_DECLARED'
      ORDER BY m.created_at, m.id`,
    [accountId],
  )
  return rows.map((r) => ({
    organization: { id: r.id, name: r.name, type: r.type },
    position: r.position,
    period: r.period,
  }))
}

/** GET /me/onboarding/roles. An account without a profile has declared nothing. */
export async function getDeclaredRoles(
  accountId: string,
  exec: Executor = query,
): Promise<DeclaredRolesDTO> {
  const [profile] = await exec<{ id: string }>(
    'SELECT id::text FROM individual_profiles WHERE account_id = $1',
    [accountId],
  )
  return profile ? read(exec, profile.id) : { roles: [], hub_claims: [] }
}

/**
 * PUT /me/onboarding/roles — replaces the declaration as a whole.
 *
 * Works only while onboarding is open: afterwards the claims have become
 * membership requests, which this endpoint must not rewrite. Every named unit
 * must be requestable (HUB, CHAPTER or CLB, PUBLISHED); an id that is unknown,
 * unpublished or of another type is refused alike, so nothing is disclosed.
 * Creates no membership, leadership, RoleAssignment or capability.
 */
export async function saveDeclaredRoles(
  accountId: string,
  body: unknown,
): Promise<DeclaredRolesDTO> {
  const { roles, claims } = parseDeclaration(body)

  return withTransaction(async (exec) => {
    // The first write creates the DRAFT profile; UNIQUE account_id keeps it one per account.
    const [profile] = await exec<{ id: string; status: string; done: boolean }>(
      `INSERT INTO individual_profiles (account_id) VALUES ($1)
       ON CONFLICT (account_id) DO UPDATE SET updated_at = now()
       RETURNING id::text, status::text AS status,
                 (status = 'ACTIVE' AND onboarding_completed_at IS NOT NULL) AS done`,
      [accountId],
    )
    if (profile!.status === 'DEACTIVATED') {
      throw new ApiError('PROFILE_DEACTIVATED', 409, 'Profile is deactivated.')
    }
    if (profile!.done) throw invalid('onboarding', 'completed')

    // Every unit requestable and of the row's level; a CLB under its Chapter.
    const found = await units(exec, [...new Set(claims.map((c) => c.organization_id))])
    for (const claim of claims) {
      const unit = found.get(claim.organization_id)
      if (!unit) throw invalid('hub_claims', 'organization_not_available')
      if (unit.type !== claim.level) throw invalid('hub_claims', 'organization_not_available')
      if (claim.level === 'CLB' && !unit.chapter_id) {
        throw invalid('hub_claims', 'organization_not_available')
      }
    }

    await exec(
      `DELETE FROM profile_declared_roles
        WHERE profile_id = $1 AND NOT (role_code = ANY($2::text[]))`,
      [profile!.id, roles],
    )
    await exec(
      `INSERT INTO profile_declared_roles (profile_id, role_code)
       SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
      [profile!.id, roles],
    )
    await exec(
      `UPDATE individual_profiles SET onboarding_hub_claims = $2::jsonb, updated_at = now()
        WHERE id = $1`,
      [profile!.id, JSON.stringify(claims)],
    )
    return read(exec, profile!.id)
  })
}
