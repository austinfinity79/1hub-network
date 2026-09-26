import { describe, expect, it, vi } from 'vitest'

import { EVENT_TIMEZONE } from '@/lib/ops/event-rules'

import {
  DEMO_CHALLENGE_ID,
  DEMO_OWNER_ORGANIZATION_ID,
  DEMO_PROGRAMME_ID,
  DEMO_PROGRAMMES,
  demoFixture,
  isDemoFixtureId,
} from './fixtures'
import {
  APPLICANT_TYPES,
  APPLICATION_STATUSES,
  PROGRAMME_DEMO_STATUSES,
  PROGRAMME_TYPES,
} from './types'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

describe('WF04-T00 demo fixture', () => {
  it('is exactly one PROGRAMME and one CHALLENGE, in a fixed order', () => {
    expect(DEMO_PROGRAMMES.map((d) => [d.programme.id, d.programme.type])).toEqual([
      [DEMO_PROGRAMME_ID, 'PROGRAMME'],
      [DEMO_CHALLENGE_ID, 'CHALLENGE'],
    ])
  })

  it('is deterministic: the same values on every load, and frozen', async () => {
    vi.resetModules()
    const again = await import('./fixtures')
    expect(again.DEMO_PROGRAMMES).not.toBe(DEMO_PROGRAMMES)
    expect(JSON.stringify(again.DEMO_PROGRAMMES)).toBe(JSON.stringify(DEMO_PROGRAMMES))
    expect(Object.isFrozen(DEMO_PROGRAMMES[0]!.programme)).toBe(true)
    expect(Object.isFrozen(DEMO_PROGRAMMES[1]!.stages[0])).toBe(true)
    expect(() => {
      ;(DEMO_PROGRAMMES[0]!.programme as { name: string }).name = 'x'
    }).toThrow()
  })

  it('uses canonical values only: type, demo lifecycle, applicant types, application statuses', () => {
    for (const d of DEMO_PROGRAMMES) {
      expect(PROGRAMME_TYPES).toContain(d.programme.type)
      expect(PROGRAMME_DEMO_STATUSES).toContain(d.programme.status)
      expect(d.programme.organization_id).toBe(DEMO_OWNER_ORGANIZATION_ID)
      for (const t of d.registration.applicant_types) expect(APPLICANT_TYPES).toContain(t)
      for (const s of Object.keys(d.application_counts)) expect(APPLICATION_STATUSES).toContain(s)
      for (const m of d.team) expect(m.role_label).toBe('PROGRAMME_ORGANIZER')
    }
  })

  it('links every event to its programme (programme_id set) inside the owning organization', () => {
    for (const d of DEMO_PROGRAMMES) {
      expect(d.events.length).toBeGreaterThan(0)
      for (const e of d.events) {
        expect(e.programme_id).toBe(d.programme.id)
        expect(e.organization_id).toBe(d.programme.organization_id)
        expect(Date.parse(e.ends_at!)).toBeGreaterThanOrEqual(Date.parse(e.starts_at!))
      }
    }
    expect(EVENT_TIMEZONE).toBe('Asia/Ho_Chi_Minh')
  })

  it('keeps stages ordered and problem statements on the CHALLENGE only', () => {
    for (const d of DEMO_PROGRAMMES) {
      expect(d.stages.map((s) => s.position)).toEqual(d.stages.map((_, i) => i + 1))
      if (d.programme.type === 'CHALLENGE') expect(d.problem_statements!.length).toBeGreaterThan(0)
      else expect(d.problem_statements).toBeUndefined()
    }
  })

  it('has unique, reserved-range ids and no contact data', () => {
    const ids = DEMO_PROGRAMMES.flatMap((d) => [
      d.programme.id,
      ...d.stages.map((s) => s.id),
      ...(d.problem_statements ?? []).map((p) => p.id),
      ...d.events.map((e) => e.id),
      ...d.team.map((m) => m.id),
    ])
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(id).toMatch(UUID)
      expect(isDemoFixtureId(id)).toBe(true)
    }
    const text = JSON.stringify(DEMO_PROGRAMMES)
    expect(text).not.toMatch(/@|\+84|\b0\d{9}\b|token|cookie|password/i)
    expect(text).not.toMatch(/Viettel|MB Bank|Lộc Trời/)
  })

  it('finds fixtures by id only', () => {
    expect(demoFixture(DEMO_CHALLENGE_ID)?.programme.name).toBe('Thử thách đổi mới (demo)')
    expect(demoFixture('60000000-0000-0000-0000-000000000001')).toBeUndefined()
    expect(isDemoFixtureId('60000000-0000-0000-0000-000000000001')).toBe(false)
  })
})
