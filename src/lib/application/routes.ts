/**
 * TASK 24.4 (DEC-L5-D4) — the L5 member routes. The application of one venture
 * to one programme lives under the venture; the entry, which may create the
 * venture first (SUB0), lives under the programme.
 */

const seg = encodeURIComponent

export const applicationRoutes = {
  /** Entry: SUB0 without an eligible venture, a choice with several, else the form. */
  apply: (programmeId: string) => `/programmes/${seg(programmeId)}/apply`,
  /** SUB1; `step` 1–4 selects the drawn step (`?buoc=`). */
  form: (ventureId: string, programmeId: string, step?: number) =>
    `/projects/${seg(ventureId)}/applications/${seg(programmeId)}${step ? `?buoc=${step}` : ''}`,
  /** SUB2. */
  review: (ventureId: string, programmeId: string) =>
    `/projects/${seg(ventureId)}/applications/${seg(programmeId)}/review`,
  /** SUB3, read-only from the snapshot. */
  submitted: (ventureId: string, programmeId: string) =>
    `/projects/${seg(ventureId)}/applications/${seg(programmeId)}/submitted`,
} as const
