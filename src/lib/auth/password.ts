import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto'

import { isValidPasswordFormat } from './password-rules'

export { isValidPasswordFormat }

/**
 * S1-UAT-01 — password storage and format (task section 5: "Use the
 * repo-approved secure password hashing mechanism"; Sprint1 UAT pack Appendix
 * B "Mật khẩu").
 *
 * No hashing library is in package.json (no bcrypt, no argon2), and this repo
 * already trusts node:crypto for every other secret (tokens.ts: random tokens,
 * SHA-256, timingSafeEqual). scrypt is the one OWASP-recommended KDF node:crypto
 * ships natively: adding bcrypt/argon2 would be the first native-addon
 * dependency in a repo that otherwise has none. Parameters follow the Node
 * docs' and OWASP's scrypt guidance (N=16384, r=8, p=1, 64-byte key) and a
 * random 16-byte salt per password, stored alongside the hash so no separate
 * salt column or migration is needed.
 *
 * NEVER: store plaintext, log a password, return a hash, or expose a reset
 * token (task section 5) — nothing in this module ever logs its inputs.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}

const SALT_BYTES = 16
const KEY_LENGTH = 64
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 } as const

/** Encoded as `scrypt:N:r:p:saltHex:hashHex`, self-describing for a future parameter change. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS)
  const { N, r, p } = SCRYPT_PARAMS
  return `scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${derived.toString('hex')}`
}

/** Constant-time verification; a malformed or foreign-format hash never throws, only fails. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts
  const N = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false

  const salt = Buffer.from(saltHex!, 'hex')
  const expected = Buffer.from(hashHex!, 'hex')
  if (salt.length === 0 || expected.length === 0) return false

  const derived = await scrypt(password, salt, expected.length, { N, r, p })
  return derived.length === expected.length && timingSafeEqual(derived, expected)
}
