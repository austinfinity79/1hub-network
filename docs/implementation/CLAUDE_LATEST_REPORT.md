# Claude Task Report

## 1. Task
- Task ID / name: WF01-S02 — Check Email (`/auth/check-email`)
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S03 not started.

## 2. Pre-flight
- Single writer: PASS. Start HEAD `4a158e3`, re-checked before commit: unchanged. `AGENTS.md` untouched.
- WF01-S01 green at start. Reference `WF01-S02__check-email__1440x900.png` is `strict` 1440×900 and was measured before coding.

## 3. Contract vs bitmap decisions
| Bitmap shows | Contract / API | Implemented | Class |
|---|---|---|---|
| "Mở Gmail" dark full-width button | S02 actions are `resend`, `change_email` only | not rendered | INTENTIONAL-BUSINESS-CONTRACT, reference region 760,370 → 480×70 |
| Full address `chi.dang@tracely.vn` | 202 returns `email_masked` only | masked address (`c***@tracely.vn`) | INTENTIONAL-BUSINESS-CONTRACT, text only |
| "Gửi lại sau 0:45" | 202 returns `resend_after_seconds` (60) | countdown from the server value; nothing invented | conforms |
| (direct entry is not specified) | no SOT rule | `replace('/auth')` when no pending request | ambiguity; resolved by the task's preferred option |

## 4. What was built
| File | Role |
|---|---|
| `src/app/(auth)/auth/check-email/page.tsx`, `check-email-card.tsx`, `check-email.module.css` | Reads the S01 handoff and shows the masked address. The countdown is gated by `resend_after_seconds`. Resend calls `POST /auth/magic-link/resend {auth_request_id}`, stores the rotated request id and restarts the countdown. "Đổi email khác" is a `<Link>` to `/auth` |
| `src/components/shell/auth-card.*` | **Shared auth-shell component (new).** Card surface geometry: 440px wide, 14px radius, 36px padding, shadow |
| `tests/visual/pixel-qa/capture.ts` | `runScreenQa` gains optional `beforeNavigate` / `afterLoad` state hooks (test infrastructure) |
| `tests/visual/specs/wf01-s02-check-email.spec.ts` | 13 functional tests + 1 pixel test |

State transfer: the S01 `sessionStorage` handoff is reused unchanged. It holds the 4 contract DTO fields, with no token and no raw address. On refresh the state is kept; the countdown restarts from the server's value, which never allows an earlier resend.

Idempotency: resend is not one of the contract's seven `Idempotency-Key` operations, so no key is sent. Duplicates are prevented by the in-flight guard and the cooldown, and the server retires the superseded request id.

## 5. Shared UI gate
| Item | Result |
|---|---|
| Shared primitive changed | NONE. Button, TextInput, Notice, Surface and tokens are untouched |
| Shared shell component | NEW `AuthCard`, with two-reference evidence: S01 and S02 measure identical card geometry (card top-left corner curve, 36px padding, shadow falloff). It is component-local to the auth shell, not a global token |
| S01 refactor | S01 now uses `AuthCard`; its control overrides moved inside the card. S01 capture is **byte-identical** (0 differing bytes) and its pixel verdict is unchanged |
| Global tokens added | **0** |
| Screen-local values | tile 56px / 14px radius (fill = frozen `--hub-primary-soft`), divider 2px at burgundy 8%, help panel 8px radius, eyebrow 10px, tip pitch 22px / gap 8px, all spacing. Accent `#b91610` for bullets and the link: sampled, not derivable from the anchors, kept screen-local. It occurs in 22/24 references, so it is a candidate for later promotion |
| Archivo | not used. S02 has no hero display pattern |

