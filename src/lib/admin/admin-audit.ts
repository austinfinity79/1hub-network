import { writeAudit, type AdminAuditAction } from '@/lib/audit/audit'
import type { Executor } from '@/lib/db/client'

/**
 * ADMIN-PROD-02 — the one audit hook for Admin Portal mutations (ADMIN-PROD-01
 * audit contract). Reuses `audit_events` through `writeAudit`, in the caller's
 * transaction, so the event commits with the change or not at all.
 *
 * Shape, the same for every admin action:
 *   actor            actor_account_id
 *   target           resource_type + resource_id
 *   action           the frozen code
 *   timestamp        audit_events.created_at
 *   before / after   { status, …ids }
 *   scope            after.organization_id when the action is scoped
 *   reason           after.reason, only when the decision carries one
 *
 * Keys and values are allowlisted (`assertAuditSafe`); anything else is a
 * programming error, thrown before anything is written. The decision reason
 * enters only through `reason`, never as a payload key.
 */

export type AuditScalar = string | number | boolean | null

export type AdminAuditTarget =
  | 'role_assignment'
  | 'role_verification_request'
  | 'venture_review'
  | 'organization'
  | 'feedback_submission'
  | 'vocabulary_item'
  | 'user_account'
  | 'account_action_request'
  | 'account_deletion_request'

/**
 * An allowlist, so free text cannot enter by a new key or a new spelling:
 *   key     snake_case words only, none of the words below, singular or plural
 *           (credentials, sessions, contact data, free text, files);
 *   value   null, boolean or number; a string only as a UUID under a `*_id` key,
 *           or as a code (`[A-Za-z0-9_:-]`, ≤ 64) under a code key.
 * So `guest_email`, `positionTitle`, `emails` and `{ status: 'any sentence' }`
 * are refused, while `grantee_profile_id` and `capability` pass.
 */
const FORBIDDEN_WORDS = new Set([
  'password',
  'token',
  'secret',
  'session',
  'cookie',
  'email',
  'phone',
  'body',
  'content',
  'answer',
  'screenshot',
  'document',
  'file',
  'note',
  'bio',
  'name',
  'title',
  'reason',
])
const SNAKE_KEY = /^[a-z]+(_[a-z]+)*$/
const CODE_KEYS = new Set([
  'status',
  'state',
  'role_code',
  'capability',
  'source',
  'action',
  'kind',
  'type',
  'priority',
  'membership_outcome',
  'leadership_outcome',
  'leadership_state',
])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CODE = /^[A-Za-z0-9_:-]{1,64}$/

export function assertAuditSafe(data: Record<string, AuditScalar> | null | undefined): void {
  if (!data) return
  for (const [key, value] of Object.entries(data)) {
    if (
      !SNAKE_KEY.test(key) ||
      key.split('_').some((word) => FORBIDDEN_WORDS.has(word.replace(/s$/, '')))
    ) {
      throw new Error(`audit payload key not allowed: ${key}`)
    }
    if (value === null || typeof value === 'boolean') continue
    if (typeof value === 'number' && Number.isFinite(value)) continue
    if (typeof value === 'string') {
      if (key.endsWith('_id') ? UUID.test(value) : CODE_KEYS.has(key) && CODE.test(value)) continue
      throw new Error(`audit payload value not allowed: ${key}`)
    }
    throw new Error(`audit payload value must be a scalar: ${key}`)
  }
}

export async function writeAdminAudit(
  exec: Executor,
  event: {
    /** Null for a system conversion (history shows SYSTEM). */
    actorAccountId: string | null
    action: AdminAuditAction
    target: { type: AdminAuditTarget; id: string }
    /** The organization the action was authorized for, when scoped. */
    organizationId?: string | null
    before?: Record<string, AuditScalar> | null
    after: Record<string, AuditScalar>
    /** A decision reason (≤ 500, already validated by the caller). */
    reason?: string | null
    requestId: string
  },
): Promise<void> {
  const after: Record<string, AuditScalar> = {
    ...event.after,
    ...(event.organizationId ? { organization_id: event.organizationId } : {}),
  }
  assertAuditSafe(event.before)
  assertAuditSafe(after)
  if (event.reason) after.reason = event.reason
  await writeAudit(exec, {
    actorAccountId: event.actorAccountId,
    action: event.action,
    resourceType: event.target.type,
    resourceId: event.target.id,
    before: event.before ?? null,
    after,
    requestId: event.requestId,
  })
}
