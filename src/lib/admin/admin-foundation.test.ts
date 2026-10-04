import { describe, expect, it } from 'vitest'

import type { ActiveAssignment } from '@/lib/authz/actor'
import {
  assignmentGrants,
  CAPABILITIES,
  CAPABILITY_MATRIX,
  isDelegable,
  ruleFor,
} from '@/lib/authz/matrix'

import {
  ACCOUNT_ACTION_EFFECT,
  canTransitionAccountRequest,
  HARD_DELETE_IN_PORTAL,
} from './account-actions'
import { assertAuditSafe } from './admin-audit'
import { CATEGORY_TYPE_CREATION_ALLOWED, categoryChangeAllowed } from './categories'
import {
  canTransitionFeedback,
  FEEDBACK_SCREENSHOT_RETENTION_DAYS,
  isScreenshotExpired,
  parseGuestEmail,
  projectFeedbackContext,
  screenshotExpiresAt,
  SENDER_FEEDBACK_TYPES,
  summaryBucket,
} from './feedback'
import { isSameScope } from './hierarchy'
import { parseLegacyPeriod } from './legacy-declarations'
import { decisionNotification, NOTIFICATION_RESOURCE } from './notifications'
import {
  changedCoreFields,
  coreSnapshot,
  isLogoReference,
  parseCoreSnapshot,
  parseWebsite,
  reviewRequired,
  VENTURE_CORE_FIELDS,
  ventureReviewState,
  type VentureCore,
} from './venture-review'
import {
  approvalEffect,
  canTransitionVerification,
  currentMonth,
  parseDeclaredPosition,
  parseMonth,
} from './verification'

/** ADMIN-PROD-02 — the pure parts of the Admin foundation. */

const ORG = 'ad020000-0000-4000-8000-000000000021'
const NOW = new Date('2026-10-04T05:00:00Z')

const assignment = (over: Partial<ActiveAssignment>): ActiveAssignment => ({
  roleCode: 'HUB_COMMUNITY_LEADER',
  scopeType: 'ORGANIZATION',
  scopeId: ORG,
  capability: null,
  ...over,
})

describe('capability matrix (DEC-ADM)', () => {
  it('adds the eight admin capabilities under the one naming convention', () => {
    expect(CAPABILITIES).toHaveLength(18)
    expect(CAPABILITY_MATRIX.map((r) => r.capability)).toEqual([...CAPABILITIES])
    for (const c of CAPABILITIES) expect(c.split(':')).toHaveLength(2)
  })

  it('keeps the five platform capabilities platform-only', () => {
    for (const c of [
      'venture:review',
      'org:lifecycle',
      'feedback:manage',
      'vocabulary:manage',
      'account:administer',
    ] as const) {
      expect(ruleFor(c)!.organizationRoles).toEqual([])
      expect(ruleFor(c)!.platformRoles).toEqual(['PLATFORM_ADMIN'])
      expect(isDelegable(c)).toBe(false)
    }
  })

  it('marks exactly the contract list delegable', () => {
    expect(CAPABILITIES.filter(isDelegable).sort()).toEqual(
      [
        'org:read',
        'member:read',
        'membership:confirm',
        'event:manage',
        'programme:read',
        'programme:manage',
        'org:manage',
        'verification:review',
        'account:escalate',
      ].sort(),
    )
    for (const c of ['org:manage_relationship', 'leadership:manage', 'access:delegate'] as const)
      expect(isDelegable(c)).toBe(false)
  })

  it('lets a capability-only grant carry that capability and nothing else of its role', () => {
    const grant = assignment({ capability: 'verification:review' })
    for (const rule of CAPABILITY_MATRIX) {
      expect(assignmentGrants(grant, rule), rule.capability).toBe(
        rule.capability === 'verification:review',
      )
    }
    expect(assignmentGrants(assignment({}), ruleFor('access:delegate')!)).toBe(true)
    expect(assignmentGrants(assignment({}), ruleFor('venture:review')!)).toBe(false)
  })
})

