# Claude Task Report

## 1. Task
- Task ID / name: WF01-S01 — Auth Entry (`/auth`)
- Scope requested: Implement the first production screen against its strict approved reference, with functional QA, Playwright, the manifest-driven pixel gate and full regression.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S02 not started.

## 2. Pre-flight
- Single writer: PASS. Start HEAD `31c353b`, re-checked before commit: unchanged.
- Approved decision 1: `AGENTS.md` added to `.prettierignore`.
  - `AGENTS.md` itself was not modified, deleted or committed; its mtime is still 04:17.
  - `pnpm format:check` and `pnpm verify` PASS.
- Approved decision 2: provider UI follows the runtime contract, not the bitmap.
- Reference `WF01-S01__auth-entry__1440x900.png` is `strict`, 1440×900. It was inspected and measured before coding.

## 3. Provider state
| Item | Result |
|---|---|
| `GET /api/v1/auth/providers` | `{"providers":[]}`, asserted |
| Google CTA / divider rendered | NO. Asserted: no "Google", no "hoặc dùng email", exactly one button |
| Deviation recorded | INTENTIONAL-BUSINESS-CONFIG. Reference region 760,285 → 480×110. Card height changes by 104px; the card stays vertically centred (above the region +52px, below it −52px) |

## 4. What was built
| File | Role |
|---|---|
| `src/app/(auth)/auth/page.tsx`, `auth-entry-form.tsx`, `auth-entry.module.css` | The screen. The form posts `{email, return_to}` with an `Idempotency-Key` (required by contract for `auth.magic-link.request`). On 202 it stores the 202 DTO and navigates to `/auth/check-email` |
| `src/components/shell/auth-split-layout.*` | Brand panel plus content column. Shared because WF01-S02's approved reference shows the identical panel |
| `src/lib/auth/email.ts` | Email rule extracted from `tokens.ts` so browser and server apply the same check; `tokens.ts` re-exports it |
| `src/lib/auth/pending-request.ts` | S01→S02 handoff: the 4-field 202 DTO in `sessionStorage`. No token and no raw address; the address arrives already masked by the server |
| `tests/visual/pixel-qa/segments.ts` | Segment comparison: aligned regions, with the diff split into inside text vs outside text |
| `tests/visual/specs/wf01-s01-auth-entry.spec.ts` | 11 functional tests + 1 pixel test |

Shared changes, each backed by baseline evidence:
- **Token settling.** `design-tokens.ts` assigned radius, shadow, control and surface spacing to WF01-S01. All were measured from the reference in px/16 = rem.
  - radius: control 8px, surface 14px; card padding 36px;
  - button height 47px, input height 49px, label → field gap 5px;
  - notice padding 12.5/13px;
  - hairlines, fills and muted text as `color-mix()` of the frozen anchors.
  - These stay `--unresolved-*`, because no SOT froze them. The manifest records each measured value.
- **On-accent colour.** `--color-fg-on-accent` changed from surface (white) to burgundy. Evidence: all 16 references with a red CTA use a dark label, and burgundy on `#FC523C` passes WCAG AA while white does not. Hover flips the label to surface so it stays legible on the burgundy hover fill.
- **Notice radius.** Notices now use the control radius (measured ~8px), not the card radius.
- **Button.** New `fullWidth` prop.
- **TextInput.** Typed `ref` prop (React 19).
- **Auth group layout.** The `(auth)` layout no longer imposes `PageContainer`. The S02–S04 placeholders now wrap themselves, so their render is unchanged.

## 5. Functional QA (Playwright, real API)
| Item | Result |
|---|---|
| `/auth` | PASS. Implemented screen, no placeholder |
| Email validation | PASS. Empty and invalid inputs show an inline `role=alert` error, set `aria-invalid`, wire `aria-describedby`, return focus to the field and send 0 requests |
| Magic-link request | PASS. Contract body and a UUID `Idempotency-Key` |
| 202 | PASS |
| Navigate to S02 | PASS. `/auth/check-email`; stored state = 4 DTO keys, masked address only |
| Anti-enumeration | PASS. A known and an unknown address get identical status and body shape |
| Duplicate submit | PASS. While pending: disabled and `aria-busy`; a forced click plus Enter still sends 1 request |
| API failure | PASS. Announced; the form re-enables, keeps the value, and a retry succeeds |
| Rate limit | PASS. `AUTH_RATE_LIMITED` shows its own message |
| Keyboard / accessibility | PASS. Tab order goes field → button, focus outline is visible, Enter submits; semantic `<form>`/`<label>`/`<button>` |
| Console | PASS. 0 errors in every test |

