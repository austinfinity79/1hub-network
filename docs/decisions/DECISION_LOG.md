# Decision Log

Human-approved implementation decisions with stable IDs. A decision here resolves an ambiguity *between* frozen sources; it never edits the SOT itself.

## DEC-WF01-S03 — Auth callback state board

Every row below carries these shared fields. **Status:** APPROVED (human review, 2026-09-26). **Scope:** WF01-S03 `/auth/callback`. **Context:** the AUTH3 reference is a state board holding three panels. The frozen sources name the callback states but not their runtime composition, actions or token transport. **Evidence:** [WF01_S03_STATE_BOARD_MAPPING.md](../implementation/WF01_S03_STATE_BOARD_MAPPING.md), [WF01-S03 report](../implementation/reports/WF01-S03_auth-callback-states.md).

| ID | Decision | Rationale | Impact |
|---|---|---|---|
| <a id="dec-wf01-s03-d1"></a>DEC-WF01-S03-D1 | EXPIRED / USED "request new link" navigates to `/auth` for a fresh request; no resend from the callback | Callback links must work on another device, where no `auth_request_id` exists; resend of a used request returns 409 | `<Link href="/auth">`; asserted 0 resend calls |
| <a id="dec-wf01-s03-d2"></a>DEC-WF01-S03-D2 | The red outline on the board's middle panel is a designer annotation, not UI | It marks one panel on a board; no contract state implies a bordered card | Not rendered; pixel crops inset 1px |
| <a id="dec-wf01-s03-d3"></a>DEC-WF01-S03-D3 | INVALID token (and missing token, blocked account, any other failure) routes to `/auth/error` (WF01-S04); no reason passed | WF01 assigns error/blocked states to S04; a reason in the URL would widen leakage | S03 has three visual states only |
| <a id="dec-wf01-s03-d4"></a>DEC-WF01-S03-D4 | Processing is transient technical behaviour, not an approved state | No frozen state or board panel exists for it | Screen-reader status only; not pixel-tested |
| <a id="dec-wf01-s03-d5"></a>DEC-WF01-S03-D5 | Runtime renders ONE state in ONE centred AuthCard; the board is evidence only | The board is a design artefact, not a page | Per-state panel crops aligned on the icon disc |
| <a id="dec-wf01-s03-d6"></a>DEC-WF01-S03-D6 | Approved panel copy is preserved verbatim | Avoids copy drift from the approved design | Titles, bodies and labels as on the board, amended only by D6a |
| <a id="dec-wf01-s03-d6a"></a>DEC-WF01-S03-D6a | The EXPIRED body's second sentence is reworded to "Đây không phải lỗi của bạn — hãy quay lại nhập email để nhận link đăng nhập mới." | The board text promised an in-place resend that D1 rules out; business/security behaviour wins over bitmap copy | EXPIRED copy only; layout, style and behaviour unchanged |
| <a id="dec-wf01-s03-d7"></a>DEC-WF01-S03-D7 | P0 link format `/auth/callback?token=<opaque-single-use-token>`; token never logged, stored or rendered; stripped from the URL after handling; no Referer | The contract names the path (`return_to`) but not the token transport | Browser-side token handling; static page; `referrer: no-referrer` |
| <a id="dec-wf01-s03-icon"></a>DEC-WF01-S03-ICON | INTENTIONAL-ICON-RENDERING: state icons are deterministic inline SVG, not OS emoji or glyphs | The board's ✓ ⏱ ↻ are platform-dependent emoji/glyph rasters; an OS emoji would render differently per environment | Recorded pixel deviation inside the icon discs (≤173 px per state), classified intentional |

## Related

- [p0-status.md](../implementation/P0_STATUS.md) — overall P0 state
- [wf01-s03-state-board-mapping.md](../implementation/WF01_S03_STATE_BOARD_MAPPING.md) — S03 mapping
- [wf01-s04-state-board-mapping.md](../implementation/WF01_S04_STATE_BOARD_MAPPING.md) — S04 proposal