describe('role verification states and periods (PD-1)', () => {
  it('allows exactly the frozen moves, each by its party', () => {
    expect(canTransitionVerification('PENDING', 'APPROVED', 'HANDLER')).toBe(true)
    expect(canTransitionVerification('PENDING', 'REJECTED', 'HANDLER')).toBe(true)
    expect(canTransitionVerification('PENDING', 'WITHDRAWN', 'REQUESTER')).toBe(true)
    expect(canTransitionVerification('REJECTED', 'PENDING', 'REQUESTER')).toBe(true)
    expect(canTransitionVerification('PENDING', 'APPROVED', 'REQUESTER')).toBe(false)
    expect(canTransitionVerification('PENDING', 'WITHDRAWN', 'HANDLER')).toBe(false)
    expect(canTransitionVerification('APPROVED', 'PENDING', 'REQUESTER')).toBe(false)
    expect(canTransitionVerification('WITHDRAWN', 'PENDING', 'REQUESTER')).toBe(false)
    expect(canTransitionVerification('REJECTED', 'APPROVED', 'HANDLER')).toBe(false)
  })

  it('reads months as MM/YYYY precision, past or current only', () => {
    expect(parseMonth('2024-03')).toBe('2024-03-01')
    expect(parseMonth('2024-13')).toBeNull()
    expect(parseMonth('2024-3')).toBeNull()
    expect(currentMonth(NOW)).toBe('2026-10-01')
    // 31/10 23:30 in Vietnam is still October there.
    expect(currentMonth(new Date('2026-10-31T16:30:00Z'))).toBe('2026-10-01')
    expect(currentMonth(new Date('2026-10-31T17:30:00Z'))).toBe('2026-11-01')
  })

  it('parses one declared position and refuses bad periods', () => {
    const ok = parseDeclaredPosition(
      { organization_id: ORG, position_title: ' Trưởng Ban Truyền thông ', period_from: '2024-01' },
      NOW,
    )
    expect(ok).toEqual({
      organization_id: ORG,
      position_title: 'Trưởng Ban Truyền thông',
      period_from: '2024-01-01',
      period_to: null,
    })
    const fail = (body: Record<string, unknown>) => {
      try {
        parseDeclaredPosition({ organization_id: ORG, position_title: 'Chủ tịch', ...body }, NOW)
      } catch (error) {
        return (error as { fields?: Record<string, string> }).fields
      }
      throw new Error('accepted')
    }
    expect(fail({ period_from: '2026-11' })).toEqual({ period_from: 'future' })
    expect(fail({ period_from: '2024-05', period_to: '2024-04' })).toEqual({
      period_to: 'before_start',
    })
    expect(fail({ period_from: '2024-05', period_to: '2027-01' })).toEqual({ period_to: 'future' })
    expect(fail({ period_from: '2024-05', period_to: 'now' })).toEqual({ period_to: 'invalid' })
    expect(fail({ period_from: '2024-05', position_title: '   ' })).toEqual({
      position_title: 'required',
    })
    expect(fail({ period_from: '2024-05', position_title: 'x'.repeat(201) })).toEqual({
      position_title: 'too_long',
    })
    expect(fail({ period_from: '2024-05', role: 'PLATFORM_ADMIN' })).toEqual({
      role: 'not_accepted',
    })
    expect(fail({ period_from: '2024-05', organization_id: 'HUB' })).toEqual({
      organization_id: 'invalid',
    })
  })

  it('maps a current term to ACTIVE + membership and an ended one to ALUMNI only', () => {
    expect(approvalEffect({ periodTo: null })).toEqual({
      leadershipState: 'ACTIVE',
      createsMembership: true,
    })
    expect(approvalEffect({ periodTo: '2023-06-01' })).toEqual({
      leadershipState: 'ALUMNI',
      createsMembership: false,
    })
  })
})

