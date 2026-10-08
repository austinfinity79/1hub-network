import { cookies } from 'next/headers'

import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { getCurrentDocuments, type LegalType } from '@/lib/legal/legal'

import { loadAboutNetwork } from './about-network'
import { publicViewer, type PublicViewer } from './viewer'

/**
 * DEMO-HOME-ABOUT-01 — the data every new public page needs for its shell: the
 * viewer (header) and the current legal documents (footer "Điều khoản ·
 * Quyền riêng tư", the short labels of DM01 / DM02). A legal type without a
 * current document renders no link.
 */

export type LegalLink = { href: string; label: string }

const SHORT_LABEL: Record<LegalType, string> = {
  TERMS_ACCEPTANCE: 'Điều khoản',
  PRIVACY_DATA_PROCESSING: 'Quyền riêng tư',
}

/**
 * S2-NAV-DROPDOWN-V2-01: `clubCount` is the canonical CLB total of the HUB
 * catalogue (the About figure, loadAboutNetwork) for the menu's "Hơn {n} CLB";
 * null when it cannot be read (the description is then left out).
 */
export type PublicShellData = { viewer: PublicViewer; legal: LegalLink[]; clubCount: number | null }

export async function publicShellData(): Promise<PublicShellData> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const [viewer, docs, clubCount] = await Promise.all([
    publicViewer(token),
    getCurrentDocuments(),
    loadAboutNetwork()
      .then((n) => n.clubCount)
      .catch(() => null),
  ])
  const legal = (['TERMS_ACCEPTANCE', 'PRIVACY_DATA_PROCESSING'] as const).flatMap((type) => {
    const doc = docs.find((d) => d.type === type)
    return doc ? [{ href: doc.content_url, label: SHORT_LABEL[type] }] : []
  })
  return { viewer, legal, clubCount }
}
