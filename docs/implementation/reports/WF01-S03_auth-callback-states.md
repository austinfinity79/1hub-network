# Claude Task Report

## 1. Task
- Task ID / name: WF01-S03-STATE-BOARD-FREEZE + WF01-S03 — Auth Callback States (`/auth/callback`)
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed. WF01-S04 not started.

## 2. Freeze
D1–D7 are recorded as approved in [WF01_S03_STATE_BOARD_MAPPING.md](WF01_S03_STATE_BOARD_MAPPING.md). The final crops are inset 1px inside each panel border so the D2 annotation's anti-aliasing is excluded.

## 3. States
| State | Behaviour | Result |
|---|---|---|
| SUCCESS | consume 200 → one session → `/onboarding/purpose` (incomplete) or `/me` (complete); the success panel shows while navigating | PASS |
| EXPIRED | 400 → no session; `?status=expired`; "Gửi link mới" → `/auth` | PASS |
| USED | 409 → no second session; `?status=used`; "Gửi link mới" → `/auth` | PASS |
| INVALID → S04 | invalid or missing token, blocked account, other failure → `/auth/error`, no reason passed | PASS (functional only) |

## 4. Security
| Item | Evidence |
|---|---|
| Single use | Server SQL claim (M0-T08). A USED revisit creates 0 sessions |
| Concurrent consume | Two browser contexts on one link: exactly one lands on onboarding, the other on USED, with +1 session. Also the M0 DB test of 8 concurrent consumes |
| Raw token leakage | Only the email-click document request carries it. Not in fetch, RSC or asset requests; not in storage, DOM or HTML; no Referer. **Found and fixed:** a dynamic render embedded the request URL, token included, in the inline RSC payload. The callback page is now **static** (`○`) and reads the query only in the browser |
| URL cleanup | `history.replaceState` runs before the consume request. No later URL or history entry contains the token, and Back does not restore it |
| Session creation | Only on SUCCESS: EXPIRED and USED leave the session count unchanged |
| Resend from a spent token | never; asserted with 0 calls to `/resend` |

Nothing in auth writes audit or analytics payloads, so the token cannot reach them.

## 5. Pixel QA (per-state panel crop, 1440×900 DPR1, vi-VN, fonts ready)
Method:
- The runtime card is compared to its own board panel only (433×290 content crop), aligned on the icon disc.
- Excluded annotations: the board title, P2's red outline and the other panels.
- Text boxes are masked; only the pill *labels* are masked, so pill fill and corners are compared.

| State | Outside-text diff | Classification |
|---|---|---|
| SUCCESS | 71 px (0.057%) | icon glyph (SVG vs board ✓ glyph) |
| EXPIRED | 247 px (0.197%) | 173 px icon: the board's ⏱ is a multicolour OS emoji approximated by an SVG. ~74 px pill edge anti-aliasing |
| USED | 97 px (0.077%) | icon glyph (SVG ↻ vs board glyph) |

- **Typography:** DOM contract PASS for all three states.
- **Classification:**
  - Structural 0; Major Visual 0; Component 0 unresolved. The icons were refitted to the board's glyph geometry; the remainder is emoji/glyph raster style.
  - Raster Noise: pill anti-aliasing.
  - Intentional Annotation: board title and P2 outline.
  - Intentional Typography Migration: all glyphs.
- **Pixel verdict: PASS.** EXPIRED sits close to the 0.2% gate because its icon is an OS emoji. If exact icon fidelity is wanted, design should supply icon assets.

## 6. Shared UI
| Item | Result |
|---|---|
| Shared primitives changed | NONE |
| AuthCard | reused unchanged (D5) |
| Global tokens added | 0 |
| Screen-local values | disc 64px; success disc/check green `#e8f0e6` / `#2a3b24` (sampled, not anchor-derived); muted pill fill (burgundy 6%); pill widths 126/148px from the board (static labels); title, body and pill spacing |

Test infrastructure (not product):
- `runScreenQa` gains `query`, `name` and `waitUntil` hooks.
- Segments gain `dx`.
- The WF01-S03 dry-run gap is cleared by the approved mapping: 14 screens ready, 10 gaps.
- `eslint.config.mjs` ignores the gitignored Playwright output directories, which previously made `pnpm lint` fail whenever a report existed.

## 7. Validation
| Gate | Result |
|---|---|
| Format / Lint / Typecheck / `verify` | PASS |
| Unit | 110 / 110 |
| DB integration | 121 / 121 |
| Build | PASS (`/auth/callback` static) |
| S01 regression | PASS; segments 0/0/0/0/1, unchanged |
| S02 regression | PASS; segments 0/0/0/14/3, unchanged |
| S03 Playwright | 15 / 15 |
| Full Playwright | 153 / 153, plus 24 screen runs skipped by design |
| `design-reference/**` | hash unchanged |

## 8. Notes for review
1. **P2 copy contradicts D1.** The approved copy says "nút gửi lại phải ở ngay đây, không bắt quay lại trang đăng nhập", but D1 sends the user to `/auth`. The copy is kept verbatim per D6; design may want to reword it.
2. **SUCCESS panel is transient.** It is visible only while navigating, and its pixel capture holds the destination request open.
3. **S04 must choose its own error presentation.** `/auth/error` receives no reason by design.

## 9. Git
- Branch `main`; start HEAD `d225636`
- Implementation commit: `676ebc6` feat(wf01-s03): auth callback states on a static, token-safe page
- Report/final commit: the commit containing this report
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `e1a458b`
- Working tree: clean after commit except the untracked `AGENTS.md`

## Decision traceability (added by WF01-S03-FINALIZE)
- D1–D7 in this report are recorded as **DEC-WF01-S03-D1 … DEC-WF01-S03-D7** in [DECISION_LOG.md](../../decisions/DECISION_LOG.md).
- The EXPIRED copy conflict (note 1) is resolved by **DEC-WF01-S03-D6a**.
- The icon deviation is recorded as **DEC-WF01-S03-ICON** (INTENTIONAL-ICON-RENDERING).

## Related
- [WF01_S03_STATE_BOARD_MAPPING.md](WF01_S03_STATE_BOARD_MAPPING.md) — frozen mapping
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
