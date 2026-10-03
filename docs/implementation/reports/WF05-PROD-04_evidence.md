# WF05-PROD-04_evidence

**WF05-PROD-04 — frontend and cross-WF evidence pack (items 1–29).** Production build on :3972, local PostgreSQL at 016, the deterministic WF05 fixture (`src/lib/application/testing.ts`). Main report: [WF05-PROD-04_frontend-integration.md](WF05-PROD-04_frontend-integration.md). New spec: `tests/visual/specs/wf05-prod-frontend.spec.ts` (F).

| # | Item | Result |
|---|---|---|
| 1 | Preflight | branch `feat/wf05-prod-hardening`, start HEAD `5c7d907`, tree clean except `AGENTS.md`, migrations 001–016, no concurrent change |
| 2 | Frontend impact map | 8 surfaces; before / after in the main report; all PRODUCTION_READY |
| 3 | Fixture / runtime dependency | no `programme-demo/fixtures`, `testing`, `sessionStorage` / `localStorage` or `d4…0001` in WF05 runtime (grep); actor key removed |
| 4 | S01 list | real `GET /demo/projects` + `/me/applications`; every own application in every programme state ("(đã đóng)"); no notice / reset / demo copy (F) |
| 5 | S02 detail | canonical venture, team, owner / member relation; closed-programme rows read only; ineligible draft hint + "Xem đơn"; error title (F) |
| 6 | Create / edit | WF02 create / edit / team unchanged (WF02 suites); QuickTeam `POST /ventures`: server reason per field, alert, nothing created, double click safe (idempotency key, busy) (F) |
| 7 | Application entry | one venture → form `?tu=ds`; several → the choice; existing → "Tiếp tục" / SUB3; closed / unknown programme → 404 (F, L5) |
| 8 | Draft save / reload | blur save → reload identical; first input creates the draft once, another tab's draft adopted (one row); failed save → "Chưa lưu được. Thử lại" → retry saves; typing flushed on page hide; restart check 14 / 14 (app, DB restart, relogin) |
| 9 | Submit | double click → one SUBMITTED, one `APPLICATION_SUBMITTED` audit; SUB3 from the snapshot (F) |
| 10 | Submitted read only | form and review URLs → SUB3; S02 "Đã nộp" + "Xem đơn"; a stale open form's save (`409 APPLICATION_SUBMITTED`) → SUB3 (UAT NEG) |
| 11 | CLOSED / ARCHIVED | closed draft: SUB1 read only, reason, pill "Chỉ xem", no autosave card, textarea disabled, no enabled submit, review → SUB1, row unchanged; no application → 404; archived venture → read only `ARCHIVED` (F, DB) |
| 12 | Error mapping | `401` → `/auth?redirect`; `403` / `404` → re-read → not-found; `409` SUBMITTED → SUB3, NOT_ELIGIBLE → read only, EXISTS → adopted id; `422` → field / "Chưa nộp được…"; 5xx → safe copy + "Thử lại"; no JSON, SQL, stack (F) |
| 13 | Auth redirect | guest → `/auth?redirect=<path>` on S01, S02, apply, SUB1, SUB2, SUB3; revoked session on an S01 read or a save → same (F) |
| 14 | `d4…0001` dependency | none in runtime; the new spec uses only the WF05 fixture; seeded locally only; promotion step unchanged (Claude B runbook) |
| 15 | WF02 ↔ WF05 | `/me/settings` → entry → S01 → S02 → WF02 editor rename → back: same id everywhere, one `projects` row, owner and members unchanged, application `venture_id` unchanged (F) |
| 16 | WF04 ↔ WF05 | operator closes the programme through WF04 `POST …/close`: WF04 and `/me/applications` both CLOSED; the open form turns read only on its next save; the application stays listed; form version matches (F) |
| 17 | Team / member UI | EDIT member: venture visible, no application, no apply / resume / view, SUB1 404; team management stays WF02 (F) |
| 18 | Loading / empty / error states | S01 / S02 loading, empty, failed + retry, missing; SUB1 saving / failed + retry / read only; SUB2 submitting / incomplete / failed; L5 not-found (F, S01 / S02 suites) |
| 19 | Targeted tests | F 14 / 14; WF05 + L5 set (F, WF05 API, S01, S02, T00, UAT, L5) 74 / 74 on the final build; DB 36 / 568 (+1 SUB1 read mode, −1 actor key); unit 33 / 307; restart check 14 / 14; format, lint, typecheck, build PASS |
| 20 | Protected regression | fresh `db:reset`, final build: 66 specs / 820 passed (16.2 min) — WF01–WF05, L5, auth / authz, shell, API contract, release, console health, WF04 / WF05 API, the new F; 0 failed, 0 flaky. An earlier full run (before the SUB1 read-only pill) also 820 / 820. Old tests updated first: 18 assertions of removed demo artifacts / old URLs (main report) |
| 21 | 5xx / console / hydration | 0 / 0 / 0: every spec's response and console guards (faked 503s excluded by URL); server log of the final runs: 0 error lines |
| 22 | Bugs found / fixed | G21–G27 (main report); 0 CONTRACT_CONFLICT; 0 VISUAL_REGRESSION |
| 23 | PROD-05 carry-forward | A 400 vs 422, B draft-save audit: recorded open (main report) |
| 24 | Files changed | runtime 28 (1 new: `components/application/session.ts`), DB tests 2, specs 6 (1 new), docs 3 — listed in [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md) |
| 25 | Local commit | this commit, `feat(wf05): frontend and cross-workflow integration hardening (WF05-PROD-04)`; SHA in the final task report |
| 26 | Working tree | clean after the commit except the untracked `AGENTS.md` |
| 27 | `origin/main` | `78f21f2` (fetched 2026-10-03) |
| 28 | production | `78f21f2` (`/opt/1hub-network/shared/state/current`) |
| 29 | Confirmation | no push, no merge, no deploy; PROD-05 not started |

## Related
- [WF05-PROD-04_frontend-integration.md](WF05-PROD-04_frontend-integration.md) · [WF05-PROD-03_evidence.md](WF05-PROD-03_evidence.md)
