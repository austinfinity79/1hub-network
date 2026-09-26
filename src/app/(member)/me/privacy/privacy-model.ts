/**
 * WF02-S03 — pure presentation model for privacy & visibility (no data access).
 *
 * The current documents come from GET /legal/current and the account's
 * records from GET /me/consents. A document counts as accepted only when a
 * non-revoked record exists for the SAME type and the CURRENT version, the
 * rule WF01-S07 already applies client-side (DEC-WF01-S07-D1/D8); an older
 * acceptance stays in the history but never satisfies the current document.
 */

export type LegalType = 'TERMS_ACCEPTANCE' | 'PRIVACY_DATA_PROCESSING'
export type LegalDoc = { type: LegalType; version: string; title: string; content_url: string }
export type Consent = {
  id: string
  type: LegalType
  policy_version: string
  status: 'ACCEPTED' | 'REVOKED'
  accepted_at: string
  revoked_at: string | null
}

export const TYPE_LABELS: Record<LegalType, string> = {
  TERMS_ACCEPTANCE: 'Điều khoản sử dụng',
  PRIVACY_DATA_PROCESSING: 'Chính sách quyền riêng tư',
}

/** dd/mm/yyyy in the product timezone, independent of the browser's zone. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso))
}

export type DocStatus = { doc: LegalDoc; acceptedAt: string | null }

/** One entry per current document, with the live acceptance of that exact version. */
export function currentStatus(documents: LegalDoc[], consents: Consent[]): DocStatus[] {
  return documents.map((doc) => {
    const live = consents.find(
      (c) => c.type === doc.type && c.policy_version === doc.version && c.status === 'ACCEPTED',
    )
    return { doc, acceptedAt: live?.accepted_at ?? null }
  })
}

/** The documents still needing acceptance (re-acceptance after a new version). */
export function missingDocuments(status: DocStatus[]): LegalDoc[] {
  return status.filter((s) => s.acceptedAt === null).map((s) => s.doc)
}

export type HistoryRow = {
  id: string
  title: string
  detail: string
  state: 'CURRENT' | 'STALE' | 'REVOKED'
}

const STATE_LABEL: Record<HistoryRow['state'], string> = {
  CURRENT: 'phiên bản hiện hành',
  STALE: 'phiên bản cũ',
  REVOKED: 'đã rút lại',
}

/** Every record, in the server's order (newest first); nothing is dropped. */
export function historyRows(documents: LegalDoc[], consents: Consent[]): HistoryRow[] {
  return consents.map((c) => {
    const current = documents.some((d) => d.type === c.type && d.version === c.policy_version)
    const state = c.status === 'REVOKED' ? 'REVOKED' : current ? 'CURRENT' : 'STALE'
    return {
      id: c.id,
      title: TYPE_LABELS[c.type],
      detail: `Phiên bản ${c.policy_version} · đồng ý ${formatDate(c.accepted_at)} · ${STATE_LABEL[state]}`,
      state,
    }
  })
}
