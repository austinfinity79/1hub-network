import { describe, expect, it } from 'vitest'

import { DEMO_CHALLENGE_ID, DEMO_PROGRAMME_ID, demoFixture } from './fixtures'
import {
  addProblem,
  addStage,
  instantToDay,
  moveStage,
  orderedStages,
  removeProblem,
  removeStage,
  updateProblem,
  updateStage,
  validateStage,
} from './journey'
import { publishReadiness } from './readiness'
import type { ProgrammeDemoDetail } from './types'

const now = new Date('2026-09-27T05:00:00.000Z')
const copy = (id: string) => structuredClone(demoFixture(id)!) as ProgrammeDemoDetail
const names = (d: ProgrammeDemoDetail) => orderedStages(d).map((s) => [s.position, s.name])
const stage = { name: 'Kết nối', summary: '', starts_on: '', ends_on: '' }

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error(`expected ok, got ${JSON.stringify(result)}`)
  return (result as unknown as { detail: ProgrammeDemoDetail }).detail
}

describe('WF04-S03 stages', () => {
  it('orders by stored position, not array order', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    d.stages.reverse()
    expect(names(d)).toEqual([
      [1, 'Mở đăng ký'],
      [2, 'Ươm tạo'],
      [3, 'Ngày trình diễn'],
    ])
  })

  it('adds exactly one stage at the end with a contiguous position; trims; optional fields null', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const next = ok(addStage(d, { ...stage, name: '  Kết nối  ' }, { id: 's-new', now }))
    expect(names(next)).toEqual([
      [1, 'Mở đăng ký'],
      [2, 'Ươm tạo'],
      [3, 'Ngày trình diễn'],
      [4, 'Kết nối'],
    ])
    expect(next.stages.find((s) => s.id === 's-new')).toEqual({
      id: 's-new',
      position: 4,
      name: 'Kết nối',
      summary: null,
      starts_at: null,
      ends_at: null,
    })
    expect(next.programme.updated_at).toBe(now.toISOString())
    expect(d.stages).toHaveLength(3)
  })

  it('edits only the stage fields; dates round-trip as Vietnam days', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const id = orderedStages(d)[1]!.id
    const next = ok(
      updateStage(
        d,
        id,
        {
          name: 'Ươm tạo chuyên sâu',
          summary: 'Mới',
          starts_on: '2026-10-02',
          ends_on: '2026-11-29',
        },
        now,
      ),
    )
    const edited = next.stages.find((s) => s.id === id)!
    expect(edited).toMatchObject({ position: 2, name: 'Ươm tạo chuyên sâu', summary: 'Mới' })
    expect([instantToDay(edited.starts_at), instantToDay(edited.ends_at)]).toEqual([
      '2026-10-02',
      '2026-11-29',
    ])
    expect(next.programme).toMatchObject({
      type: 'PROGRAMME',
      status: 'PUBLISHED',
      organization_id: d.programme.organization_id,
    })
  })

  it('removes and keeps positions contiguous (1,2,3 − 2 → 1,2)', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const next = ok(removeStage(d, orderedStages(d)[1]!.id, now))
    expect(names(next)).toEqual([
      [1, 'Mở đăng ký'],
      [2, 'Ngày trình diễn'],
    ])
  })

  it('moves up / down atomically; the first cannot go up, the last cannot go down', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const [first, second, third] = orderedStages(d)
    expect(names(ok(moveStage(d, second!.id, 'up', now)))).toEqual([
      [1, 'Ươm tạo'],
      [2, 'Mở đăng ký'],
      [3, 'Ngày trình diễn'],
    ])
    expect(names(ok(moveStage(d, second!.id, 'down', now)))).toEqual([
      [1, 'Mở đăng ký'],
      [2, 'Ngày trình diễn'],
      [3, 'Ươm tạo'],
    ])
    expect(moveStage(d, first!.id, 'up', now)).toEqual({ ok: false, reason: 'boundary' })
    expect(moveStage(d, third!.id, 'down', now)).toEqual({ ok: false, reason: 'boundary' })
  })

  it('an invalid or unknown edit changes nothing', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    const before = JSON.stringify(d)
    expect(addStage(d, { ...stage, name: '   ' }, { id: 'x', now })).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { name: 'required' },
    })
    expect(
      updateStage(
        d,
        orderedStages(d)[0]!.id,
        { ...stage, starts_on: '2026-12-01', ends_on: '2026-11-01' },
        now,
      ),
    ).toMatchObject({
      ok: false,
      errors: { dates: 'order' },
    })
    expect(updateStage(d, 'nope', stage, now)).toEqual({ ok: false, reason: 'not_found' })
    expect(removeStage(d, 'nope', now)).toEqual({ ok: false, reason: 'not_found' })
    expect(moveStage(d, 'nope', 'up', now)).toEqual({ ok: false, reason: 'not_found' })
    expect(JSON.stringify(d)).toBe(before)
    expect(validateStage({ ...stage, starts_on: '2026-02-30' })).toEqual({ dates: 'invalid' })
  })

  it('an empty list accepts a first stage at position 1', () => {
    const d = copy(DEMO_PROGRAMME_ID)
    d.stages = []
    expect(names(ok(addStage(d, stage, { id: 's1', now })))).toEqual([[1, 'Kết nối']])
  })
})

