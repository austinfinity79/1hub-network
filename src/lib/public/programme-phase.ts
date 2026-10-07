/**
 * THAO-05 DIR0 — the presentation phase and type of a public programme
 * (DEC-THAO-DIR-D1). Pure and client-safe; the phase is derived for display
 * and never written back to the canonical lifecycle (DEC-W4P-D11).
 */

/** `sap-cong-bo`: the content pack's own status, as written (PROGRAMME-PRESENTATION-DATA-01). */
export type ProgrammePhase = 'dang-mo' | 'sap-toi' | 'sap-cong-bo' | 'da-ket-thuc'

export const PHASES: ReadonlyArray<{ key: ProgrammePhase; label: string }> = [
  { key: 'dang-mo', label: 'Đang mở' },
  { key: 'sap-toi', label: 'Sắp tới' },
  { key: 'da-ket-thuc', label: 'Đã kết thúc' },
  { key: 'sap-cong-bo', label: 'Sắp công bố' },
]

export type ProgrammeKind = 'challenge' | 'programme'

export const KINDS: ReadonlyArray<{ key: ProgrammeKind; label: string }> = [
  { key: 'challenge', label: 'Challenge' },
  { key: 'programme', label: 'Programme' },
]

export function phaseOf(
  status: 'PUBLISHED' | 'CLOSED',
  startsAt: Date | null,
  endsAt: Date | null,
  now: Date,
): ProgrammePhase {
  if (status === 'CLOSED') return 'da-ket-thuc'
  if (endsAt && endsAt.getTime() < now.getTime()) return 'da-ket-thuc'
  if (startsAt && startsAt.getTime() > now.getTime()) return 'sap-toi'
  return 'dang-mo'
}
