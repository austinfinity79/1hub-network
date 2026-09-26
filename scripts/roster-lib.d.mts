export type RosterExec = (sql: string, params?: unknown[]) => Promise<Record<string, unknown>[]>

export type RosterRow = {
  line: number
  email: string
  organization_slug: string
  leadership_role_label: string | null
  source_batch: string
}

export type RosterError = { line: number; who?: string; reason: string }

export type RosterReport = {
  rows_total: number
  rows_valid: number
  rows_invalid: number
  duplicate_rows_in_file: number
  bootstrap_new: number
  bootstrap_existing: number
  accounts_matched: number
  memberships_to_attach: number
  leadership_to_attach: number
  attached: number
  already_active: number
  conflicts: { who: string; organization_slug: string | undefined; outcome: string }[]
  errors: RosterError[]
  dry_run: boolean
}

export declare const ROSTER_HEADER: string[]
export declare function normalizeEmail(email: string): string
export declare function isPlausibleEmail(email: string): boolean
export declare function maskEmail(email: string): string
export declare function parseCsv(text: string): string[][]
export declare function validateShape(text: string): {
  rows: RosterRow[]
  errors: RosterError[]
  duplicates: number
}
export declare function importRoster(
  exec: RosterExec,
  text: string,
  options?: { dryRun?: boolean },
): Promise<RosterReport>
