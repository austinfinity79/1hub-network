/**
 * WF03-S07 — Event field rules (DEC-WF03-S07-EVENT-LIFECYCLE E4, DEC-WF03-S07-D1),
 * shared by the server and the form so the client bundle never imports server code.
 */
export const EVENT_LIMITS = { name: 200, summary: 2000, location: 200 } as const

/** The only accepted `timezone` value; it is the display zone and is not stored. */
export const EVENT_TIMEZONE = 'Asia/Ho_Chi_Minh'
