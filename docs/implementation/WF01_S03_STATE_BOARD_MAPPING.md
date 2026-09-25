# WF01 S03 State Board Mapping

State-to-reference mapping for **WF01-S03 Auth Callback** (`/auth/callback`, AUTH3, `reference_mode: state-board`). **FROZEN**: decisions DEC-WF01-S03-D1..D7 (plus D6a, ICON) are human-approved and implemented; see [DECISION_LOG.md](../decisions/DECISION_LOG.md). No crop, baseline, manifest or SOT change was made; crops are QA comparison regions only.

## Frozen business states

Sources:
- WF01 contract §screens: "success / expired / already-used callback states".
- WF01 §state rules: "must distinguish success, expired link and already-used/invalid link".
- Screen Contract: actions `activate_session`, `request_new_link`; next `WF01-S05`, `WF01-S04`.
- API 05 §4.1 consume: `AUTH_LINK_EXPIRED` / `AUTH_LINK_ALREADY_USED` / `AUTH_LINK_INVALID` / `AUTH_ACCOUNT_BLOCKED`.

| State | Trigger (implemented M0-T08) | Allowed action | Next route |
|---|---|---|---|
| S03-SUCCESS | consume `200` + session cookie | `activate_session` (automatic) | `onboarding.completed=false` → WF01-S05 `/onboarding/purpose`; completed → WF02-S01 `/me` (WF01 state rule) |
| S03-EXPIRED | `400 AUTH_LINK_EXPIRED` | `request_new_link` | stays on S03 |
| S03-USED | `409 AUTH_LINK_ALREADY_USED` | `request_new_link` | stays on S03 |
| S03-INVALID | `400 AUTH_LINK_INVALID` (unknown, malformed or missing token) | `request_new_link` | S03, or WF01-S04? See D3 |
| → S04 | `403 AUTH_ACCOUNT_BLOCKED`, 5xx, network | none on S03 | WF01-S04 `/auth/error` (Screen Contract `next`; WF01: S04 = blocked/error) |

Not frozen: a *processing* state while consume is in flight. There is no source state and no board panel for it (see D4).

## Visual board (1440×900 coordinates)

| Panel | Region x, y, w, h (incl. 1px border) | Visible content | Maps to | Class |
|---|---|---|---|---|
| Board title | 44, 48, 359, 23 | "AUTH3 · Kết quả bấm link trong mail" | board label | UNSUPPORTED_BY_CONTRACT (annotation, not UI) |
| P1 | 44, 92, 437, 764 | green ✓ disc, "Đăng nhập được", body, disabled grey "Đang chuyển…" | S03-SUCCESS | MAPPED |
| P2 | 502, 92, 437, 764 | ⏱ disc on primary-soft, "Link đã hết hạn", body, primary "Gửi link mới" | S03-EXPIRED | MAPPED |
| P3 | 959, 92, 437, 764 | ↻ disc, "Link đã dùng rồi", body, secondary "Gửi link mới" | S03-USED | MAPPED |
| P2 red border | 502, 92, 437, 764 | `#fc523c` 1px outline on P2 only | highlight or state style? | AMBIGUOUS |
| Body copy P1–P3 | y≈476–537 in each panel | reads as notes to developers ("Không coi đây là lỗi…, nút gửi lại phải ở ngay đây…", "Thường gặp khi…") | user copy? | AMBIGUOUS |

The content block inside each panel spans y 344–603: icon disc 344–408, title 430–453, body 476–537, button 559–603. Horizontal centres: P1 262, P2 720, P3 1177.

## Summary table

