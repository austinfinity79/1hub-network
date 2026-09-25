/**
 * M0-T05 — wire types, hand-written from the authoritative Markdown contract.
 *
 * These are DTO shapes, never ORM rows. Contract principle 4 (05:16) forbids
 * returning database rows, so every response type here is declared explicitly
 * rather than derived from a persistence model.
 */

/** Contract principle 10 (05:23): IDs are opaque strings to the client. */
export type OpaqueId = string

/** Contract principle 9 (05:22): ISO-8601 UTC string. */
export type IsoDateTime = string

/** List envelope, 05:69-79. Single resources are returned bare. */
export type ListEnvelope<T> = {
  items: T[]
  page: {
    next_cursor: string | null
    limit: number
  }
}

/** Query parameters for a paginated list, 04:262-266. */
export type ListQuery = {
  cursor?: string
  limit?: number
}

/** Error envelope, 05:83-94. `fields` is an optional per-field message map. */
export type ErrorEnvelope = {
  error: {
    code: string
    message: string
    fields?: Record<string, string>
    request_id: string
  }
}

/** GET /session, 05:113-149. */
export type SessionAccount = {
  id: OpaqueId
  email: string
  email_verified: boolean
  status: string
}

export type SessionProfile = {
  id: OpaqueId
  status: string
  onboarding_completed: boolean
  completion_percent: number
}

export type ManagedScope = {
  scope_type: string
  scope_id: OpaqueId
  role_code: string
}

/**
 * The contract permits either `200 {authenticated:false}` or `401` when
 * unauthenticated and requires one to be chosen consistently (05:149). This
 * implementation takes the contract's own recommendation: 200 with
 * authenticated=false, so app bootstrap needs no error path.
 */
export type SessionDTO =
  | {
      authenticated: false
    }
  | {
      authenticated: true
      account: SessionAccount
      profile: SessionProfile
      capabilities: string[]
      managed_scopes: ManagedScope[]
    }