## 6. Functional QA (Playwright, real API)
| Item | Result |
|---|---|
| Route / S01→S02 | PASS. A real S01 submit lands on S02 |
| Email masking | PASS. `n***@example.test`; the raw address is absent from the DOM |
| Token / enumeration | PASS. No token in the DOM or storage; a known and an unknown address render identical screens |
| Countdown | PASS. `1:00` → `0:45` → enabled `Gửi lại link`, driven by the fixed clock |
| Resend | PASS. Posts the current `auth_request_id`, gets 202, rotates the stored id and restarts the countdown; announced with `role=status` |
| Duplicate prevention | PASS. Busy with `aria-busy`; a forced second click sends no request |
| Failure / 429 / 409 stale | PASS. Each shows its own `role=alert` message and the button stays usable |
| Change email | PASS. Returns to `/auth` |
| Invalid direct entry | PASS. Replaced by `/auth` |
| Accessibility | PASS. `h1`; resend is a `<button>`, change-email an `<a>`; Tab order and visible focus verified; the tips panel is a labelled `<section>` with an `<h2>` and `<ul>`. No "Gmail" text; exactly one button |
| Console | 0 errors |

## 7. Pixel QA
- **Runner:** `runScreenQa` at 1440×900, DPR1, vi-VN, fonts ready. State: a real 202 DTO and a clock pinned to T0+15s ("0:45").
- **Images:**
  - REFERENCE: `design-reference/final/WF01/WF01-S02__check-email__1440x900.png`
  - ACTUAL: `tests/visual/actual/pixel-qa/WF01-S02.viewport.png`
  - DIFF: `…/WF01-S02.viewport.diff.png` and `…/WF01-S02.segments.diff.png`
- **Full frame:** DIFFERENT 3.28%. Expected: the Gmail omission shifts the card ±33px, and the font migration changes every glyph.
- **Typography:** DOM contract PASS (18 text elements, 0 violations).
- **Segments, outside text** (threshold 0.2%):

| Segment | dy | Outside-text diff |
|---|---|---|
| Brand panel | 0 | 0 px |
| Canvas left / right | 0 | 0 px |
| Card upper (tile, title, lede, address) | +33 | 14 px (0.012%) |
| Card lower (divider → change-email link, card edge) | −33 | 3 px |

- **Classification:**
  - Structural 0; Major Visual 0; Component 0. The envelope icon strokes were refitted, cutting the icon diff from 28 to 14px.
  - Raster Noise: 17px. The icon anti-aliases differently from the bitmap's OS emoji glyph.
  - Intentional: Gmail button and masked address (business-contract); every glyph (typography migration).
- **Pixel verdict: PASS.**

## 8. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck / `verify` | PASS |
| Unit | 109 / 109 |
| DB integration | 121 / 121 |
| Build | PASS |
| S01 regression | 12 / 12. Pixel segments 0/0/0/0/1, unchanged |
| S02 Playwright | 14 / 14 |
| Full Playwright | 138 / 138, plus 24 screen runs skipped by design |
| `design-reference/**` | hash unchanged |

## 9. Notes for review
1. **"Mở Gmail" omitted.** It is not a contract action, following the S01 Google precedent. If approved, it could be added as a plain external link; say so and it is a small change.
2. **Invented copy.** Resend-success, stale, rate-limit and failure messages, and the enabled label "Gửi lại link", are minimal copy pending design review.
3. **No server-side resend cooldown.** The countdown is client-side UX. Server rate limiting remains the recorded pre-UAT deferral.
4. **Direct-entry redirect.** Redirect to `/auth` was chosen because no SOT rule exists.
5. **S01 flake.** One cold-start timeout was seen on the first S01 test right after a rebuild. It passed on rerun and did not recur in the full run.

## 10. Git
- Branch `main`; start HEAD `4a158e3`
- Implementation commit: `8906aa5` feat(wf01-s02): check email screen with server-timed resend
- Report/final commit: the commit containing this report
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `2390ce2`
- Working tree: clean after commit except the untracked `AGENTS.md`

## 11. Recommended next task
WF01-S03 — Auth Callback States. Note the known G1 state-board Pixel QA gap for its reference.

## Related
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
- [reports/WF01-S01_auth-entry.md](reports/WF01-S01_auth-entry.md) — WF01-S01 report
