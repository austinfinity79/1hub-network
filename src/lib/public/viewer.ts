import { resolveSession } from '@/lib/auth/sessions'
import { query } from '@/lib/db/client'
import { landingEntry } from '@/lib/landing/entry'
import { assetUrl, isAssetId, readAssetMeta } from '@/lib/media/avatar-storage'

/**
 * DEMO-HOME-ABOUT-01 — who is looking at a public page, for the shared public
 * header only (DEMO-D5).
 *
 * A guest gets the sign-in and sign-up entry. A signed-in account gets its own
 * entry point ("Việc của tôi" → the ONE onboarding resolver's route, exactly as
 * the homepage entry CTA, DEC-P0-LANDING-D1), its initials and its own avatar. No role, scope, count or ops shortcut is read. There is no member
 * notification source in Sprint 1 (DEC-S1I-D7), so the bell carries no count.
 */

export type PublicViewer =
  | { kind: 'GUEST'; entry: '/auth' }
  | {
      kind: 'MEMBER'
      entry: string
      onboarded: boolean
      /** Initials only: the display name itself never reaches the page payload. */
      initials: string
      avatarUrl: string | null
    }

/** Up to two initials of a display name: first and last word ("Lê Thảo" → "LT"). */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0]!.charAt(0)
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : ''
  return (first + last).toLocaleUpperCase('vi')
}

export async function publicViewer(sessionToken: string | undefined): Promise<PublicViewer> {
  const entry = await landingEntry(sessionToken)
  if (entry.kind === 'GUEST') return { kind: 'GUEST', entry: '/auth' }
  const session = await resolveSession(sessionToken)
  const [row] = session
    ? await query<{ display_name: string | null; avatar_asset_id: string | null }>(
        'SELECT display_name, avatar_asset_id FROM individual_profiles WHERE account_id = $1',
        [session.accountId],
      )
    : []
  const displayName = row?.display_name?.trim() ?? ''
  let avatarUrl: string | null = null
  const assetId = row?.avatar_asset_id
  // A stale id (e.g. seeded demo data) must not render a broken image.
  if (session && isAssetId(assetId)) {
    const meta = await readAssetMeta(assetId)
    if (meta?.owner_account_id === session.accountId) avatarUrl = assetUrl(assetId)
  }
  return {
    kind: 'MEMBER',
    entry: entry.href,
    onboarded: entry.onboarded,
    initials: initialsOf(displayName),
    avatarUrl,
  }
}
