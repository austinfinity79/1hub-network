# P0 Status

Current implementation state of 1hub.network Phase 0. This file changes with task progress;
`README.md` does not. Update it when a task changes the state below.

## Current phase

**M0 — Foundation: DONE** (completion audit GREEN WITH DOCUMENTED LIMITATIONS, accepted;
[report](M0_FOUNDATION_COMPLETION_REPORT.md)).

**M1 — WF01 Identity & Onboarding: IN PROGRESS — 6 / 8 screens CLOSED (75%).**

| Screen | State |
|---|---|
| WF01-S01 Auth Entry | DONE — functional + typography + pixel gate PASS ([report](reports/WF01-S01_auth-entry.md)) |
| WF01-S02 Check Email | CLOSED / PASS — "Mở Gmail" omitted by contract; runtime copy approved; countdown from server `resend_after_seconds` ([report](reports/WF01-S02_check-email.md)) |
| WF01-S03 Auth Callback | CLOSED / PASS — SUCCESS/EXPIRED/USED; INVALID → S04; decisions DEC-WF01-S03-D1..D7, D6a, ICON ([report](reports/WF01-S03_auth-callback-states.md), [mapping](WF01_S03_STATE_BOARD_MAPPING.md)) |
| WF01-S04 Auth Errors | CLOSED / PASS (BLOCKED copy neutralised: no email promise) — BLOCKED/SESSION_EXPIRED component pixel PASS; GENERIC = DESIGN-GAP-GENERIC (PO review); DEC-WF01-S04-D1..D8 ([report](reports/WF01-S04_auth-errors.md), [mapping](WF01_S04_STATE_BOARD_MAPPING.md)) |
| WF01-S05 Onboarding Purpose | CLOSED / PASS — P0 intent allowlist (4 codes, no investor), skip keeps intent NULL, server guard; investor option = INTENTIONAL-P0-SCOPE; DEC-WF01-S05-D1..D6 ([report](reports/WF01-S05_onboarding-purpose.md), [contract](WF01_S05_INTENT_CONTRACT_GAP.md)) |
| WF01-S06 Onboarding Profile | CLOSED / PASS — six fields; DOMAIN+SKILL picker (max 5); private avatar storage; one completion service for `/session`, `/me/profile`, `/me/profile/completion`; DEC-WF01-S06-D1..D6 ([report](reports/WF01-S06_onboarding-profile.md), [contract](WF01_S06_PROFILE_FIELD_CONTRACT.md)) |
| WF01-S07 … S08 | Not started; routes remain M0-T03 placeholders |

## Completed (committed)

| Task | Scope |
|---|---|
| M0-T01 | Repository bootstrap and quality gates |
| M0-T02 / T02b | Self-hosted fonts, design tokens, Playwright typography verification |
| M0-T03 | Shared shell and frozen route groups |
| M0-T04 | Shared UI primitives |
| M0-T05 | API client, error envelope, DTO conventions |
| M0-T06A | PostgreSQL foundation and frozen-schema compatibility audit |
| M0-T06B | Additive migration 002: RoleAssignment anchor and per-entity lifecycle states |
| OPS-GH01 | GitHub handoff setup |
| DECISION-P0-01 | Classification of M0-T06A blocking gaps |
| DOC-README-01 | Project README |
| OPS single-writer | CLAUDE.md §13 local workspace single-writer rule |
| DOC-README-02 | README simplified into a stable entry point; this status file created |
| M0-T07 | Deterministic, idempotent seed fixture system |
| M0-T08 | Auth/session foundation: magic link, server-side sessions, HTTP-only cookie |
| DECISION-AUTHZ-01/01B | P0 role to capability matrix, human approved |
| M0-T09 | RBAC authorization foundation: actor, scope, lifecycle, session capabilities |
| M0-T10 | Durable idempotency store (migration 003), idempotent magic-link requests |
| M0-T11 | Manifest-driven Pixel QA foundation: manifest audit, QA mapping, capture, diff, report, dry run |
| M0 AUDIT | Foundation completion audit: clean install, fresh PostgreSQL, restart proof; 1 P2 + 1 P3 fixed |
| WF01-S01 | Auth Entry: email magic-link path, provider-free per contract |
| WF01-S01 audit | Token scope audit: single-screen measurements localised to the auth card |
| WF01-S02 | Check Email: masked address, server-timed resend countdown, resend, change email |
| WF01-S03 | Auth Callback: token consumed once, success redirect by onboarding state, expired/used states |
| WF01-S04 | Auth Errors: allowlisted public reason, blocked / session expired / generic |
| WF01-S05 | Onboarding Purpose: `GET /me/onboarding`, `PUT /me/onboarding/intent`, onboarding header shell |
| WF01-S06 | Onboarding Profile: `GET/PATCH /me/profile`, `/me/profile/completion`, `/me/profile/avatar`, `/vocabularies/{type}`, `/media/assets/:id` |

## Not yet built (M0)

Nothing from the M0 item list.

`completion_percent` in `GET /api/v1/session` is computed by the single profile completion service (WF01-S06), the same one behind `/me/profile` and `/me/profile/completion`.

`GET /api/v1/session` resolves a real session and derives `capabilities` and `managed_scopes` server-side from the approved authorization matrix.

The transitional `role_assignments.account_id` column and its trigger, kept by 002 so the old seed still applied, are now unused: the deterministic seed writes the profile anchor only. They can be dropped by a later migration.

## Pixel QA readiness (M0-T11 dry run)

15 of 24 production screens are `READY_FOR_SCREEN_IMPLEMENTATION`. 9 are `REFERENCE_CONFIGURATION_GAP`, awaiting a design/QA decision:

| Gap | Screens |
|---|---|
| `state-board` reference with no per-state region definition | none (WF01-S03, WF01-S04 resolved by approved mappings) |
| `__full.png` shorter than the 900px viewport; a full-page capture is never below 900px | WF02-S01, S02, S05, S06; WF03-S01, S02, S03, S05, S08 |

No product pixel pass has been claimed for any screen.

## Open decisions / known gaps

| Item | Where |
|---|---|
| Schema vs SOT compatibility gaps | [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) |
| Provisional idempotency policy, incl. lenient missing header | [IDEMPOTENCY_STORE_P0.md](IDEMPOTENCY_STORE_P0.md) |
| Classification of blocking gaps B1–B5 | [P0_DECISIONS_REQUIRED.md](P0_DECISIONS_REQUIRED.md) |
| Deferred pre-UAT/deployment items, incl. rate limiting, email delivery, error logging | [M0 completion report §16](M0_FOUNDATION_COMPLETION_REPORT.md) |
| Pixel QA reference configuration gaps (11 screens) | [M0-T11 report](reports/M0-T11_manifest-pixel-qa-foundation.md) |

## Next task

WF01-S07 Privacy & Visibility — awaiting explicit authorization. Not started.

## Related

- [IDEMPOTENCY_STORE_P0.md](IDEMPOTENCY_STORE_P0.md) — idempotency store and its provisional decisions
- [CLAUDE_LATEST_REPORT.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [reports/](reports/) — archived task reports
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — approved decision records
- [README](../../README.md) — project entry point
