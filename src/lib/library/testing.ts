import { query } from '@/lib/db/client'

/**
 * WF06-PROD-02 (P2-5) — deterministic Library fixture for the canonical read
 * path (DEC-W6P-D02 / D03 / D04). Rows are written directly in canonical
 * tables, all marked: venture and organization slugs start with `wf06-fx-`,
 * account e-mails with `wf06-fx-`, every venture name with "WF06 ". Seeding
 * removes an earlier copy first, so a rerun yields the same set. No production
 * content, no real person, no contact data. Reference ids are the seed's
 * (DOMAIN, REGION) and migration 011's (VENTURE_STAGE).
 */

export const LIBRARY_FX = {
  domain: {
    govtech: '20000000-0000-0000-0000-000000000011',
    edtech: '20000000-0000-0000-0000-000000000012',
  },
  region: {
    hanoi: '20000000-0000-0000-0000-000000000001',
    danang: '20000000-0000-0000-0000-000000000002',
    hcm: '20000000-0000-0000-0000-000000000003',
  },
  stage: {
    IDEA: '23000000-0000-0000-0000-000000000001',
    MVP: '23000000-0000-0000-0000-000000000002',
    PILOT: '23000000-0000-0000-0000-000000000003',
    SELLING: '23000000-0000-0000-0000-000000000004',
    GROWTH: '23000000-0000-0000-0000-000000000005',
  },
} as const

/** The keyword that isolates fixture rows in a shared database. */
export const LIBRARY_FX_KEYWORD = 'WF06'

type OwnerKey =
  | 'lan' // NETWORK_ONLY (no settings row: the default)
  | 'hai' // NETWORK_ONLY (explicit settings row)
  | 'hidden' // PROFILE_DISCOVERY PRIVATE
  | 'deactivated' // profile DEACTIVATED
  | 'blocked' // account BLOCKED
  | 'nameless' // no display name
  | 'privateOnly' // NETWORK_ONLY, owns a PRIVATE venture only

type OwnerSpec = {
  displayName: string | null
  profileStatus: 'ACTIVE' | 'DEACTIVATED'
  accountStatus: 'ACTIVE' | 'BLOCKED'
  discovery: 'NETWORK_ONLY' | 'PRIVATE' | null
}

export const FX_OWNERS: Record<OwnerKey, OwnerSpec> = {
  lan: {
    displayName: 'WF06 Founder Lan',
    profileStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    discovery: null,
  },
  hai: {
    displayName: 'WF06 Founder Hải',
    profileStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    discovery: 'NETWORK_ONLY',
  },
  hidden: {
    displayName: 'WF06 Founder Ẩn',
    profileStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    discovery: 'PRIVATE',
  },
  deactivated: {
    displayName: 'WF06 Founder Nghỉ',
    profileStatus: 'DEACTIVATED',
    accountStatus: 'ACTIVE',
    discovery: null,
  },
  blocked: {
    displayName: 'WF06 Founder Khóa',
    profileStatus: 'ACTIVE',
    accountStatus: 'BLOCKED',
    discovery: null,
  },
  nameless: {
    displayName: null,
    profileStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    discovery: null,
  },
  privateOnly: {
    displayName: 'WF06 Founder Riêng',
    profileStatus: 'ACTIVE',
    accountStatus: 'ACTIVE',
    discovery: null,
  },
}

/** Private profile fields set on every owner; none may ever reach a Library item. */
export const FX_PRIVATE = {
  fullName: 'WF06 Họ Tên Riêng',
  phone: '0900000606',
  headline: 'WF06 headline riêng',
  bio: 'WF06 bio riêng',
}

type Stage = keyof typeof LIBRARY_FX.stage
type VentureSpec = {
  name: string
  owner: OwnerKey
  type: 'STARTUP' | 'PROJECT'
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED'
  visibility: 'PUBLIC' | 'PRIVATE'
  stage: Stage | null
  region: keyof typeof LIBRARY_FX.region | null
  domains: Array<keyof typeof LIBRARY_FX.domain>
  role?: string
}

const pub = (
  name: string,
  owner: OwnerKey,
  stage: Stage | null,
  region: VentureSpec['region'],
  domains: VentureSpec['domains'],
  role?: string,
): VentureSpec => ({
  name,
  owner,
  type: 'STARTUP',
  status: 'ACTIVE',
  visibility: 'PUBLIC',
  stage,
  region,
  domains,
  role,
})

/** Listed: PUBLIC ACTIVE STARTUP (14 rows, more than one page of 9). */
export const FX_LISTED: VentureSpec[] = [
  pub('WF06 An Khang', 'lan', 'GROWTH', 'hanoi', ['govtech'], 'Co-Founder'),
  pub('WF06 Bình Minh', 'lan', 'SELLING', 'danang', ['edtech']),
  pub('WF06 Cầu Nối', 'lan', 'PILOT', 'hcm', ['govtech', 'edtech']),
  pub('WF06 Dòng Chảy', 'lan', 'MVP', 'hanoi', ['edtech']),
  pub('WF06 Đồng Xanh', 'lan', 'IDEA', null, ['govtech']), // missing location
  pub('WF06 Gió Mới', 'lan', null, null, []), // missing stage, location and domain
  pub('WF06 Hạt Giống', 'lan', 'IDEA', 'hanoi', ['edtech']),
  pub('WF06 Kho Lạnh', 'lan', 'GROWTH', 'hcm', ['govtech']), // same name as an external record
  pub('WF06 Lúa Vàng', 'lan', 'MVP', 'danang', ['govtech']),
  pub('WF06 Sao Mai', 'hai', 'GROWTH', 'hanoi', ['edtech'], 'CEO'),
  pub('WF06 Ngân Hà', 'hidden', 'PILOT', 'hanoi', ['edtech']), // venture visible, founder hidden
  pub('WF06 Ổ Khóa', 'deactivated', 'GROWTH', 'hcm', ['govtech']), // owner deactivated
  pub('WF06 Quả Ngọt', 'blocked', 'IDEA', 'danang', ['edtech']), // owner account blocked
  pub('WF06 Phố Cổ', 'nameless', 'MVP', 'hanoi', ['govtech']), // owner without a name
]

