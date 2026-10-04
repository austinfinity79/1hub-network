import type { Actor } from '@/lib/authz/actor'

import { holdsPlatform } from './scope'

/**
 * ADMIN-PROD-02 — account lifecycle foundation (PD-7; ADMIN-PROD-01 account
 * lifecycle). Execution is PLATFORM_ADMIN's alone (`account:administer`,
 * platform-only, never delegable). A user's own deletion request stays in
 * `account_deletion_requests` and is processed or declined by PLATFORM_ADMIN.
 * ADMIN-DECISION-04: unit leaders have no account capability and no
 * account-request route in P0 (they use the generic support / feedback
 * channels); `account_action_requests` (migration 017) is kept but no P0 path
 * writes it. Hard delete is never a portal action: it is the separate retention
 * procedure.
 */

export const ACCOUNT_ACTIONS = ['LOCK', 'DEACTIVATE', 'SOFT_DELETE'] as const
export type AccountAction = (typeof ACCOUNT_ACTIONS)[number]

export const ACCOUNT_REQUEST_STATUSES = ['PENDING', 'PROCESSED', 'DECLINED'] as const
export type AccountRequestStatus = (typeof ACCOUNT_REQUEST_STATUSES)[number]

export const HARD_DELETE_IN_PORTAL = false

export const ACCOUNT_REQUEST_LIMITS = { reason: 500 } as const

/** What each action does when PLATFORM_ADMIN executes it (ADMIN-PROD-05). */
export const ACCOUNT_ACTION_EFFECT: Record<
  AccountAction,
  {
    accountStatus: 'BLOCKED' | 'DEACTIVATED'
    profileStatus: 'DEACTIVATED' | null
    revokeSessions: true
    closeScopedAssignments: boolean
    retentionFlag: boolean
  }
> = {
  // Sign-in already answers AUTH_ACCOUNT_BLOCKED; UNLOCK returns to ACTIVE.
  LOCK: {
    accountStatus: 'BLOCKED',
    profileStatus: null,
    revokeSessions: true,
    closeScopedAssignments: false,
    retentionFlag: false,
  },
  // REACTIVATE reverses the statuses only.
  DEACTIVATE: {
    accountStatus: 'DEACTIVATED',
    profileStatus: 'DEACTIVATED',
    revokeSessions: true,
    closeScopedAssignments: true,
    retentionFlag: false,
  },
  // A deactivation flagged for the separate hard-deletion / retention procedure.
  SOFT_DELETE: {
    accountStatus: 'DEACTIVATED',
    profileStatus: 'DEACTIVATED',
    revokeSessions: true,
    closeScopedAssignments: true,
    retentionFlag: true,
  },
}

/** Only PLATFORM_ADMIN executes; a leader's scope never reaches this. */
export function mayExecuteAccountAction(actor: Actor | null): boolean {
  return holdsPlatform(actor, 'account:administer')
}

export function canTransitionAccountRequest(
  from: AccountRequestStatus,
  to: AccountRequestStatus,
): boolean {
  return from === 'PENDING' && (to === 'PROCESSED' || to === 'DECLINED')
}
