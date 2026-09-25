# WF01 S03 State Board Mapping

State-to-reference mapping for **WF01-S03 Auth Callback** (`/auth/callback`, AUTH3, `reference_mode: state-board`). This is a proposal for human approval. No crop, baseline, manifest or SOT change has been made.

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
| Processing | consume in flight | none | HUMAN DESIGN DECISION (D4) | none | functional test only |

Proposed comparison regions (a proposal only; nothing is cropped yet):
- **Content crops** (recommended), because the board's 764px card height is a board artifact:
  - P1: x 45–479, y 330–620
  - P2: x 503–937, y 330–620
  - P3: x 960–1394, y 330–620
- **Full-panel crops**: the panel rows above, if D5 decides the runtime card equals the board panel.
- **Method:** the implementation's state element is located via DOM and compared at the same size. The segment/text-mask method from WF01-S01/S02 applies.

## Decisions required before implementation

| ID | Decision | Why it blocks |
|---|---|---|
| D1 | **How `request_new_link` works from the callback.** P2 copy says resend must happen in place, without returning to login. The only contract endpoint is `resend {auth_request_id}`, but the callback holds just the token. The request id exists only if the link is opened in the same browser tab session that stored the S01 handoff. Resend of a *used* request returns `409` (M0-T08). Options: (a) resend in place when the S02 handoff is present, otherwise go to `/auth`; (b) add a token-based resend endpoint, which is an API contract change | behaviour + contract |
| D2 | Is P2's red border UI (an error-state card style) or board emphasis? | component styling |
| D3 | Does `AUTH_LINK_INVALID` render the P3 "used" state (WF01 groups "already-used/invalid") or go to WF01-S04? | state routing |
| D4 | What renders while consume is in flight (no frozen state)? e.g. an empty canvas, or a neutral disc + title | first paint |
| D5 | **Runtime page composition.** The board shows three 437×764 cards on canvas with no brand panel and no single-state layout. For one state at 1440×900: a single board-size card centred on the canvas, or the auth split layout with `AuthCard`? | layout, and whether full-panel or content crops apply |
| D6 | Body copy for P1–P3 reads as design annotation. Ship it verbatim, or supply user-facing copy? | copy |
| D7 | Email link URL format (e.g. `/auth/callback?token=…`) is unstated. `return_to` names the path only | callback input |

## Related

- [p0-status.md](P0_STATUS.md) — overall P0 state
- [claude-latest-report.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [wf01-s02-check-email.md](reports/WF01-S02_check-email.md) — previous screen