## 6. Pixel QA
- **Manifest runner:** `runScreenQa` (M0-T11) ran at 1440×900, DPR1, vi-VN, fonts ready, reduced motion.
- **Images:**
  - REFERENCE: `design-reference/final/WF01/WF01-S01__auth-entry__1440x900.png`
  - ACTUAL: `tests/visual/actual/pixel-qa/WF01-S01.viewport.png`
  - DIFF: `…/WF01-S01.viewport.diff.png` and `…/WF01-S01.segments.diff.png`
- **Full frame:** DIFFERENT, 4.68%. This is expected: the provider omission shifts the card, and the font migration changes every glyph.
- **Typography:** DOM contract PASS, 14 text elements, 0 violations. Be Vietnam Pro 400/500/600; Archivo 700 only for the display headline (the frozen `display` 34/44 step); no fallback.
- **Segment comparison** (strict outside text; threshold 0.2%):

| Segment | dy | Outside-text diff |
|---|---|---|
| Brand panel (gradient, wordmark, pitch, footnote) | 0 | **0 px** |
| Canvas left / right | 0 | **0 px** |
| Card upper (title, lede) | +52 | **0 px** |
| Card lower (label → legal, card edge, shadow) | −52 | **1 px (0.001%)** |

- **Line structure** asserted separately: headline 3 lines, pitch note 2, footnotes 1 each, title 1. This check was added after a wrong wrap passed the text mask; see §9.
- **Classification:**
  - Structural: 0.
  - Major Visual: 0.
  - Component: 0. The notice envelope icon was redrawn to the reference's light-body/dark-fold shape.
  - Raster noise: 1 px.
  - Intentional Business Config: the provider block.
  - Intentional Typography Migration: every glyph. This includes the lede and legal lines wrapping at a different word because Be Vietnam Pro is wider than the pre-freeze raster font.
- **Pixel verdict: PASS.**

## 7. M0 regression exposed and fixed
- **Defect:** the M0-T05 API client imported `node:crypto` via `request-id.ts`, so the first browser consumer failed to build.
- **Fix:** `globalThis.crypto.randomUUID()`, available in Node 22 and browsers.
- **Guard:** a new unit test walks `client.ts`'s import graph and fails on any `node:` import.

Harness updates (test-owned, intentional):
- The M0-T04 "leaves cosmetic values unset" test now asserts the settled values.
- `tests/visual/baseline/primitives.png` was regenerated; I inspected the capture first. The shell and typography harness baselines are unchanged.
- The `shell-routes` spec treats implemented screens as no longer placeholders.

## 8. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck | PASS (`pnpm verify` PASS) |
| Unit | 109 / 109 (+11 auth-entry, +3 segments, +1 browser safety) |
| DB integration | 121 / 121 |
| Build | PASS |
| WF01-S01 Playwright | 12 / 12 |
| Full Playwright | 124 / 124, plus 24 screen runs skipped by design |
| `design-reference/**` | 67 files, hash unchanged |

## 9. Notes for review
1. **Error copy not in the reference.** Empty, invalid, failure and rate-limit messages are minimal Vietnamese copy written for this screen, pending design copy review.
2. **Static brand-panel figures.** "12 bài toán…, 1,4 tỷ…" is approved copy rendered as-is; the Screen Contract has `reads: []`. Confirm before go-live that static figures are intended.
3. **Unlinked legal names.** Terms and privacy are named as plain text. No `/legal` route is frozen, and consent capture belongs to WF01-S07.
4. **Gate lesson.** A wrong line wrap on the pitch note passed the segment gate because the text mask absorbs it. I caught it by eye, fixed it with explicit breaks, and added line-count assertions.
5. **Display font judgment.** The headline uses Archivo 700 because it is the only 34px step in the frozen scale. The Design SOT does not name this headline explicitly as an approved display use.
6. **One-off gradient colour.** The brand gradient's middle stop `#58040b` is the one value not derivable from the anchors. It is a baseline-sampled, screen-local shade (Design SOT §2.5).

## 10. Git
- Branch: `main`
- Start HEAD: `31c353b`
- Implementation commit: `fecc9d4` feat(wf01-s01): auth entry screen on the email magic-link path
- Report/final commit: the commit containing this report
- Remote: `origin` → `austinfinity79/1hub-network`
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `2390ce2`, deliberately behind local
- Working tree: clean after commit except the untracked `AGENTS.md`, preserved and deliberately not committed

## 11. Recommended next task
WF01-S02 — Check Email (consumes the pending-request handoff; resend via `POST /auth/magic-link/resend`).

## Related
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
- [M0_FOUNDATION_COMPLETION_REPORT.md](M0_FOUNDATION_COMPLETION_REPORT.md) — M0 audit
