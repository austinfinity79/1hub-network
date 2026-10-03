# WF05-PROD-04_frontend-integration

**WF05-PROD-04 — frontend and cross-WF integration hardening.** 2026-10-03, branch `feat/wf05-prod-hardening` on `5c7d907` (PROD-03). Scope = handoff "Not in PROD-02 / PROD-03" PROD-04 line (G21–G29) under the frozen [RBAC / API / frontend contract](WF05-PROD-01_rbac-api-frontend.md#frontend) and [demo artifact disposition](WF05-PROD-01_production-contract.md#demo-artifact-disposition). No migration, endpoint, error code, role, lifecycle or redesign. Evidence: [WF05-PROD-04_evidence.md](WF05-PROD-04_evidence.md).

## Preflight
Branch `feat/wf05-prod-hardening`, HEAD `5c7d907`, tree clean except `AGENTS.md`; migrations 001–016; `origin/main` / production `78f21f2`; WF04 candidate `f40f70c` in history; no other lane in HEAD (`fix/member-shell-mobile` `a957876`, `docs/ai-ingestion-contract` `fb2130f` stay separate).

## Frontend impact map
| Screen | Route | Before | After |
|---|---|---|---|
| S01 list | `/demo/projects` | PARTIAL_API: real reads in a demo frame (notice, reset, demo copy); closed-programme applications hidden; `401` looped on "Thử lại" | PRODUCTION_READY |
| S02 detail | `/demo/projects/{id}` | PARTIAL_API: demo frame; closed-programme applications unreachable; ineligible draft without link; empty `<h1>` on error | PRODUCTION_READY |
| L5 entry, CHOOSE, SUB0 | `/programmes/{id}/apply` | REAL_API: guest lost the path; SUB0 mapped every refusal to "Bắt buộc." | PRODUCTION_READY |
| SUB1 form | `/projects/{id}/applications/{pid}` | REAL_API: closed draft 404; no save retry; ≤ 20 s typing lost; back always S02; back step number off | PRODUCTION_READY |
| SUB2 review / SUB3 | `…/review`, `…/submitted` | REAL_API: one generic submit error; non-editable draft showed an enabled submit; SUB3 → `/projects` | PRODUCTION_READY |
| MemberShell / WorkspaceShell entry | every member page | DEMO_ARTIFACT: "Demo · Internal Alpha" group, "· Demo" suffix | PRODUCTION_READY ("Dự án & Startup") |
| demo frame provider | `/demo/projects/*` | DEMO_ARTIFACT: reset of a dead `sessionStorage` key, actor key | removed (`notice: false`, as WF04) |
| WF02 create / edit / team | `/projects/new`, `/projects/{id}/edit`, `/team` | REAL_API (WF02 protected) | unchanged |
FIXTURE_BACKED / CLIENT_ONLY: none — no fixture import, browser business state or hard-coded id in WF05 runtime (grep evidence).

## Canonical identity
One Venture (`projects.id`, `owner_profile_id`, `project_members`), one Programme and form (WF04 rows), one Application (`applications.id`) across S01, S02, L5 and WF02 / WF04 screens: every screen reads the server by id; nothing is copied on entry; the form adopts an existing application on `409 APPLICATION_EXISTS` instead of creating another.

## Changes
| Gap | Finding | Class | Change | Files |
|---|---|---|---|---|
| G21, G22 | demo notice, reset, demo copy, actor key, shell labels on real data | DEMO_ARTIFACT (frozen REMOVE) | provider `{ notice: false }`; copy without demo wording; entry "Dự án & Startup"; group label and its orphan style removed; actor key and its test removed; `/demo/projects*` routes and API kept | `project-demo/demo-store.tsx`, `copy.ts`, `guard.ts`, `read-model.ts` (+ db-test), `member/nav.ts`, `shell/member-shell.tsx`, `workspace-shell.tsx` / `.module.css`, `demo-frame.ts` (comment) |
| G23 | guest deep link lost its path; `401` looped or showed a generic error | FRONTEND_INTEGRATION_BUG | `requireMember(returnTo?)` (default unchanged) → `/auth?redirect=<page>`; demo layout leaves a guest to the page (`hasMemberSession`); client `401` → `signInAgain()` | `member/guard.ts`, `(demo)/demo/projects/layout.tsx`, `page.tsx`, L5 pages, `application/session.ts` (new), S01 / S02 / form / review / QuickTeam |
| G24 | cancel / back always S02; SUB3 → `/projects` (no status) | FRONTEND_INTEGRATION_BUG | form origin `?tu=ds` (apply entry → S01) / `?tu=chon` (the choice), default S02, kept across steps; SUB3 → S01 | `application/routes.ts`, apply page, SUB1 page, form, QuickTeam, SUB3 |
| G25 | applications vanish once a programme closes; closed draft 404 | FRONTEND_INTEGRATION_BUG (contract: reachable in every state) | S01 lists every application, "(đã đóng)"; S02 adds read-only rows ("Xem đơn"); SUB1 opens an existing draft of a non-PUBLISHED programme read only with its reason, pill "Chỉ xem", no autosave promise (no new entry: 404); SUB2 of a non-editable draft → SUB1 | `project-list.tsx`, `project-detail.tsx`, `application.ts` (`getApplicationContext` read mode), SUB1 / SUB2 pages, form |
| G26 | failed save without retry; typing lost on page hide | FRONTEND_INTEGRATION_BUG | inline "Thử lại"; the first input starts the first save once; keepalive PATCH on `pagehide` / hidden | form, `application.module.css`, `api/client.ts` (`keepalive` option) |
| G27 | step number, QuickTeam reasons, status wording, empty `<h1>`, ineligible-draft hint, submit errors | API_MAPPING_BUG / FRONTEND_INTEGRATION_BUG | ordinal back step; server reason per field; "Bản nháp" / "Đã nộp" (L5 wording) on S01 / S02; S02 error title; hint + "Xem đơn"; submit `401` / `409` / `422` / 5xx mapped | form, QuickTeam, review, S01 / S02, `application/copy.ts` |
No CONTRACT_CONFLICT. VISUAL_REGRESSION: none found.

## Old tests classified
| Spec | Assertion | Class | Action |
|---|---|---|---|
| `wf05-s01`, `wf05-s02`, `wf05-uat-journey` (HC-WF05-04), `wf05-t00` | demo notice / reset / "· Demo" entry / group label present | old test vs frozen disposition | assert their absence; HC-WF05-04 now proves no reset and the applications staying |
| `l5`, `wf05-s01`, `wf05-s02`, `wf05-t00` | guest lands on bare `/auth` | old test vs frozen `401` / return rule | expect `/auth?redirect=<path>` |
| `wf05-s01`, `wf05-s02`, `wf05-uat-journey` | status "Nháp" | old wording (G27) | "Bản nháp" |
| `l5` entry, `wf05-uat-journey` NAV | form URL without `?tu=`; SUB3 link `/projects` | old navigation (G24) | `?tu=ds` / `?tu=chon`; `/demo/projects` |
| `wf05-uat-journey` NEG | stale form save shows "Chưa lưu được — thử lại" | old behaviour (`409 APPLICATION_SUBMITTED`) | the save opens SUB3; data unchanged |

## Not changed (with reason)
| Item | Reason |
|---|---|
| G27 client readiness pill | display of live typing only; submit uses the server `missing` and re-checks |
| G27 S01 "Đăng ký" after a submit | the row is the programme entry; with several ventures another may still apply; the entry routes to SUB3 / the choice |
| G29 SUB0 / CHOOSE / SUB2 without a back link | a link would be new navigation (§20); browser back works; for PROD-06 / PO against L37–L43 |
| unused notice branch of the shared WF04 `DemoPage` | WF04 candidate code; no provider uses it now; cleanup belongs to WF04 |

## Flag for the PO (no contract change made)
The first typed characters now trigger the first save, so `APPLICATION_DRAFT_CREATED` is audited on first input instead of first blur / step change. Rules unchanged: created on the first save, idempotent, one per pair.

## PROD-05 carry-forward (not resolved here)
| # | Item | State after PROD-04 |
|---|---|---|
| A | 400 vs 422 validation / error-envelope consistency | open: WF05 validation is `422` (frozen); framework `400` / `405` envelope is G14 (global); the UI maps both to readable copy |
| B | draft-save audit event naming / coverage | open: frozen "no audit for draft saves"; PROD-04 adds saves (first input, page hide), relevant to the volume of any `APPLICATION_DRAFT_SAVED` |

## Related
- [WF05-PROD-04_evidence.md](WF05-PROD-04_evidence.md) · [WF05-PROD-03_api-rbac.md](WF05-PROD-03_api-rbac.md) · [WF05-PROD-01_rbac-api-frontend.md](WF05-PROD-01_rbac-api-frontend.md)
