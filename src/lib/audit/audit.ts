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
  // WF02-S06 venture team (DEC-WF02-S06-G7): ids and states only, never the email.
  | 'VENTURE_TEAM_INVITED'
  | 'VENTURE_TEAM_JOINED'
  | 'VENTURE_TEAM_INVITATION_REJECTED'
  | 'VENTURE_TEAM_ROLE_CHANGED'
  | 'VENTURE_TEAM_REMOVED'
  // WF03-S04 membership review / leadership ops (DEC-WF03-G14): ids and states only.
  | 'MEMBERSHIP_APPROVED'
  | 'MEMBERSHIP_REJECTED'
  | 'LEADERSHIP_CREATED'
  | 'LEADERSHIP_ENDED'
  // WF03-S06 organization profile (DEC-WF03-G14): ids, field names, public name delta.
  | 'ORGANIZATION_UPDATED'

export async function writeAudit(
  exec: Executor,
  event: {
    actorAccountId: string
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
