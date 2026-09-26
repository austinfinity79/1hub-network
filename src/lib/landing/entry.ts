import { SESSION_COOKIE_NAME } from '@/lib/auth/config'
import { resolveSession } from '@/lib/auth/sessions'
import { query } from '@/lib/db/client'
import { getCurrentDocuments } from '@/lib/legal/legal'
import { getOnboardingState, routeFor } from '@/lib/onboarding/state'

/**
 * P0-LANDING — the only data the public homepage reads (DEC-P0-LANDING-D1..D3).
 *
 * - The visitor's own entry point: a guest goes to /auth; a signed-in account
 *   goes wherever the ONE onboarding resolver sends it (the first incomplete
 *   WF01 step, or /me). No role, scope or ops shortcut is read or shown.
 * - The public network entry: the slug of a PUBLISHED HUB, whose WF03-S09 page
 *   exists; nothing when there is none (no dead link).
 * - The current legal documents' public URLs for the footer.
 * No member, count or private data.
 */

export type LandingEntry =
  { kind: 'GUEST'; href: '/auth' } | { kind: 'MEMBER'; href: string; onboarded: boolean }

export async function landingEntry(sessionToken: string | undefined): Promise<LandingEntry> {
  const session = await resolveSession(sessionToken)
  if (!session) return { kind: 'GUEST', href: '/auth' }
  const state = await getOnboardingState(session.accountId)
  return { kind: 'MEMBER', href: routeFor(state), onboarded: state.completed }
}

export async function publicHubSlug(): Promise<string | null> {
  const [hub] = await query<{ slug: string }>(
    `SELECT slug FROM organizations WHERE type = 'HUB' AND status = 'PUBLISHED'
      ORDER BY created_at, slug LIMIT 1`,
  )
  return hub?.slug ?? null
}

export async function legalLinks(): Promise<Array<{ href: string; label: string }>> {
  const docs = await getCurrentDocuments()
  return docs.map((d) => ({ href: d.content_url, label: d.title }))
}

export { SESSION_COOKIE_NAME }