| State | Trigger | Board region | Mapping confidence | Action | QA approach |
|---|---|---|---|---|---|
| S03-SUCCESS | consume 200 | P1 | MAPPED (title, icon, button) | auto-redirect by `onboarding.completed` | Mint a token server-side (`requestMagicLink`), open the callback; hold the redirect (route interception) to capture; compare the P1 content crop |
| S03-EXPIRED | 400 EXPIRED | P2 | MAPPED; border AMBIGUOUS (D2) | `request_new_link` (D1) | Mint a token, set `expires_at` in the past, open; compare the P2 content crop |
| S03-USED | 409 ALREADY_USED | P3 | MAPPED | `request_new_link` (D1) | Mint a token, consume it once, reopen; compare the P3 content crop |
| S03-INVALID | 400 INVALID | none | AMBIGUOUS (D3) | per D3 | Random token; functional test only until D3 is decided |
| Processing | consume in flight | none | RESOLVED by D4 (not a state) | none | not pixel-tested |

Proposed comparison regions (a proposal only; nothing is cropped yet):
- **Content crops** (recommended), because the board's 764px card height is a board artifact:
  - P1: x 45–479, y 330–620
  - P2: x 503–937, y 330–620
  - P3: x 960–1394, y 330–620
- **Full-panel crops**: the panel rows above, if D5 decides the runtime card equals the board panel.
- **Method:** the implementation's state element is located via DOM and compared at the same size. The segment/text-mask method from WF01-S01/S02 applies.

## Approved decisions (frozen)

Each row is recorded in [DECISION_LOG.md](../decisions/DECISION_LOG.md) under `DEC-WF01-S03-Dn`, with its context and evidence. `Dn` elsewhere in this file means the same decision.

| ID | Decision | Implemented as |
|---|---|---|
| [DEC-WF01-S03-D1](../decisions/DECISION_LOG.md#dec-wf01-s03-d1) | EXPIRED / USED "Gửi link mới" navigates to `/auth` for a fresh request; never a resend from the spent token | `<Link href="/auth">`; Playwright asserts 0 resend calls |
| [DEC-WF01-S03-D2](../decisions/DECISION_LOG.md#dec-wf01-s03-d2) | P2 red outline is a designer annotation, not UI | not rendered; crops inset 1px so its anti-aliasing is excluded |
| [DEC-WF01-S03-D3](../decisions/DECISION_LOG.md#dec-wf01-s03-d3) | INVALID (and missing token, blocked, other failures) → `/auth/error` (WF01-S04), no reason passed | `router.replace('/auth/error')` |
| [DEC-WF01-S03-D4](../decisions/DECISION_LOG.md#dec-wf01-s03-d4) | Processing is transient, not an approved state | only a screen-reader `role=status`; no visual, no baseline |
| [DEC-WF01-S03-D5](../decisions/DECISION_LOG.md#dec-wf01-s03-d5) | Runtime renders ONE state in ONE centred `AuthCard` on the canvas; the board is evidence only | compared by panel crop, aligned on the icon disc |
| [DEC-WF01-S03-D6](../decisions/DECISION_LOG.md#dec-wf01-s03-d6) | Approved panel copy preserved verbatim | P2's "15 phút" comes from the frozen expiry constant |
| [DEC-WF01-S03-D7](../decisions/DECISION_LOG.md#dec-wf01-s03-d7) | Link format `/auth/callback?token=<opaque>` | read in the browser, stripped from the URL before consume; static page, `referrer: no-referrer` |

| DEC-WF01-S03-D6a | EXPIRED body's second sentence reworded (D1 wins over bitmap copy) | "Đây không phải lỗi của bạn — hãy quay lại nhập email để nhận link đăng nhập mới." |
| DEC-WF01-S03-ICON | INTENTIONAL-ICON-RENDERING: deterministic SVG icons, not OS emoji/glyphs | icon-disc pixel difference recorded as intentional |

Final comparison crops (board coordinates, 1px inside each panel border): P1 x46 y330 433×290, P2 x504 y330 433×290, P3 x961 y330 433×290.

## Related

- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records DEC-WF01-S03-D1…D7

- [p0-status.md](P0_STATUS.md) — overall P0 state
- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [wf01-s02-check-email.md](reports/WF01-S02_check-email.md) — previous screen
