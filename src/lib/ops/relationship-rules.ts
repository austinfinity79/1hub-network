/**
 * WF03-S08 — frozen relationship rules (DEC-WF03-S08-RELATIONSHIP-CONTRACT),
 * shared by the server and the form so the client bundle never imports server code.
 *
 * Valid PARENT pairs follow the Design SOT (ADM21, BR-FS03-09), which is narrower
 * than the task's list: HUB → CLB is not valid.
 */
export const ALLOWED_PARENT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['HUB', 'CHAPTER'],
  ['CHAPTER', 'CLB'],
]

export const RELATIONSHIP_LIMITS = { reason: 500 } as const
