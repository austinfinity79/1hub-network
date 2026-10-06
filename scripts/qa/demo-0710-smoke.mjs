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
 * (OUT_OF_SCOPE_POST_DEMO "Wording guard"), no internal id, e-mail address
 * or phone link, and the DEMO verified mark exactly where the fixture sets
 * it. Prints one JSON object; exits non-zero on any failure.
 */

const BASE = process.argv[2]?.replace(/\/$/, '')
const SYNC = process.argv.includes('--sync')
if (!BASE || !/^https?:\/\//.test(BASE)) {
  console.error('usage: node scripts/qa/demo-0710-smoke.mjs <base-url> [--sync]')
  process.exit(2)
}

const FOUNDER_UUID = 'de710000-0000-0000-0000-0000000000b1'
const BANNED = /đã xác minh|đã kết nối|đã theo dõi|đã gửi yêu cầu/i
const DEAD_LINK = /<a\b[^>]*\bhref="(#|javascript:[^"]*)?"/i
const VERIFIED = 'Đã xác thực danh tính qua 1Hub'

/**
 * [path, expected status, verified mark: true / false / null (not checked)].
 * Founder pages use the fixed handle of DEC-DEMO-SP1-D1; a profile UUID is 404.
 */
const BASE_ROUTES = [
  ['/', 200, null],
  ['/about', 200, null],
  ['/auth', 200, null],
]
const SYNC_ROUTES = [
  ['/products', 200, null],
  ['/products?q=AgriTrace', 200, null],
  ['/products/tracely', 200, null],
  ['/products/agritrace', 200, null],
  ['/products/kho-lanh-mien-tay', 200, null],
  ['/products/not-a-demo-startup', 404, null],
  ['/talents/dang-kim-chi', 200, true],
  ['/talents/ly-gia-bao', 200, true],
  ['/talents/vo-thanh-ha', 200, false],
  ['/talents/nguyen-minh-anh', 200, false],
  [`/talents/${FOUNDER_UUID}`, 404, null],
  ['/talents/pham-quoc-viet', 404, null],
  ['/talents/not-a-founder', 404, null],
]

const results = []
for (const [route, want, verified] of [...BASE_ROUTES, ...(SYNC ? SYNC_ROUTES : [])]) {
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
      // Public privacy: no internal id, e-mail address or phone link on any page.
      if (/de710000-/.test(html)) failures.push('internal demo id in the page')
      if (/[\w.+-]+@example\.test/.test(html)) failures.push('e-mail address in the page')
      if (/href="tel:/.test(html)) failures.push('phone link in the page')
      if (verified !== null && text.includes(VERIFIED) !== verified)
        failures.push(`verified mark ${verified ? 'missing' : 'shown'}`)
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
