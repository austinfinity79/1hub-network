/**
 * DEMO-QA-PREP-B — read-only HTTP smoke of the 07/10 demo journey
 * (docs/demo-0710/qa/DEMO_SMOKE_CHECKLIST.md). GET requests only: no login,
 * no form, no database access, so it is safe against any target, including
 * a deployed demo server.
 *
 * Usage:
 *   node scripts/qa/demo-0710-smoke.mjs <base-url> [--sync]
 *   node scripts/qa/demo-0710-smoke.mjs http://localhost:3995
 *   node scripts/qa/demo-0710-smoke.mjs https://<demo-host> --sync
 *
 * Without --sync only the base routes (Home, About) are checked; --sync adds
 * the DIR2 / SP1-FOUNDER routes once DEMO-QA-B-SYNC has the accepted
 * candidate. Per page: the expected status, no 5xx, no empty / "#" /
 * javascript: link, none of the banned success wordings
 * (OUT_OF_SCOPE_POST_DEMO "Wording guard"), and no demo UUID on listing
 * pages. Prints one JSON object; exits non-zero on any failure.
 */

const BASE = process.argv[2]?.replace(/\/$/, '')
const SYNC = process.argv.includes('--sync')
if (!BASE || !/^https?:\/\//.test(BASE)) {
  console.error('usage: node scripts/qa/demo-0710-smoke.mjs <base-url> [--sync]')
  process.exit(2)
}

const FOUNDER = 'de710000-0000-0000-0000-0000000000b1'
const BANNED = /đã xác minh|đã kết nối|đã theo dõi|đã gửi yêu cầu/i
const DEAD_LINK = /<a\b[^>]*\bhref="(#|javascript:[^"]*)?"/i

/** [path, expected status, listing page (no demo UUID allowed)] */
const BASE_ROUTES = [
  ['/', 200, true],
  ['/about', 200, true],
  ['/auth', 200, false],
]
const SYNC_ROUTES = [
  ['/products', 200, true],
  ['/products/tracely', 200, false],
  ['/products/not-a-demo-startup', 404, false],
  [`/talents/${FOUNDER}`, 200, false],
  ['/talents/00000000-0000-0000-0000-000000000000', 404, false],
]

const results = []
for (const [route, want, listing] of [...BASE_ROUTES, ...(SYNC ? SYNC_ROUTES : [])]) {
  const failures = []
  let status = 0
  try {
    const res = await fetch(BASE + route, { redirect: 'manual' })
    status = res.status
    if (status !== want) failures.push(`status ${status}, want ${want}`)
    if (status === 200) {
      const html = await res.text()
      if (DEAD_LINK.test(html)) failures.push('empty, "#" or javascript: link')
      const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ')
      if (BANNED.test(text)) failures.push('banned success wording')
      if (listing && /de710000-/.test(html)) failures.push('demo id in a listing page')
    }
  } catch (error) {
    failures.push(`request failed: ${error.message}`)
  }
  results.push({ route, status, ok: failures.length === 0, failures })
}

const failed = results.filter((r) => !r.ok)
console.log(
  JSON.stringify(
    { base: BASE, sync: SYNC, checked: results.length, failed: failed.length, results },
    null,
    2,
  ),
)
process.exit(failed.length === 0 ? 0 : 1)
