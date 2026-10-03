/**
 * TASK 24.4 (DEC-L5-D4) — the L5 member routes. The application of one venture
 * to one programme lives under the venture; the entry, which may create the
 * venture first (SUB0), lives under the programme.
 */

const seg = encodeURIComponent

/**
 * Where a form journey started, so "Huỷ và quay lại" returns there (WF05
 * contract, navigation row; WF05-PROD-04, G24): the S01 list (the apply entry
 * led straight to the form) or the apply entry's choice. Absent: the
 * venture's S02, where its "Đăng ký" / "Tiếp tục" links start.
 */
export type ApplicationOrigin = 'list' | 'choose'

const ORIGIN_PARAM: Record<ApplicationOrigin, string> = { list: 'ds', choose: 'chon' }

/** The origin named by `?tu=`, or null. */
export function applicationOrigin(value: string | undefined): ApplicationOrigin | null {
  const found = Object.entries(ORIGIN_PARAM).find(([, v]) => v === value)
  return found ? (found[0] as ApplicationOrigin) : null
}

export const applicationRoutes = {
  /** Entry: SUB0 without an eligible venture, a choice with several, else the form. */
  apply: (programmeId: string) => `/programmes/${seg(programmeId)}/apply`,
  /** SUB1; `step` 1–4 selects the drawn step (`?buoc=`), `from` the origin (`?tu=`). */
  form: (
    ventureId: string,
    programmeId: string,
    step?: number,
    from?: ApplicationOrigin | null,
  ) => {
    const query = [step ? `buoc=${step}` : '', from ? `tu=${ORIGIN_PARAM[from]}` : '']
      .filter(Boolean)
      .join('&')
    return `/projects/${seg(ventureId)}/applications/${seg(programmeId)}${query ? `?${query}` : ''}`
  },
  /** SUB2. */
  review: (ventureId: string, programmeId: string) =>
    `/projects/${seg(ventureId)}/applications/${seg(programmeId)}/review`,
  /** SUB3, read-only from the snapshot. */
  submitted: (ventureId: string, programmeId: string) =>
    `/projects/${seg(ventureId)}/applications/${seg(programmeId)}/submitted`,
} as const
