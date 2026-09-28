// Operator-only: pre-provision Internal Alpha login accounts (invite-only
// magic link, DEC-AUTH-EMAIL-D1) through the app's own modules, inside the
// running app container. Creates exactly what the callback creates for a new
// address: one ACTIVE user_accounts row plus its account_created event, in one
// transaction. No profile, role, membership, leadership or project; onboarding
// stays incomplete. Idempotent: an existing address is left untouched.
// Prints masked addresses only; never a token, a credential or a full address.
import { register } from 'node:module'

const root = process.env.APP_ROOT ?? '/app'
const hooks = `
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
const isFile = (p) => existsSync(p) && statSync(p).isFile()
export async function resolve(spec, ctx, next) {
  let url = null
  if (spec.startsWith('@/')) url = pathToFileURL(${JSON.stringify(root)} + '/src/' + spec.slice(2)).href
  else if (spec.startsWith('./') || spec.startsWith('../')) url = new URL(spec, ctx.parentURL).href
  if (url) {
    const p = fileURLToPath(url)
    for (const c of [p, p + '.ts', p + '.tsx', p + '/index.ts']) if (isFile(c)) return next(pathToFileURL(c).href, ctx)
  }
  return next(spec, ctx)
}`
register('data:text/javascript,' + encodeURIComponent(hooks))

const emails = (process.env.PROVISION_EMAILS ?? '').split(',').filter((e) => e.trim())
if (emails.length === 0) {
  process.stderr.write('PROVISION_EMAILS is required (comma-separated)\n')
  process.exit(2)
}
const { normalizeEmail, isPlausibleEmail } = await import(`${root}/src/lib/auth/email.ts`)
const { withTransaction, closePool } = await import(`${root}/src/lib/db/client.ts`)
const { trackEvent } = await import(`${root}/src/lib/analytics/analytics.ts`)
const mask = (e) => e.replace(/^(.)[^@]*(@.*)$/, '$1***$2')

let failed = 0
for (const raw of emails) {
  const email = normalizeEmail(raw)
  if (!isPlausibleEmail(email)) {
    process.stdout.write(`REFUSED ${mask(email)} (not a plausible address)\n`)
    failed++
    continue
  }
  const result = await withTransaction(async (exec) => {
    const [created] = await exec(
      `INSERT INTO user_accounts (email, email_normalized, status)
       VALUES ($1, $1, 'ACTIVE')
       ON CONFLICT (email_normalized) DO NOTHING
       RETURNING id::text`,
      [email],
    )
    if (created) {
      // Same event and fields as the callback's account creation (API 05 §10).
      await trackEvent(exec, {
        name: 'account_created',
        accountId: created.id,
        profileId: null,
        workflow: 'WF01',
        screenId: 'WF01-S03',
      })
      return { action: 'CREATED', status: 'ACTIVE' }
    }
    const [existing] = await exec(`SELECT status::text FROM user_accounts WHERE email_normalized = $1`, [email])
    return { action: 'ALREADY EXISTS', status: existing.status }
  })
  process.stdout.write(`${result.action} ${mask(email)} status=${result.status}\n`)
}
await closePool()
process.exit(failed ? 1 : 0)
