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

## DEC-WF01-S04 — Auth error state board

Every row carries these shared fields. **Status:** APPROVED (human review). **Date:** 2026-09-26. **Scope:** WF01-S04 `/auth/error`. **Evidence (shared):** [WF01_S04_STATE_BOARD_MAPPING.md](../implementation/WF01_S04_STATE_BOARD_MAPPING.md), [WF01-S04 report](../implementation/reports/WF01-S04_auth-errors.md).

| ID | Topic | Context | Decision | Rationale | Evidence | Impact | Supersedes |
|---|---|---|---|---|---|---|---|
| <a id="dec-wf01-s04-d1"></a>DEC-WF01-S04-D1 | Public error state transport | S03 passed no reason (DEC-WF01-S03-D3), so S04 could not distinguish its states | S04 reads an allowlisted public code `/auth/error?reason=<code>` (`blocked`, `session_expired`, `generic`); unknown or missing → GENERIC; the query value is never rendered or echoed | Lets S04 show the right state without leaking internals; an allowlist makes injection impossible | `auth-error-screen.tsx` `publicReason`; Playwright: 7 hostile/unknown values fall back to GENERIC and never appear in the HTML | S03 now routes `AUTH_ACCOUNT_BLOCKED` to `?reason=blocked`; the page is static so no query reaches server HTML | DEC-WF01-S03-D3 in part ("no reason passed"); the rest of D3 stands |
| <a id="dec-wf01-s04-d2"></a>DEC-WF01-S04-D2 | LINK-INVALID / GENERIC | S03 routes invalid and other failures here; the AUTH4 board has no generic panel | `/auth/error` and `?reason=generic` render the same GENERIC state in the shared centred AuthCard, as a FUNCTIONAL FALLBACK; pixel mode DESIGN-GAP-GENERIC | No approved panel may be fabricated from an unrelated state | Functional, a11y, typography and geometry checks; `WF01-S04.generic.review.json` | Requires manual PO visual review; no strict pixel claim | — |
| <a id="dec-wf01-s04-d3"></a>DEC-WF01-S04-D3 | Rate limit stays inline | R1 shows a rate-limit panel; S01/S02 already show it inline | `AUTH_RATE_LIMITED` remains inline at the causing action (S01/S02) and never redirects to S04; R1 is not a runtime state | Keeps the user in context; R1's numbers and Google action are unfrozen | Playwright: 429 on S01 shows the inline alert, URL stays `/auth`; `?reason=rate_limited` → GENERIC | R1 excluded from runtime and pixel QA | — |
| <a id="dec-wf01-s04-d4"></a>DEC-WF01-S04-D4 | BLOCKED date | R2 copy cites a date ("20/09") that no data source provides | No hard-coded date; copy keeps the approved meaning without it | Fabricated data is worse than an absent detail | Playwright asserts no date pattern | INTENTIONAL-DATA-ABSENCE; a reliable date can be rendered later through approved data | — |
| <a id="dec-wf01-s04-d5"></a>DEC-WF01-S04-D5 | Support contact | R2 action shows `hotro@1hub.network`; no support contact is configured | No email address is invented; generic support copy, no action element | A dead or invented contact misleads users | Playwright asserts no `@` and no link/button on BLOCKED | INTENTIONAL-DATA-ABSENCE; R2's action button is not rendered | — |
| <a id="dec-wf01-s04-d6"></a>DEC-WF01-S04-D6 | Runtime composition | The AUTH4 reference is a board of horizontal rows | ONE state in ONE centred AuthCard on the 1440×900 canvas; the rows' components stack vertically | The board is a design artefact, as for DEC-WF01-S03-D5 | Component crops: disc 1 px, action 3 px outside text | INTENTIONAL-COMPOSITION; pixel QA compares approved components (disc, action), not whole rows | — |
| <a id="dec-wf01-s04-d7"></a>DEC-WF01-S04-D7 | Mail blocked by domain | R4 needs a provider/bounce signal that does not exist | R4 is OUT_OF_P0 / UNSUPPORTED; not implemented or inferred | No frozen signal can detect it | `?reason=mail_blocked` → GENERIC; no "chặn thư" text | R4 excluded | — |
| <a id="dec-wf01-s04-d8"></a>DEC-WF01-S04-D8 | Session expired | R3 exists; no protected route detects expiry yet | S04 supports `reason=session_expired` with the R3 presentation; no new global redirect is invented; deterministic test setup via the URL | Future protected flows may route here per the auth contract | Playwright: R3 state, lifetime from `SESSION_TTL_SECONDS`, relogin to `/auth` | The lifetime in the copy follows the provisional TTL (pre-UAT) | — |

## Related

- [p0-status.md](../implementation/P0_STATUS.md) — overall P0 state
- [wf01-s03-state-board-mapping.md](../implementation/WF01_S03_STATE_BOARD_MAPPING.md) — S03 mapping
- [wf01-s04-state-board-mapping.md](../implementation/WF01_S04_STATE_BOARD_MAPPING.md) — S04 mapping (frozen)
