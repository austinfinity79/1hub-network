import { afterEach, describe, expect, it } from 'vitest'

import { assetUrl, avatarMaxBytes, isAssetId, sniffAvatarType } from './avatar-storage'

/** WF01-S06 — avatar storage rules that need no disk or database (DEC-WF01-S06-D3). */

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]
const JPEG = [0xff, 0xd8, 0xff, 0xe0]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]

describe('avatar storage', () => {
  afterEach(() => {
    delete process.env.MEDIA_AVATAR_MAX_BYTES
  })

  it('recognises PNG, JPEG and WebP from the bytes alone', () => {
    expect(sniffAvatarType(new Uint8Array(PNG))).toBe('image/png')
    expect(sniffAvatarType(new Uint8Array(JPEG))).toBe('image/jpeg')
    expect(sniffAvatarType(new Uint8Array(WEBP))).toBe('image/webp')
  })

  it('refuses anything else, whatever the client claims', () => {
    for (const bytes of [
      [0x47, 0x49, 0x46, 0x38], // GIF
      [0x3c, 0x73, 0x76, 0x67], // <svg
      [0x25, 0x50, 0x44, 0x46], // %PDF
      [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x56, 0x49, 0x20], // RIFF AVI
      [],
    ]) {
      expect(sniffAvatarType(new Uint8Array(bytes))).toBeNull()
    }
  })

  it('defaults to a 2 MiB provisional limit, overridable by configuration', () => {
    expect(avatarMaxBytes()).toBe(2 * 1024 * 1024)
    process.env.MEDIA_AVATAR_MAX_BYTES = '1000'
    expect(avatarMaxBytes()).toBe(1000)
    process.env.MEDIA_AVATAR_MAX_BYTES = 'nonsense'
    expect(avatarMaxBytes()).toBe(2 * 1024 * 1024)
  })

  it('ids are opaque and the URL is derived, never a storage path', () => {
    expect(isAssetId('asset_0123456789abcdef0123456789abcdef')).toBe(true)
    for (const bad of ['asset_demo_member_avatar', '../etc/passwd', 'asset_XYZ', 42, null]) {
      expect(isAssetId(bad)).toBe(false)
    }
    expect(assetUrl('asset_0123456789abcdef0123456789abcdef')).toBe(
      '/media/assets/asset_0123456789abcdef0123456789abcdef',
    )
  })
})
