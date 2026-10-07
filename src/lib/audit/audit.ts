import type { Executor } from '@/lib/db/client'

/**
 * Audit events for sensitive mutations (CLAUDE.md §4; Freeze D4 "any change to
 * Terms/Privacy version, visibility or consent must create an audit event").
 * Written in the caller's transaction so the event commits with the change.
 * Callers pass only what review needs; no free text, no contact data.
 */
export type AuditAction =
  | 'CONSENT_ACCEPTED'
  | 'PROFILE_VISIBILITY_CHANGED'
  | 'PROFILE_ACTIVATED'
  | 'MEMBERSHIP_REQUESTED'
  | 'ACCOUNT_DELETION_REQUESTED'
  // S1-UAT-01 auth security events: ids and timestamps only, never a password,
  // hash, token or e-mail.
  | 'AUTH_PASSWORD_LOGIN_LOCKED'
  | 'AUTH_PASSWORD_RESET_COMPLETED'
  | 'AUTH_GOOGLE_IDENTITY_LINKED'
  // A sign-up refused because the e-mail has an account; the answer stays neutral.
  | 'AUTH_REGISTRATION_CONFLICT'
  // WF02-S06 venture team (DEC-WF02-S06-G7): ids and states only, never the email.
  | 'VENTURE_TEAM_INVITED'
  | 'VENTURE_TEAM_JOINED'
  | 'VENTURE_TEAM_INVITATION_REJECTED'
  | 'VENTURE_TEAM_ROLE_CHANGED'
  | 'VENTURE_TEAM_REMOVED'
  // S1-UAT-07 (DEC-S1I): an e-mail invitation re-sent (+7 days); invite links
  // created or regenerated. Ids, states and link ids only, never a token.
  | 'VENTURE_TEAM_INVITATION_RESENT'
  | 'VENTURE_INVITE_LINK_CREATED'
  | 'VENTURE_INVITE_LINK_REGENERATED'
  // WF02 venture record (DEC-L2R-D9): ids, type, status and field names only.
  | 'VENTURE_CREATED'
  | 'VENTURE_UPDATED'
  // "Công khai" (DEC-PDF-D1): ids, status and visibility only.
  | 'VENTURE_PUBLISHED'
  // WF03-S04 membership review / leadership ops (DEC-WF03-G14): ids and states only.
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED'
  | 'LEADERSHIP_CREATED'
  | 'LEADERSHIP_ENDED'
  // WF03-S06 organization profile (DEC-WF03-G14): ids, field names, public name delta.
  | 'ORGANIZATION_UPDATED'
  // WF03-S08 relationships (DEC-WF03-S08-RELATIONSHIP-CONTRACT): ids, type, state only.
  | 'ORGANIZATION_RELATIONSHIP_CREATED'
  | 'ORGANIZATION_RELATIONSHIP_ENDED'
  // WF03-S07 standalone events (DEC-WF03-G14): ids, status and field names only.
  | 'EVENT_CREATED'
  | 'EVENT_UPDATED'
  | 'EVENT_PUBLISHED'
  | 'EVENT_CANCELLED'
  // L5 application (DEC-L5-D3): ids and statuses only, never answers.
  | 'APPLICATION_DRAFT_CREATED'
  // WF05-PROD-05: a save that changes an answer; changed question ids, never a value.
  | 'APPLICATION_DRAFT_UPDATED'
  | 'APPLICATION_SUBMITTED'
  // WF04 programmes (DEC-W4P-D12, contract §14): ids, type, statuses, versions and
  // field names only, never free text.
  | 'PROGRAMME_CREATED'
  | 'PROGRAMME_UPDATED'
  | 'PROGRAMME_REGISTRATION_UPDATED'
  | 'PROGRAMME_PUBLISHED'
  | 'PROGRAMME_CLOSED'
  // THAO-06 Startup Profile v2 (DEC-THAO-SP): ids, metric slug, period, visibility
  // and update ids only; never a metric value or an update's text.
  | 'VENTURE_METRIC_RECORDED'
  | 'VENTURE_METRIC_VISIBILITY_CHANGED'
  | 'VENTURE_UPDATE_POSTED'
  | 'VENTURE_UPDATE_EDITED'
  | 'VENTURE_UPDATE_DELETED'
  | AdminAuditAction

