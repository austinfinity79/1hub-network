# WF01 S04 State Board Mapping

State-to-reference mapping for **WF01-S04 Auth Errors** (`/auth/error`, AUTH4, `reference_mode: state-board`). **FROZEN**: decisions [DEC-WF01-S04-D1..D8](../decisions/DECISION_LOG.md#dec-wf01-s04-d1) are approved and implemented. No crop, baseline, manifest or SOT change was made.

## Frozen business states

Sources:
- WF01 §screens: S04 = "blocked/error recovery states", entered "only on exception paths".
- Screen Contract: reads `AuthErrorState`, writes none; actions `retry`, `contact_support`, `relogin`; next WF01-S01, WF01-S02.
- API 05: 401 means "unauthenticated / expired session"; auth codes include `AUTH_ACCOUNT_BLOCKED` and `AUTH_RATE_LIMITED`.
- [DEC-WF01-S03-D3](../decisions/DECISION_LOG.md#dec-wf01-s03-d3): invalid/missing token and other callback failures come here, with no reason passed.

| State | Trigger (source) | User-visible meaning | Action | Next | Reason exposable? |
|---|---|---|---|---|---|
| S04-BLOCKED | consume `403 AUTH_ACCOUNT_BLOCKED` (M0-T08) | this account cannot sign in | `contact_support` | stays | Yes, but only to the token holder: the code is reached after proving inbox access. Never at the S01 request step, which stays anti-enumerating |
| S04-SESSION-EXPIRED | 401 on an authenticated route or API (contract status table) | sign in again | `relogin` → WF01-S01 | `/auth` | Yes. It says nothing about account existence |
| S04-LINK-INVALID / GENERIC | DEC-WF01-S03-D3 routes (invalid or missing token, 5xx, network) | the sign-in could not complete | `retry` → WF01-S01 | `/auth` | No: one collapsed message, no internal reason |
| (RATE-LIMITED) | `429 AUTH_RATE_LIMITED` on magic-link request/resend | too many requests | `retry` later | — | Only as "too many attempts"; already shown inline on WF01-S01/S02. Whether S04 also owns it is D-S04-3 |

## Visual board (1440×900)

Rows share: a "!" disc on primary-soft, title, body, a "Vì sao viết thế này: …" line and an outline action on the right. Each row is 1351×126 at x 44, with row tops y 92 / 234 / 376 / 518.

| Board element | Region x, y, w, h | Visible title · action | Maps to | Class |
|---|---|---|---|---|
| Board title "AUTH4 · Lỗi & chặn" | 44, 48, 187, 23 | — | board label | ANNOTATION |
| "Vì sao viết thế này: …" line in each row | x 121, row-top+86, h 13 | designer rationale | — | ANNOTATION (×4) |
| R1 | 44, 92, 1351, 126 | "Gửi quá nhiều lần" · "Thử đăng nhập Google" | RATE-LIMITED | AMBIGUOUS: its numbers (5 links / 10 min, wait 15 min) are unfrozen policy, server rate limiting is a recorded pre-UAT deferral, and the Google action contradicts `providers: []` (S01 decision) |
| R2 | 44, 234, 1351, 126 | "Tài khoản đang bị khoá" · "Liên hệ hotro@1hub.network" | S04-BLOCKED | MAPPED. Body "…trong mail HUB gửi ngày 20/09" needs a date no data source provides (D-S04-4) |
| R3 | 44, 376, 1351, 126 | "Phiên đăng nhập đã hết" · "Đăng nhập lại" | S04-SESSION-EXPIRED | MAPPED. "30 ngày" is the provisional session TTL (pre-UAT), taken from config, not hard-coded |
| R4 | 44, 518, 1351, 126 | "Email không nhận được thư từ hệ thống" · "Dùng email khác" | domain blocks our mail | UNSUPPORTED_BY_CONTRACT: no email provider and no bounce signal exist (recorded deployment deferral), so nothing can detect it |
| — | none | — | S04-LINK-INVALID / GENERIC | no panel: DESIGN DECISION (D-S04-2) |

Counts: frozen/real states 3 (plus RATE-LIMITED, ambiguous) · visual panels 4 · mapped 2 · ambiguous 1 · unsupported 1 · annotations 5 (title + 4 rationale lines).

## Runtime states and QA (implemented)

| State | Trigger | Presentation | Pixel QA |
|---|---|---|---|
| BLOCKED | `?reason=blocked`; S03 routes `AUTH_ACCOUNT_BLOCKED` here ([D1](../decisions/DECISION_LOG.md#dec-wf01-s04-d1)) | R2 meaning, no date ([D4](../decisions/DECISION_LOG.md#dec-wf01-s04-d4)), generic support copy ([D5](../decisions/DECISION_LOG.md#dec-wf01-s04-d5)) | disc component vs R2 disc (x61 y251 46×46): 1 px outside text |
| SESSION_EXPIRED | `?reason=session_expired` ([D8](../decisions/DECISION_LOG.md#dec-wf01-s04-d8)) | R3, lifetime from config, "Đăng nhập lại" → `/auth` | disc vs R3 disc (x61 y393 46×46): 1 px; action vs R3 button (x1240 y394 138×51): 3 px |
| GENERIC | no, unknown or `generic` reason; invalid callback ([D2](../decisions/DECISION_LOG.md#dec-wf01-s04-d2)) | shared centred AuthCard, neutral copy | DESIGN-GAP-GENERIC: typography and geometry only; manual PO review |
| — | rate limit | inline on S01/S02 ([D3](../decisions/DECISION_LOG.md#dec-wf01-s04-d3)) | not an S04 state |
| — | mail blocked by domain | out of P0 ([D7](../decisions/DECISION_LOG.md#dec-wf01-s04-d7)) | not implemented |

Composition ([D6](../decisions/DECISION_LOG.md#dec-wf01-s04-d6)): the board's horizontal rows become one centred AuthCard, so whole-row crops cannot apply. The approved **components** (disc, outline action) are compared at their own positions. Titles and bodies are text-masked and checked by the DOM typography contract. Their **colour** is not covered by either check, so it was verified against the board ink by hand (body `#170002`).

## Security check

- **Account existence:** S04-BLOCKED is reachable only after a valid token was consumed, so it reveals nothing to a non-owner. S01/S02 keep a single anti-enumerating response.
- **Internal reason:** invalid, missing, unknown and 5xx failures collapse into one message. No DB/auth detail, stack or request id in copy.
- **Raw token:** S04 never receives it (DEC-WF01-S03-D7 strips it on S03).
- **Provider linkage:** do not render the R1 Google action while `providers: []`.
- **Membership/profile status:** no row references them.
- **Transport:** S03 currently passes no reason (D3). BLOCKED needs a safe, non-secret carrier (D-S04-1).

## Decision resolution

| Proposal | Resolved by |
|---|---|
| D-S04-1 state transport | [DEC-WF01-S04-D1](../decisions/DECISION_LOG.md#dec-wf01-s04-d1) |
| D-S04-2 generic presentation | [DEC-WF01-S04-D2](../decisions/DECISION_LOG.md#dec-wf01-s04-d2) |
| D-S04-3 rate limit | [DEC-WF01-S04-D3](../decisions/DECISION_LOG.md#dec-wf01-s04-d3) |
| D-S04-4 blocked date | [DEC-WF01-S04-D4](../decisions/DECISION_LOG.md#dec-wf01-s04-d4) |
| D-S04-5 mail-blocked | [DEC-WF01-S04-D7](../decisions/DECISION_LOG.md#dec-wf01-s04-d7) |
| D-S04-6 composition | [DEC-WF01-S04-D6](../decisions/DECISION_LOG.md#dec-wf01-s04-d6) |
| D-S04-7 support address | [DEC-WF01-S04-D5](../decisions/DECISION_LOG.md#dec-wf01-s04-d5) |
| D-S04-8 session trigger | [DEC-WF01-S04-D8](../decisions/DECISION_LOG.md#dec-wf01-s04-d8) |

## Related

- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — approved decisions
- [WF01_S03_STATE_BOARD_MAPPING.md](WF01_S03_STATE_BOARD_MAPPING.md) — S03 precedent
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