describe('venture review: core fields and REVIEW_REQUIRED (PD-2, PD-3)', () => {
  const core: VentureCore = {
    name: 'Alpha',
    summary: 'One line',
    domain_ids: ['B', 'a'],
    stage_id: null,
    region_id: null,
    website: 'https://alpha.example',
    logo_asset_id: null,
    owner_role_label: 'Founder',
  }
  const PUBLIC = { status: 'ACTIVE', visibility: 'PUBLIC' }
  const DRAFT = { status: 'DRAFT', visibility: 'PRIVATE' }

  it('freezes the contract core set, team excluded', () => {
    expect(VENTURE_CORE_FIELDS).toEqual([
      'name',
      'summary',
      'domain_ids',
      'stage_id',
      'region_id',
      'website',
      'logo_asset_id',
      'owner_role_label',
    ])
  })

  it('needs a review exactly when a PUBLIC venture changes a core field', () => {
    for (const field of VENTURE_CORE_FIELDS) {
      const changed = {
        ...core,
        [field]: field === 'domain_ids' ? ['c'] : field === 'name' ? 'Beta' : 'x',
      }
      expect(reviewRequired(PUBLIC, core, changed as VentureCore)).toEqual({
        required: true,
        fields: [field],
      })
      expect(reviewRequired(DRAFT, core, changed as VentureCore).required).toBe(false)
    }
  })

  it('ignores presentation-only differences (whitespace, case of ids, domain order)', () => {
    const same = { ...core, name: ' Alpha ', domain_ids: ['A', 'b'], summary: 'One line ' }
    expect(changedCoreFields(core, same)).toEqual([])
    expect(reviewRequired(PUBLIC, core, same)).toEqual({ required: false, fields: [] })
  })

  it('derives the user-facing state and keeps a pending change PUBLIC', () => {
    expect(ventureReviewState(DRAFT, null)).toEqual({ state: 'DRAFT', pendingChange: false })
    expect(ventureReviewState(DRAFT, { kind: 'FIRST_PUBLISH', status: 'PENDING' }).state).toBe(
      'PENDING_REVIEW',
    )
    expect(ventureReviewState(DRAFT, { kind: 'FIRST_PUBLISH', status: 'REJECTED' }).state).toBe(
      'REJECTED',
    )
    expect(ventureReviewState(PUBLIC, { kind: 'CORE_CHANGE', status: 'PENDING' })).toEqual({
      state: 'PUBLIC',
      pendingChange: true,
    })
    expect(ventureReviewState({ status: 'ARCHIVED', visibility: 'PRIVATE' }, null).state).toBe(
      'ARCHIVED',
    )
  })

  it('round-trips the proposed snapshot and refuses foreign shapes', () => {
    const snap = coreSnapshot(core)
    expect(snap.schema_version).toBe(1)
    expect(parseCoreSnapshot(JSON.parse(JSON.stringify(snap)))).toEqual(parseCoreSnapshot(snap))
    expect(parseCoreSnapshot({ ...snap, schema_version: 2 })).toBeNull()
    expect(parseCoreSnapshot({ ...snap, domain_ids: 'a' })).toBeNull()
    expect(parseCoreSnapshot([])).toBeNull()
  })

  it('accepts http / https websites and media-store logos only', () => {
    expect(parseWebsite('https://startup.example/about')).toEqual({
      ok: true,
      value: 'https://startup.example/about',
    })
    expect(parseWebsite(null)).toEqual({ ok: true, value: null })
    expect(parseWebsite('javascript:alert(1)')).toEqual({ ok: false })
    expect(parseWebsite('ftp://startup.example')).toEqual({ ok: false })
    expect(isLogoReference(`asset_${'a'.repeat(32)}`)).toBe(true)
    expect(isLogoReference('https://cdn.example/logo.png')).toBe(false)
  })
})

