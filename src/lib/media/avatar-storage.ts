import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * WF01-S06 — the smallest P0 media store for avatars (DEC-WF01-S06-D3).
 *
 * An upload gets an opaque id (`asset_<32 hex>`), its bytes go to a private
 * directory configured by MEDIA_STORAGE_DIR, and a sidecar JSON records the
 * owner and content type. The profile stores only the id; bytes are served by
 * /media/assets/:id after session checks, so no permanent public URL is ever
 * canonical data (05:376). No table is needed: the id is the file name.
 *
 * Limits are TECHNICAL CONFIGURATION, provisional and overridable by env; they
 * are not business policy. The type is sniffed from the bytes, never taken
 * from the client's Content-Type.
 */

export const AVATAR_TYPES = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff],
  // RIFF....WEBP, checked in sniff() at both offsets.
  'image/webp': [0x52, 0x49, 0x46, 0x46],
} as const

export type AvatarContentType = keyof typeof AVATAR_TYPES

/** Provisional technical limit: 2 MiB unless MEDIA_AVATAR_MAX_BYTES overrides it. */
export function avatarMaxBytes(): number {
  const configured = Number(process.env.MEDIA_AVATAR_MAX_BYTES)
  return Number.isInteger(configured) && configured > 0 ? configured : 2 * 1024 * 1024
}

export function storageDir(): string {
  return path.resolve(process.cwd(), process.env.MEDIA_STORAGE_DIR ?? '.data/media')
}

const ASSET_ID = /^asset_[0-9a-f]{32}$/

export function isAssetId(value: unknown): value is string {
  return typeof value === 'string' && ASSET_ID.test(value)
}

export function assetUrl(assetId: string): string {
  return `/media/assets/${assetId}`
}

export function sniffAvatarType(bytes: Uint8Array): AvatarContentType | null {
  const starts = (sig: readonly number[], at = 0) => sig.every((b, i) => bytes[at + i] === b)
  if (starts(AVATAR_TYPES['image/png'])) return 'image/png'
  if (starts(AVATAR_TYPES['image/jpeg'])) return 'image/jpeg'
  if (starts(AVATAR_TYPES['image/webp']) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp'
  return null
}

export type AssetMeta = {
  owner_account_id: string
  content_type: AvatarContentType
  byte_size: number
  created_at: string
}

const bytesPath = (id: string) => path.join(storageDir(), id)
const metaPath = (id: string) => path.join(storageDir(), `${id}.json`)

export async function saveAvatarAsset(
  ownerAccountId: string,
  bytes: Uint8Array,
  contentType: AvatarContentType,
): Promise<string> {
  const id = `asset_${randomBytes(16).toString('hex')}`
  const meta: AssetMeta = {
    owner_account_id: ownerAccountId,
    content_type: contentType,
    byte_size: bytes.byteLength,
    created_at: new Date().toISOString(),
  }
  await mkdir(storageDir(), { recursive: true })
  await writeFile(bytesPath(id), bytes, { flag: 'wx' })
  await writeFile(metaPath(id), JSON.stringify(meta), { flag: 'wx' })
  return id
}

export async function readAssetMeta(id: string): Promise<AssetMeta | null> {
  if (!isAssetId(id)) return null
  try {
    return JSON.parse(await readFile(metaPath(id), 'utf8')) as AssetMeta
  } catch {
    return null
  }
}

export async function readAsset(id: string): Promise<{ meta: AssetMeta; bytes: Buffer } | null> {
  const meta = await readAssetMeta(id)
  if (!meta) return null
  try {
    return { meta, bytes: await readFile(bytesPath(id)) }
  } catch {
    return null
  }
}

/** A valid avatar: the id is well formed, stored, and owned by the account. */
export async function isValidAvatar(id: string | null, ownerAccountId: string): Promise<boolean> {
  if (!id) return false
  const meta = await readAssetMeta(id)
  if (!meta || meta.owner_account_id !== ownerAccountId) return false
  return stat(bytesPath(id)).then(
    (s) => s.isFile(),
    () => false,
  )
}

/** Best-effort removal of a replaced avatar; a leftover file is harmless. */
export async function removeAsset(id: string): Promise<void> {
  if (!isAssetId(id)) return
  await Promise.all([rm(bytesPath(id), { force: true }), rm(metaPath(id), { force: true })])
}