/**
 * Admin Portal P0 (ADMIN-PROD-01 audit contract, DEC-ADM): ids, states, scope
 * and an optional decision reason only; never a password, token, session,
 * e-mail, profile field, feedback text, screenshot or uploaded document.
 * Written through `writeAdminAudit` (src/lib/admin/admin-audit.ts), which
 * refuses any other payload. ADMIN-PROD-02 … 05 write them; ORGANIZATION_* stay
 * frozen for the organization lifecycle APIs (not yet assigned).
 */
export type AdminAuditAction =
  | 'ACCESS_GRANTED'
  | 'ACCESS_REVOKED'
  | 'VERIFICATION_REQUEST_SUBMITTED'
  | 'VERIFICATION_REQUEST_UPDATED'
  | 'VERIFICATION_REQUEST_WITHDRAWN'
  | 'VERIFICATION_REQUEST_RESUBMITTED'
  | 'VERIFICATION_REQUEST_APPROVED'
  // ADMIN-PROD-03: the approval reused the requester's ACTIVE membership of the unit.
  | 'VERIFICATION_REQUEST_APPROVED_EXISTING_MEMBERSHIP'
  | 'VERIFICATION_REQUEST_REJECTED'
  // ADMIN-PROD-03: a requester tried to decide their own request (refused, 403).
  | 'VERIFICATION_REQUEST_SELF_ACTION_REFUSED'
  // ADMIN-PROD-03: a legacy onboarding declaration converted to a request (system actor).
  | 'VERIFICATION_REQUEST_MIGRATED'
  | 'VENTURE_REVIEW_SUBMITTED'
  // ADMIN-PROD-04: a new submission after a rejected one.
  | 'VENTURE_REVIEW_RESUBMITTED'
  // ADMIN-PROD-04: a reviewer tried to decide a venture they own or belong to (refused, 403).
  | 'VENTURE_REVIEW_SELF_ACTION_REFUSED'
  | 'VENTURE_REVIEW_UPDATED'
  | 'VENTURE_REVIEW_WITHDRAWN'
  | 'VENTURE_REVIEW_APPROVED'
  | 'VENTURE_REVIEW_REJECTED'
  | 'ORGANIZATION_CREATED'
  | 'ORGANIZATION_ACTIVATED'
  | 'ORGANIZATION_DEACTIVATED'
  | 'FEEDBACK_UPDATED'
  // ADMIN-PROD-05: the task's granular feedback codes (FEEDBACK_UPDATED stays for type / note).
  | 'FEEDBACK_ASSIGNED'
  | 'FEEDBACK_STATUS_CHANGED'
  | 'FEEDBACK_PRIORITY_CHANGED'
  | 'VOCABULARY_ITEM_CREATED'
  | 'VOCABULARY_ITEM_UPDATED'
  // ADMIN-PROD-05: the task's CATEGORY_ARCHIVED / _ACTIVATED inside the frozen VOCABULARY_ITEM_* family.
  | 'VOCABULARY_ITEM_ARCHIVED'
  | 'VOCABULARY_ITEM_ACTIVATED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'ACCOUNT_DEACTIVATED'
  | 'ACCOUNT_REACTIVATED'
  // ADMIN-PROD-05: the task's SOFT_DELETE_REQUESTED, and a refused action on one's own account.
  | 'ACCOUNT_SOFT_DELETE_REQUESTED'
  | 'ACCOUNT_SELF_ACTION_REFUSED'
  | 'ACCOUNT_REQUEST_FILED'
  | 'ACCOUNT_REQUEST_PROCESSED'
  | 'ACCOUNT_REQUEST_DECLINED'

export async function writeAudit(
  exec: Executor,
  event: {
    /** Null only for a system action with no signed-in actor (a data conversion). */
    actorAccountId: string | null
    action: AuditAction
    resourceType: string
    resourceId: string
    before?: Record<string, unknown> | null
    after?: Record<string, unknown> | null
    requestId: string
  },
): Promise<void> {
  await exec(
    `INSERT INTO audit_events
       (actor_account_id, action, resource_type, resource_id, before_data, after_data, request_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      event.actorAccountId,
      event.action,
      event.resourceType,
      event.resourceId,
      event.before ? JSON.stringify(event.before) : null,
      event.after ? JSON.stringify(event.after) : null,
      event.requestId,
    ],
  )
}
