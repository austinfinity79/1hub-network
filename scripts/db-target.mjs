/**
 * DB-SAFETY-01 — which database a script may touch, decided before it connects.
 *
 * Two incidents (S1-UAT-01, S1-UAT-05) changed the SHARED dev database
 * `hubnetwork_p0` because a script fell back to it when DATABASE_URL was not
 * actually present in the child process. Nothing here falls back any more for
 * a command that writes:
 *
 *   DESTRUCTIVE  reset              explicit DATABASE_URL required; a shared
 *                                   database also needs, on the same command
 *                                   line, --confirm-shared-db=<its name>
 *   MUTATING     migrate, seed,     explicit DATABASE_URL required
 *                catalog, demo
 *   READ_ONLY    status, introspect  may use the documented local default
 *
 * The shared-database acknowledgement is a command-line flag naming the
 * database, never an environment variable: a variable can be exported once and
 * silently apply to every later command, a flag cannot.
 *
 * Pure: no connection, no I/O. A refusal is thrown before any client exists.
 */

export const LOCAL_DEFAULT_URL =
  'postgresql://hubnetwork:hubnetwork_local_dev@localhost:55432/hubnetwork_p0'

/** Databases other people and sessions rely on (compose.yaml POSTGRES_DB). */
export const SHARED_DATABASES = ['hubnetwork_p0']

export const COMMAND_CLASS = {
  reset: 'DESTRUCTIVE',
  migrate: 'MUTATING',
  seed: 'MUTATING',
  catalog: 'MUTATING',
  demo: 'MUTATING',
  status: 'READ_ONLY',
  introspect: 'READ_ONLY',
}

export class DbTargetError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`)
    this.code = code
  }
}

function parse(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    throw new DbTargetError('DATABASE_URL_INVALID', 'DATABASE_URL is not a valid URL.')
  }
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  if (!database) {
    throw new DbTargetError('DATABASE_URL_INVALID', 'DATABASE_URL names no database.')
  }
  return { database, host: parsed.host }
}

/** The URL with its password masked, for printing. */
export function maskUrl(url) {
  const parsed = new URL(url)
  if (parsed.password) parsed.password = '***'
  return parsed.toString()
}

/**
 * Resolves the target of `command` from the process environment and argv.
 * Returns { url, database, host, commandClass, explicit } or throws DbTargetError.
 */
export function resolveDbTarget(command, { env = process.env, argv = [] } = {}) {
  const commandClass = COMMAND_CLASS[command]
  if (!commandClass) throw new DbTargetError('DB_COMMAND_UNKNOWN', `Unknown command "${command}".`)

  const supplied = env.DATABASE_URL?.trim()
  if (!supplied && commandClass !== 'READ_ONLY') {
    const code =
      commandClass === 'DESTRUCTIVE'
        ? 'DATABASE_URL_REQUIRED_FOR_DESTRUCTIVE_DB_COMMAND'
        : 'DATABASE_URL_REQUIRED_FOR_MUTATING_DB_COMMAND'
    throw new DbTargetError(
      code,
      `"${command}" changes a database, so it never falls back to a default. ` +
        'Export DATABASE_URL for the isolated database this command is meant for.',
    )
  }
  const url = supplied || LOCAL_DEFAULT_URL
  const { database, host } = parse(url)

  if (commandClass === 'DESTRUCTIVE' && SHARED_DATABASES.includes(database)) {
    const confirmed = argv.includes(`--confirm-shared-db=${database}`)
    if (!confirmed) {
      throw new DbTargetError(
        'SHARED_DB_DESTRUCTIVE_COMMAND_REFUSED',
        `"${command}" would destroy the shared database "${database}". Only an authorised ` +
          `shared-dev maintenance task may do this, by adding --confirm-shared-db=${database}.`,
      )
    }
  }
  return { url, database, host, commandClass, explicit: Boolean(supplied) }
}

/** For scripts that only write rows: an explicit DATABASE_URL or nothing. */
export function requireDatabaseUrl(purpose, env = process.env) {
  const supplied = env.DATABASE_URL?.trim()
  if (!supplied) {
    throw new DbTargetError(
      'DATABASE_URL_REQUIRED',
      `${purpose} writes to a database and never falls back to a default. Export DATABASE_URL.`,
    )
  }
  parse(supplied)
  return supplied
}
