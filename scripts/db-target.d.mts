/** Types for scripts/db-target.mjs (DB-SAFETY-01), so TypeScript tests can import it. */

export type CommandClass = 'DESTRUCTIVE' | 'MUTATING' | 'READ_ONLY'

export declare const LOCAL_DEFAULT_URL: string
export declare const SHARED_DATABASES: readonly string[]
export declare const COMMAND_CLASS: Readonly<Record<string, CommandClass>>

export declare class DbTargetError extends Error {
  readonly code: string
  constructor(code: string, message: string)
}

export declare function maskUrl(url: string): string

export declare function resolveDbTarget(
  command: string,
  options?: { env?: Record<string, string | undefined>; argv?: readonly string[] },
): { url: string; database: string; host: string; commandClass: CommandClass; explicit: boolean }

export declare function requireDatabaseUrl(
  purpose: string,
  env?: Record<string, string | undefined>,
): string