/** Never listed: every other status, visibility or type. */
export const FX_EXCLUDED: VentureSpec[] = [
  { ...pub('WF06 Riêng Tư', 'privateOnly', 'MVP', 'hanoi', ['edtech']), visibility: 'PRIVATE' },
  { ...pub('WF06 Kín Đáo', 'lan', 'GROWTH', 'hanoi', ['govtech']), visibility: 'PRIVATE' },
  {
    ...pub('WF06 Bản Nháp', 'lan', 'IDEA', 'hanoi', ['edtech']),
    status: 'DRAFT',
    visibility: 'PRIVATE',
  },
  { ...pub('WF06 Lưu Trữ', 'lan', 'GROWTH', 'hanoi', ['govtech']), status: 'ARCHIVED' },
  { ...pub('WF06 Dự Án', 'lan', 'PILOT', 'hanoi', ['govtech']), type: 'PROJECT' },
]

/** Organizations: one public, the others hidden (G9 reader: PUBLISHED HUB / CHAPTER / CLB only). */
export const FX_ORGS = [
  { slug: 'wf06-fx-org-published', type: 'CLB', status: 'PUBLISHED' },
  { slug: 'wf06-fx-org-draft', type: 'CLB', status: 'DRAFT' },
  { slug: 'wf06-fx-org-archived', type: 'CLB', status: 'ARCHIVED' },
  { slug: 'wf06-fx-org-company', type: 'COMPANY', status: 'PUBLISHED' },
] as const

export type LibraryFixture = {
  owners: Record<OwnerKey, string>
  ventures: Record<string, string>
}

const slugOf = (i: number) => `wf06-fx-venture-${String(i).padStart(2, '0')}`

/** Removes every fixture row (ventures first: they reference the owners). */
export async function clearLibraryFixture(): Promise<void> {
  await query(`DELETE FROM projects WHERE slug LIKE 'wf06-fx-%'`)
  await query(`DELETE FROM organizations WHERE slug LIKE 'wf06-fx-%'`)
  await query(`DELETE FROM user_accounts WHERE email LIKE 'wf06-fx-%@example.test'`)
}

export async function seedLibraryFixture(): Promise<LibraryFixture> {
  await clearLibraryFixture()
  const owners = {} as Record<OwnerKey, string>
  for (const [key, spec] of Object.entries(FX_OWNERS) as Array<[OwnerKey, OwnerSpec]>) {
    const email = `wf06-fx-${key.toLowerCase()}@example.test`
    const [account] = await query<{ id: string }>(
      `INSERT INTO user_accounts (email, email_normalized, status)
       VALUES ($1, $1, $2::account_status) RETURNING id::text`,
      [email, spec.accountStatus],
    )
    const [profile] = await query<{ id: string }>(
      `INSERT INTO individual_profiles
         (account_id, display_name, status, full_name, phone, headline, bio,
          purpose_step_completed_at, onboarding_completed_at)
       VALUES ($1, $2, $3::profile_status, $4, $5, $6, $7, now(), now()) RETURNING id::text`,
      [
        account!.id,
        spec.displayName,
        spec.profileStatus,
        FX_PRIVATE.fullName,
        FX_PRIVATE.phone,
        FX_PRIVATE.headline,
        FX_PRIVATE.bio,
      ],
    )
    if (spec.discovery) {
      await query(
        `INSERT INTO profile_visibility_settings (profile_id, default_level, group_overrides)
         VALUES ($1, 'NETWORK_ONLY', jsonb_build_object('PROFILE_DISCOVERY', $2::text))`,
        [profile!.id, spec.discovery],
      )
    }
    owners[key] = profile!.id
  }

  const ventures: Record<string, string> = {}
  for (const [i, v] of [...FX_LISTED, ...FX_EXCLUDED].entries()) {
    const [row] = await query<{ id: string }>(
      `INSERT INTO projects
         (type, owner_profile_id, slug, name, summary, status, visibility, stage_id, region_id, owner_role_label)
       VALUES ($1::project_type, $2, $3, $4, $5, $6::project_status, $7::visibility_level, $8, $9, $10)
       RETURNING id::text`,
      [
        v.type,
        owners[v.owner],
        slugOf(i),
        v.name,
        `Fixture ${v.name}: mô tả một dòng`,
        v.status,
        v.visibility,
        v.stage ? LIBRARY_FX.stage[v.stage] : null,
        v.region ? LIBRARY_FX.region[v.region] : null,
        v.role ?? null,
      ],
    )
    for (const d of v.domains) {
      await query(`INSERT INTO project_domains (project_id, vocabulary_item_id) VALUES ($1, $2)`, [
        row!.id,
        LIBRARY_FX.domain[d],
      ])
    }
    ventures[v.name] = row!.id
  }

  for (const org of FX_ORGS) {
    await query(
      `INSERT INTO organizations (type, slug, name, description, status)
       VALUES ($1::org_type, $2, $3, 'Fixture WF06', $4::publication_status)`,
      [org.type, org.slug, `WF06 ${org.slug}`, org.status],
    )
  }
  return { owners, ventures }
}
