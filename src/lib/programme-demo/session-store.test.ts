import { describe, expect, it } from 'vitest'

import { DEMO_CHALLENGE_ID, DEMO_PROGRAMMES, DEMO_PROGRAMME_ID } from './fixtures'
import {
  demoStoreKey,
  effectiveDetail,
  emptyDemoState,
  mergedSummaries,
  parseDemoState,
  readDemoState,
  resetDemoState,
  toSummary,
  withProgramme,
  withoutProgramme,
  writeDemoState,
  type StorageLike,
} from './session-store'
import type { ProgrammeDemoDetailDTO } from './types'

const CHAPTER_01 = '10000000-0000-0000-0000-000000000101'
const CHAPTER_02 = '10000000-0000-0000-0000-000000000102'
const org = (id: string) => ({ id, slug: 's', name: 'N', type: 'CHAPTER' })

const server: ProgrammeDemoDetailDTO[] = DEMO_PROGRAMMES.map((d) => ({
  ...structuredClone(d),
  organization: org(CHAPTER_01),
  demo: true,
}))

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

function draft(id: string, orgId: string): ProgrammeDemoDetailDTO {
  const d = structuredClone(server[1]!)
  d.programme = { ...d.programme, id, name: `Draft ${id.slice(-2)}`, organization_id: orgId }
  d.organization = org(orgId)
  return d
}

describe('WF04-T00 session store', () => {
  const key = demoStoreKey('actor-a')

  it('starts from the fixture (empty state) and keys per actor', () => {
    expect(readDemoState(memoryStorage(), key)).toEqual(emptyDemoState())
    expect(demoStoreKey('actor-a')).not.toBe(demoStoreKey('actor-b'))
  })

  it('persists a session copy across reads (refresh) without touching the fixture', () => {
    const storage = memoryStorage()
    const edited = structuredClone(server[0]!)
    edited.programme.name = 'Đã sửa trong phiên'
    expect(writeDemoState(storage, key, withProgramme(emptyDemoState(), edited))).toBe(true)
    const again = readDemoState(storage, key)
    expect(effectiveDetail(again, DEMO_PROGRAMME_ID, server[0])!.programme.name).toBe(
      'Đã sửa trong phiên',
    )
    expect(DEMO_PROGRAMMES[0]!.programme.name).toBe('Chương trình ươm tạo (demo)')
    expect(effectiveDetail(again, DEMO_CHALLENGE_ID, server[1])).toEqual(server[1])
  })

  it('reset restores exactly the fixture state', () => {
    const storage = memoryStorage()
    writeDemoState(
      storage,
      key,
      withProgramme(emptyDemoState(), draft('d-new-01', CHAPTER_01), true),
    )
    resetDemoState(storage, key)
    expect(storage.data.size).toBe(0)
    const state = readDemoState(storage, key)
    expect(state).toEqual(emptyDemoState())
    expect(mergedSummaries(server.map(toSummary), state, 'ALL')).toEqual(server.map(toSummary))
  })

  it('ignores unreadable, foreign-version or malformed values', () => {
    for (const raw of ['{', '[]', '{"version":2,"programmes":{},"created":[]}', 'null']) {
      expect(parseDemoState(raw)).toEqual(emptyDemoState())
    }
    const bad = JSON.stringify({
      version: 1,
      programmes: { x: { demo: true, programme: { id: 'y' } } },
      created: ['x', 42],
    })
    expect(parseDemoState(bad)).toEqual(emptyDemoState())
  })

  it('a storage that throws never breaks reads or writes', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: () => {
        throw new Error('quota')
      },
      removeItem: () => {
        throw new Error('denied')
      },
    }
    expect(readDemoState(broken, key)).toEqual(emptyDemoState())
    expect(writeDemoState(broken, key, emptyDemoState())).toBe(false)
    expect(() => resetDemoState(broken, key)).not.toThrow()
  })

  it('lists drafts first (newest first), only inside the allowance; copies replace fixture rows', () => {
    let state = withProgramme(emptyDemoState(), draft('d-new-01', CHAPTER_01), true)
    state = withProgramme(state, draft('d-new-02', CHAPTER_02), true)
    state = withProgramme(state, draft('d-new-03', CHAPTER_01), true)
    const renamed = structuredClone(server[1]!)
    renamed.programme.name = 'Challenge đã sửa'
    state = withProgramme(state, renamed)
    const ids = (allowance: 'ALL' | string[]) =>
      mergedSummaries(server.map(toSummary), state, allowance).map((s) => s.id)
    expect(ids([CHAPTER_01])).toEqual([
      'd-new-03',
      'd-new-01',
      DEMO_PROGRAMME_ID,
      DEMO_CHALLENGE_ID,
    ])
    expect(ids('ALL')).toEqual([
      'd-new-03',
      'd-new-02',
      'd-new-01',
      DEMO_PROGRAMME_ID,
      DEMO_CHALLENGE_ID,
    ])
    const listed = mergedSummaries(server.map(toSummary), state, 'ALL')
    expect(listed.find((s) => s.id === DEMO_CHALLENGE_ID)!.name).toBe('Challenge đã sửa')
    expect(withoutProgramme(state, 'd-new-01').created).toEqual(['d-new-03', 'd-new-02'])
  })

  it('a session copy never adds a programme the server did not list', () => {
    const state = withProgramme(emptyDemoState(), structuredClone(server[0]!))
    expect(mergedSummaries([toSummary(server[1]!)], state, 'ALL').map((s) => s.id)).toEqual([
      DEMO_CHALLENGE_ID,
    ])
  })

  it('never shows an id twice, even if a stored draft reuses a listed id (the copy wins)', () => {
    const copy = structuredClone(server[1]!)
    copy.programme.name = 'Bản sửa'
    const state = withProgramme(emptyDemoState(), copy, true)
    const listed = mergedSummaries(server.map(toSummary), state, 'ALL')
    expect(listed.map((s) => [s.id, s.name])).toEqual([
      [DEMO_PROGRAMME_ID, 'Chương trình ươm tạo (demo)'],
      [DEMO_CHALLENGE_ID, 'Bản sửa'],
    ])
  })

  it('stores copies, never references', () => {
    const d = structuredClone(server[0]!)
    const state = withProgramme(emptyDemoState(), d)
    d.programme.name = 'changed after save'
    expect(state.programmes[DEMO_PROGRAMME_ID]!.programme.name).toBe('Chương trình ươm tạo (demo)')
  })

  it('summaries count stages, events and (Challenge only) problem statements', () => {
    expect(toSummary(server[0]!).counts).toEqual({ stages: 3, events: 2, problem_statements: null })
    expect(toSummary(server[1]!).counts).toEqual({ stages: 2, events: 1, problem_statements: 2 })
  })
})
