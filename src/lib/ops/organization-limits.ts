/**
 * WF03-S06 — organization profile field limits (DEC-WF03-S06-D1), shared by the
 * server validation and the form so the client bundle never imports server code.
 */
export const ORGANIZATION_LIMITS = { name: 200, description: 2000 } as const