describe('WF04-S03 problem statements (CHALLENGE only)', () => {
  it('adds, edits and removes on a CHALLENGE', () => {
    const d = copy(DEMO_CHALLENGE_ID)
    const added = ok(addProblem(d, { title: '  Bài toán 3  ', summary: '' }, { id: 'p3', now }))
    expect(added.problem_statements!.map((p) => p.title)).toEqual([
      'Bài toán mẫu 1: tối ưu giao hàng chặng cuối',
      'Bài toán mẫu 2: số hoá hồ sơ khách hàng',
      'Bài toán 3',
    ])
    const edited = ok(updateProblem(added, 'p3', { title: 'Bài toán ba', summary: 'Mô tả' }, now))
    expect(edited.problem_statements!.at(-1)).toEqual({
      id: 'p3',
      title: 'Bài toán ba',
      summary: 'Mô tả',
    })
    const removed = ok(removeProblem(edited, d.problem_statements![0]!.id, now))
    expect(removed.problem_statements!.map((p) => p.id)).toEqual([
      d.problem_statements![1]!.id,
      'p3',
    ])
  })

  it('refuses a blank title and any problem edit on a PROGRAMME, changing nothing', () => {
    const c = copy(DEMO_CHALLENGE_ID)
    const before = JSON.stringify(c)
    expect(addProblem(c, { title: ' ', summary: 'x' }, { id: 'p', now })).toEqual({
      ok: false,
      reason: 'invalid',
      errors: { title: 'required' },
    })
    expect(updateProblem(c, 'nope', { title: 'x', summary: '' }, now)).toEqual({
      ok: false,
      reason: 'not_found',
    })
    expect(JSON.stringify(c)).toBe(before)
    const p = copy(DEMO_PROGRAMME_ID)
    expect(addProblem(p, { title: 'x', summary: '' }, { id: 'p', now })).toEqual({
      ok: false,
      reason: 'not_challenge',
    })
    expect(removeProblem(p, 'x', now)).toEqual({ ok: false, reason: 'not_challenge' })
    expect(p).not.toHaveProperty('problem_statements')
  })

  it('H5 is unchanged: stages are never required; a CHALLENGE needs one problem statement', () => {
    const p = copy(DEMO_PROGRAMME_ID)
    p.programme.status = 'DRAFT'
    p.stages = []
    expect(publishReadiness(p, 'ALL').every((c) => c.ok)).toBe(true)
    let c = copy(DEMO_CHALLENGE_ID)
    for (const pr of [...c.problem_statements!]) c = ok(removeProblem(c, pr.id, now))
    expect(
      publishReadiness(c, 'ALL')
        .filter((x) => !x.ok)
        .map((x) => x.item),
    ).toEqual(['problems'])
  })
})
