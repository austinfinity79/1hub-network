import { ApiError, unauthenticated } from '@/lib/api/errors'
import { withApi } from '@/lib/api/handler'
import { readSessionToken } from '@/lib/auth/session-cookie'
import { resolveSession } from '@/lib/auth/sessions'
import { withTransaction } from '@/lib/db/client'
import {
  assetUrl,
  avatarMaxBytes,
  removeAsset,
  saveAvatarAsset,
  sniffAvatarType,
} from '@/lib/media/avatar-storage'

/**
 * POST /api/v1/me/profile/avatar — 05 §4.4. Maps WF01-S06 `upload_avatar`
 * (DEC-WF01-S06-D3).
 *
 * multipart/form-data with the image in the `file` part (the contract does not
 * name the part; recorded in the S06 report). The bytes are sniffed and
 * size-checked, stored privately under an opaque id, and only that id is saved
 * on the profile. Response `{ asset_id, url }`, where url is the
 * session-checked /media/assets/:id route, never a permanent public link.
 */
export const dynamic = 'force-dynamic'

const reject = (reason: string, message: string) =>
  new ApiError('PROFILE_VALIDATION_FAILED', 422, message, { file: reason })

export const POST = withApi(async ({ request }) => {
  const session = await resolveSession(readSessionToken(request.headers))
  if (!session) throw unauthenticated()

  const max = avatarMaxBytes()
  // Refuse an oversized body before buffering it; 64 KiB covers multipart framing.
  if (Number(request.headers.get('content-length')) > max + 64 * 1024) {
    throw reject('too_large', 'Image is too large.')
  }
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof Blob) || file.size === 0) throw reject('missing', 'No image received.')
  if (file.size > max) throw reject('too_large', 'Image is too large.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffAvatarType(bytes)
  if (!type) throw reject('unsupported_type', 'Unsupported image type.')

  const assetId = await saveAvatarAsset(session.accountId, bytes, type)
  let previous: string | null = null
  try {
    previous = await withTransaction(async (exec) => {
      const [row] = await exec<{ status: string; avatar_asset_id: string | null }>(
        `SELECT status::text AS status, avatar_asset_id FROM individual_profiles
          WHERE account_id = $1 FOR UPDATE`,
        [session.accountId],
      )
      if (row?.status === 'DEACTIVATED') {
        throw new ApiError('PROFILE_DEACTIVATED', 409, 'Profile is deactivated.')
      }
      await exec(
        `INSERT INTO individual_profiles (account_id, avatar_asset_id) VALUES ($1, $2)
         ON CONFLICT (account_id) DO UPDATE
           SET avatar_asset_id = EXCLUDED.avatar_asset_id, updated_at = now()`,
        [session.accountId, assetId],
      )
      return row?.avatar_asset_id ?? null
    })
  } catch (error) {
    await removeAsset(assetId)
    throw error
  }
  if (previous && previous !== assetId) await removeAsset(previous)
  return { asset_id: assetId, url: assetUrl(assetId) }
})
