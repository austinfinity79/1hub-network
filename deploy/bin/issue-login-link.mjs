// Operator-only: issue ONE magic link through the app's own requestMagicLink,
// inside the running app container. No HTTP endpoint, no product code change.
// The raw token goes to stdout only; the database keeps only its hash, and the
// app's normal single-use + 15-minute expiry apply unchanged.
import { register } from 'node:module'

const hooks = `
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
const isFile = (p) => existsSync(p) && statSync(p).isFile()
export async function resolve(spec, ctx, next) {
  let url = null
  if (spec.startsWith('@/')) url = pathToFileURL('/app/src/' + spec.slice(2)).href
  else if (spec.startsWith('./') || spec.startsWith('../')) url = new URL(spec, ctx.parentURL).href
  if (url) {
    const p = fileURLToPath(url)
    for (const c of [p, p + '.ts', p + '.tsx', p + '/index.ts']) if (isFile(c)) return next(pathToFileURL(c).href, ctx)
  }
  return next(spec, ctx)
}`
register('data:text/javascript,' + encodeURIComponent(hooks))

const email = process.env.LOGIN_EMAIL
const base = process.env.LOGIN_BASE_URL
if (!email || !base) {
  process.stderr.write('LOGIN_EMAIL and LOGIN_BASE_URL are required\n')
  process.exit(2)
}
const { requestMagicLink } = await import('/app/src/lib/auth/magic-link.ts')
const { token, response } = await requestMagicLink(email, null)
process.stdout.write(`${base}/auth/callback?token=${encodeURIComponent(token)}\n`)
process.stderr.write(`for ${response.email_masked}; single use; expires in ${response.expires_in_seconds}s\n`)
process.exit(0)
