import { query } from '@/lib/db/client'

/**
 * Launch-roster reconciliation at sign-in (Data Freeze D2; GAP-ROSTER).
 *
 * Delegates to the database routine roster_reconcile_account (migration 004),
 * the same one the roster CLI runs after an import, so sign-in and late import
 * apply identical rules: exact normalized-email match only, ACTIVE membership,
 * leadership only when the roster row states it, no RoleAssignment, existing
 * non-ACTIVE memberships never overwritten, and one transaction per call.
 * For an unmatched account it does nothing, not even create a profile.
 */
export type RosterOutcome = {
  bootstrap_id: string
  organization_id: string
  outcome: 'ATTACHED' | 'ALREADY_ACTIVE' | `CONFLICT_${string}`
}

export async function reconcileRoster(accountId: string): Promise<RosterOutcome[]> {
  return query<RosterOutcome>(
    `SELECT bootstrap_id::text, organization_id::text, outcome
       FROM roster_reconcile_account($1)`,
    [accountId],
  )
}
