import { redirect } from 'next/navigation'

import { WorkspaceShell } from '@/components/shell/workspace-shell'
import { isApiError } from '@/lib/api/errors'
import { requireMember } from '@/lib/member/guard'
import { previewInviteLink, type InvitePreview } from '@/lib/venture/invite-link'

import { InviteJoin } from './invite-join'

/**
 * US-02.12 — `/moi/{slug}-{code}`, the receiver of an invite link (S1-UAT-07,
 * DEC-S1I). Guest → /auth?redirect=<this path> and back after sign-in (and
 * onboarding first for a new account); the page then shows only what the link
 * offers — the team's name, "Thành viên", "Xem" — with "Tham gia". Opening the
 * page joins nothing. An owner or member goes straight to the team. Every
 * unusable link (unknown, expired, regenerated, venture closed) shows the same
 * "Lời mời không còn hiệu lực", which names no team.
 */
export const dynamic = 'force-dynamic'

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const member = await requireMember(`/moi/${encodeURIComponent(code)}`)

  let preview: InvitePreview | null = null
  try {
    preview = await previewInviteLink(member.accountId, code)
  } catch (error) {
    const unusable =
      isApiError(error) && ['INVITE_LINK_INVALID', 'INVITE_LINK_UNAVAILABLE'].includes(error.code)
    if (!unusable) throw error
  }
  if (preview?.membership) redirect(`/projects/${preview.membership.venture_id}/team`)

  return (
    <WorkspaceShell active="projects" member={member}>
      <InviteJoin
        code={code}
        offer={preview ? { venture: preview.venture, expires_at: preview.expires_at } : null}
      />
    </WorkspaceShell>
  )
}
