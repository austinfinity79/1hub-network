import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { COMMAND_CLASS, DbTargetError, resolveDbTarget } from '../../../scripts/db-target.mjs'

import { assertIsolatedTestDatabase } from './db-test-target'

/**
 * DB-SAFETY-01 — the database-target guard, without a database.
 *
 * The spawned runs point at 127.0.0.1:1, where nothing listens: had the runner
 * tried to connect it would fail with ECONNREFUSED and exit 1. Exit 2 with the
 * refusal code, and no TARGET lines, proves it stopped before any connection.
 */

const RUNNER = fileURLToPath(new URL('../../../scripts/db.mjs', import.meta.url))
const SHARED = 'postgresql://u:p@127.0.0.1:1/hubnetwork_p0'
const ISOLATED = 'postgresql://u:p@127.0.0.1:1/hubnetwork_task_x'

function code(fn: () => unknown): string | undefined {
  try {
    fn()
  } catch (error) {
    return error instanceof DbTargetError ? error.code : String(error)
  }
  return undefined
}

function run(args: string[], databaseUrl?: string) {
  // The parent's database settings never leak into the child: only what the test names.
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const key of Object.keys(env)) {
    if (key === 'DATABASE_URL' || key.startsWith('PG')) delete env[key]
  }
  if (databaseUrl) env.DATABASE_URL = databaseUrl
  return spawnSync(process.execPath, [RUNNER, ...args], { env, encoding: 'utf8' })
}

describe('command classes', () => {
  it('reset is destructive, migrate, seed and catalog mutate, status and introspect read', () => {
    expect(COMMAND_CLASS).toEqual({
      reset: 'DESTRUCTIVE',
      migrate: 'MUTATING',
      seed: 'MUTATING',
      catalog: 'MUTATING',
      status: 'READ_ONLY',
      introspect: 'READ_ONLY',
    })
  })
})

describe('A: a destructive or mutating command without DATABASE_URL fails closed', () => {
  it('resolver refuses', () => {
    expect(code(() => resolveDbTarget('reset', { env: {} }))).toBe(
      'DATABASE_URL_REQUIRED_FOR_DESTRUCTIVE_DB_COMMAND',
    )
    expect(code(() => resolveDbTarget('reset', { env: { DATABASE_URL: '  ' } }))).toBe(
      'DATABASE_URL_REQUIRED_FOR_DESTRUCTIVE_DB_COMMAND',
    )
    for (const command of ['migrate', 'seed', 'catalog']) {
      expect(code(() => resolveDbTarget(command, { env: {} }))).toBe(
        'DATABASE_URL_REQUIRED_FOR_MUTATING_DB_COMMAND',
      )
    }
  })

  it('runner exits 2 before connecting, writing nothing', () => {
    for (const command of ['reset', 'migrate', 'seed', 'catalog']) {
      const result = run([command])
      expect(result.status, command).toBe(2)
      expect(result.stderr).toMatch(/DATABASE_URL_REQUIRED_FOR_(DESTRUCTIVE|MUTATING)_DB_COMMAND/)
      expect(result.stderr).not.toMatch(/ECONNREFUSED/)
      expect(result.stdout).toBe('')
    }
  })
})

describe('B: a destructive command on the shared database needs its explicit acknowledgement', () => {
  it('resolver refuses without, or with the wrong, acknowledgement', () => {
    const env = { DATABASE_URL: SHARED }
    expect(code(() => resolveDbTarget('reset', { env }))).toBe(
      'SHARED_DB_DESTRUCTIVE_COMMAND_REFUSED',
    )
    expect(code(() => resolveDbTarget('reset', { env, argv: ['--confirm-shared-db'] }))).toBe(
      'SHARED_DB_DESTRUCTIVE_COMMAND_REFUSED',
    )
    expect(
      code(() => resolveDbTarget('reset', { env, argv: ['--confirm-shared-db=hubnetwork_x'] })),
    ).toBe('SHARED_DB_DESTRUCTIVE_COMMAND_REFUSED')
    // An environment variable never acknowledges: it could be exported globally.
    expect(
      code(() =>
        resolveDbTarget('reset', { env: { ...env, ALLOW_SHARED_DB_RESET: '1' }, argv: [] }),
      ),
    ).toBe('SHARED_DB_DESTRUCTIVE_COMMAND_REFUSED')
  })

  it('runner exits 2 before connecting', () => {
    const result = run(['reset'], SHARED)
    expect(result.status).toBe(2)
    expect(result.stderr).toMatch(/SHARED_DB_DESTRUCTIVE_COMMAND_REFUSED/)
    expect(result.stderr).not.toMatch(/ECONNREFUSED/)
    expect(result.stdout).toBe('')
  })

  it('the named acknowledgement on the command line is accepted', () => {
    expect(
      resolveDbTarget('reset', {
        env: { DATABASE_URL: SHARED },
        argv: ['--confirm-shared-db=hubnetwork_p0'],
      }),
    ).toMatchObject({ database: 'hubnetwork_p0', commandClass: 'DESTRUCTIVE', explicit: true })
  })
})

describe('C: an isolated database named explicitly is allowed', () => {
  it('for every command', () => {
    for (const command of ['reset', 'migrate', 'seed', 'status', 'introspect']) {
      expect(resolveDbTarget(command, { env: { DATABASE_URL: ISOLATED } })).toMatchObject({
        database: 'hubnetwork_task_x',
        host: '127.0.0.1:1',
        explicit: true,
      })
    }
  })
})

describe('D: read-only commands keep the documented local default', () => {
  it('status and introspect resolve without DATABASE_URL', () => {
    for (const command of ['status', 'introspect']) {
      expect(resolveDbTarget(command, { env: {} })).toMatchObject({
        database: 'hubnetwork_p0',
        commandClass: 'READ_ONLY',
        explicit: false,
      })
    }
  })
})

describe('E: the target is printed before a writing command touches the database', () => {
  it('TARGET lines come first, password masked', () => {
    const result = run(['reset', '--confirm-shared-db=hubnetwork_p0'], SHARED)
    // It reached the connection only after printing the target (nothing listens on :1).
    expect(result.stderr).toMatch(/ECONNREFUSED/)
    expect(result.stdout.split('\n').slice(0, 4)).toEqual([
      '  TARGET_DB       postgresql://u:***@127.0.0.1:1/hubnetwork_p0',
      '  TARGET_HOST     127.0.0.1:1',
      '  TARGET_DATABASE hubnetwork_p0',
      '  COMMAND_CLASS   DESTRUCTIVE',
    ])
    expect(result.stdout).not.toMatch(/:p@/)
  })
})

describe('the DB test suite runs only on an isolated database', () => {
  it('refuses a missing DATABASE_URL and the shared database; accepts an isolated one', () => {
    expect(() => assertIsolatedTestDatabase({})).toThrow(/DATABASE_URL_REQUIRED/)
    expect(() => assertIsolatedTestDatabase({ DATABASE_URL: SHARED })).toThrow(
      /SHARED_DB_TEST_RUN_REFUSED/,
    )
    expect(assertIsolatedTestDatabase({ DATABASE_URL: ISOLATED })).toBe('hubnetwork_task_x')
    // Migration tests' own databases share the prefix but are not the shared one.
    expect(
      assertIsolatedTestDatabase({ DATABASE_URL: 'postgresql://u@h/hubnetwork_p0_s1a_fresh' }),
    ).toBe('hubnetwork_p0_s1a_fresh')
  })
})
