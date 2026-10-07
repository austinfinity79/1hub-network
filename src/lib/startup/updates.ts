import { ApiError, notFound, unauthenticated } from '@/lib/api/errors'
import { writeAudit } from '@/lib/audit/audit'
import { query, withTransaction, type Executor } from '@/lib/db/client'

import { startupAccess, type StartupAccess, type Viewer } from './access'

/**
 * THAO-06 Updates v1 (DEC-THAO-SP-D3): manual plain-text posts.
 *
 * - Read: whoever may see the startup (listed, or the viewer's own team);
 *   deleted posts never.
 * - Write: owner / EDIT on a venture that is not archived. An editor may edit
 *   or delete any post of the venture; delete is soft.
 * - No author identity is returned (a person's name would need the
 *   PROFILE_DISCOVERY rules; the post speaks for the venture).
 * - No notification, trigger, import or AI. Audited with ids only.
 */

export const UPDATE_MAX = 2000

export type UpdateDTO = {
  id: string
  body: string
  published_at: string
  edited: boolean
}

export type UpdatesDTO = { can_edit: boolean; updates: UpdateDTO[] }

const invalid = (field: string, reason: string) =>
  new ApiError('UPDATE_VALIDATION_FAILED', 422, 'Update validation failed.', { [field]: reason })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function readUpdates(
  access: StartupAccess,
  exec: Executor = query,
): Promise<UpdatesDTO> {
  const rows = await exec<{ id: string; body: string; published_at: Date; edited: boolean }>(
    `SELECT id::text, body, published_at, (updated_at > created_at) AS edited
       FROM venture_updates
      WHERE venture_id = $1 AND deleted_at IS NULL
      ORDER BY published_at DESC, id DESC`,
    [access.ventureId],
  )
  return {
    can_edit: access.canEdit,
    updates: rows.map((r) => ({
      id: r.id,
      body: r.body,
      published_at: new Date(r.published_at).toISOString(),
      edited: r.edited,
    })),
  }
}

function parseBody(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    throw invalid('body', 'invalid')
  const b = body as Record<string, unknown>
  for (const key of Object.keys(b)) if (key !== 'body') throw invalid(key, 'not_accepted')
  if (typeof b.body !== 'string') throw invalid('body', 'required')
  // Plain text: kept as written (line breaks included), trimmed at the ends.
  const text = b.body.replace(/\r\n?/g, '\n').trim()
  if (!text) throw invalid('body', 'required')
  if (text.length > UPDATE_MAX) throw invalid('body', 'too_long')
  return text
}

async function editable(viewer: Viewer, slug: string, exec: Executor): Promise<StartupAccess> {
  if (!viewer.member || !viewer.accountId) throw unauthenticated()
  const access = await startupAccess(slug, viewer, exec, true)
  if (!access) throw notFound()
  if (access.role !== 'OWNER' && access.role !== 'EDIT')
    throw new ApiError('SCOPE_FORBIDDEN', 403, 'Only the owner and editors post updates.')
  if (access.archived)
    throw new ApiError('PROFILE_DEACTIVATED', 409, 'This venture is archived and read-only.')
  return access
}

async function ownPost(exec: Executor, access: StartupAccess, updateId: string) {
  if (!UUID.test(updateId)) throw notFound()
  const [row] = await exec<{ id: string }>(
    `SELECT id::text FROM venture_updates
      WHERE id = $1 AND venture_id = $2 AND deleted_at IS NULL FOR UPDATE`,
    [updateId, access.ventureId],
  )
  if (!row) throw notFound()
  return row
}

export async function postUpdate(
  viewer: Viewer,
  slug: string,
  body: unknown,
  requestId: string,
): Promise<UpdatesDTO> {
  const text = parseBody(body)
  return withTransaction(async (exec) => {
    const access = await editable(viewer, slug, exec)
    const [created] = await exec<{ id: string }>(
      `INSERT INTO venture_updates (venture_id, author_account_id, body)
       VALUES ($1, $2, $3) RETURNING id::text`,
      [access.ventureId, viewer.accountId, text],
    )
    await writeAudit(exec, {
      actorAccountId: viewer.accountId,
      action: 'VENTURE_UPDATE_POSTED',
      resourceType: 'project',
      resourceId: access.ventureId,
      after: { update_id: created!.id },
      requestId,
    })
    return readUpdates(access, exec)
  })
}

export async function editUpdate(
  viewer: Viewer,
  slug: string,
  updateId: string,
  body: unknown,
  requestId: string,
): Promise<UpdatesDTO> {
  const text = parseBody(body)
  return withTransaction(async (exec) => {
    const access = await editable(viewer, slug, exec)
    const post = await ownPost(exec, access, updateId)
    await exec(`UPDATE venture_updates SET body = $2, updated_at = now() WHERE id = $1`, [
      post.id,
      text,
    ])
    await writeAudit(exec, {
      actorAccountId: viewer.accountId,
      action: 'VENTURE_UPDATE_EDITED',
      resourceType: 'project',
      resourceId: access.ventureId,
      after: { update_id: post.id },
      requestId,
    })
    return readUpdates(access, exec)
  })
}

export async function deleteUpdate(
  viewer: Viewer,
  slug: string,
  updateId: string,
  requestId: string,
): Promise<UpdatesDTO> {
  return withTransaction(async (exec) => {
    const access = await editable(viewer, slug, exec)
    const post = await ownPost(exec, access, updateId)
    await exec(
      `UPDATE venture_updates SET deleted_at = now(), deleted_by_account_id = $2 WHERE id = $1`,
      [post.id, viewer.accountId],
    )
    await writeAudit(exec, {
      actorAccountId: viewer.accountId,
      action: 'VENTURE_UPDATE_DELETED',
      resourceType: 'project',
      resourceId: access.ventureId,
      after: { update_id: post.id },
      requestId,
    })
    return readUpdates(access, exec)
  })
}