describe('feedback, accounts, categories, notifications, audit', () => {
  it('feedback: NEW → IN_REVIEW → DONE and NEW → DONE, no reopen', () => {
    expect(canTransitionFeedback('NEW', 'IN_REVIEW')).toBe(true)
    expect(canTransitionFeedback('IN_REVIEW', 'DONE')).toBe(true)
    expect(canTransitionFeedback('NEW', 'DONE')).toBe(true)
    expect(canTransitionFeedback('DONE', 'NEW')).toBe(false)
    expect(canTransitionFeedback('DONE', 'IN_REVIEW')).toBe(false)
    expect(canTransitionFeedback('IN_REVIEW', 'NEW')).toBe(false)
    expect(SENDER_FEEDBACK_TYPES).toEqual(['BUG', 'UX', 'FEATURE'])
    expect(summaryBucket('IN_REVIEW')).toBe('open')
    expect(summaryBucket('DONE')).toBe('closed')
  })

  it('feedback: a screenshot lives exactly 90 days', () => {
    const created = new Date('2026-07-01T00:00:00Z')
    expect(FEEDBACK_SCREENSHOT_RETENTION_DAYS).toBe(90)
    expect(screenshotExpiresAt(created).toISOString()).toBe('2026-09-29T00:00:00.000Z')
    expect(isScreenshotExpired(created, new Date('2026-09-28T23:59:59Z'))).toBe(false)
    expect(isScreenshotExpired(created, new Date('2026-09-29T00:00:00Z'))).toBe(true)
  })

  it('feedback: guest e-mail optional and validated; context reduced to operator keys', () => {
    expect(parseGuestEmail(undefined)).toBeNull()
    expect(parseGuestEmail('  ')).toBeNull()
    expect(parseGuestEmail(' khach@example.vn ')).toBe('khach@example.vn')
    for (const bad of ['khach', 'a@b', 'a b@c.vn', '<x>@y.vn', `${'a'.repeat(250)}@x.vn`, 42]) {
      expect(parseGuestEmail(bad), String(bad)).toBe('invalid')
    }
    expect(
      projectFeedbackContext({ route: '/me', ip: '1.2.3.4', token: 't', browser: ' Safari ' }),
    ).toEqual({
      route: '/me',
      browser: 'Safari',
    })
    expect(projectFeedbackContext('x')).toEqual({})
  })

  it('accounts: no hard delete; requests end PROCESSED or DECLINED', () => {
    expect(HARD_DELETE_IN_PORTAL).toBe(false)
    expect(ACCOUNT_ACTION_EFFECT.LOCK.accountStatus).toBe('BLOCKED')
    expect(ACCOUNT_ACTION_EFFECT.SOFT_DELETE).toMatchObject({
      accountStatus: 'DEACTIVATED',
      retentionFlag: true,
    })
    expect(canTransitionAccountRequest('PENDING', 'PROCESSED')).toBe(true)
    expect(canTransitionAccountRequest('PENDING', 'DECLINED')).toBe(true)
    expect(canTransitionAccountRequest('DECLINED', 'PROCESSED')).toBe(false)
  })

  it('categories: existing types only, VENTURE_STAGE label and order only', () => {
    expect(CATEGORY_TYPE_CREATION_ALLOWED).toBe(false)
    expect(categoryChangeAllowed('DOMAIN', 'create')).toBe(true)
    expect(categoryChangeAllowed('REGION', 'archive')).toBe(true)
    expect(categoryChangeAllowed('VENTURE_STAGE', 'label')).toBe(true)
    expect(categoryChangeAllowed('VENTURE_STAGE', 'create')).toBe(false)
    expect(categoryChangeAllowed('VENTURE_STAGE', 'archive')).toBe(false)
    expect(categoryChangeAllowed('INDUSTRY', 'create')).toBe(false)
    expect(categoryChangeAllowed('__proto__', 'label')).toBe(false)
  })

  it('notifications: decisions only, each on its own resource', () => {
    expect(decisionNotification('VERIFICATION', 'APPROVED')).toBe('VERIFICATION_APPROVED')
    expect(decisionNotification('VENTURE_REVIEW', 'REJECTED')).toBe('VENTURE_REVIEW_REJECTED')
    expect(decisionNotification('VERIFICATION', 'PENDING')).toBeNull()
    expect(decisionNotification('VERIFICATION', 'WITHDRAWN')).toBeNull()
    expect(NOTIFICATION_RESOURCE.VERIFICATION_REJECTED).toBe('role_verification_request')
  })

  it('audit: allows ids, codes and flags only', () => {
    expect(() =>
      assertAuditSafe({
        status: 'PENDING',
        grantee_profile_id: ORG,
        capability: 'verification:review',
        source: ORG,
        fallback: true,
        version: 2,
        grantor_profile_id: null,
      }),
    ).not.toThrow()
    for (const key of [
      'password',
      'session_token',
      'guest_email',
      'position_title',
      'display_name',
      'body',
      'resolution_note',
      'screenshot_asset_id',
      'answers',
      'reason',
      'guestEmail',
      'positionTitle',
      'emails',
    ]) {
      expect(() => assertAuditSafe({ [key]: null }), key).toThrow(/key not allowed/)
    }
    expect(() => assertAuditSafe({ status: 'Trưởng Ban Truyền thông' })).toThrow(/value/)
    expect(() => assertAuditSafe({ organization_id: 'HUB Tổng' })).toThrow(/value/)
    expect(() => assertAuditSafe({ fallback_label: 'free text' })).toThrow(/value/)
    expect(() => assertAuditSafe({ status: { nested: true } as unknown as string })).toThrow(
      /scalar/,
    )
  })

  it('legacy periods: explicit months only, typos refused', () => {
    expect(parseLegacyPeriod('03/2024 - nay', NOW)).toEqual({ from: '2024-03-01', to: null })
    expect(parseLegacyPeriod('Từ 01/2021 đến 12/2022', NOW)).toEqual({
      from: '2021-01-01',
      to: '2022-12-01',
    })
    expect(parseLegacyPeriod('2024 – nay', NOW)).toEqual({ reason: 'period_year_only' })
    expect(parseLegacyPeriod('01/0000 - nay', NOW)).toEqual({ reason: 'period_unparsed' })
    expect(parseLegacyPeriod('13/2024 - nay', NOW)).toEqual({ reason: 'period_unparsed' })
    expect(parseLegacyPeriod('3/2024', NOW)).toEqual({ reason: 'period_unparsed' })
    expect(parseLegacyPeriod('11/2026 - nay', NOW)).toEqual({ reason: 'period_future' })
    expect(parseLegacyPeriod('06/2025 - 03/2024', NOW)).toEqual({ reason: 'period_order' })
    expect(parseLegacyPeriod(null, NOW)).toEqual({ reason: 'missing_period' })
  })

  it('compares scopes as canonical ids only', () => {
    expect(isSameScope(ORG, ORG.toUpperCase())).toBe(true)
    expect(isSameScope(ORG, null)).toBe(false)
    expect(isSameScope(undefined, undefined)).toBe(false)
  })
})
