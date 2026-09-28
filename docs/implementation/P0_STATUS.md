# P0 Status

Current implementation state of 1hub.network Phase 0. This file changes with task progress;
`README.md` does not. Update it when a task changes the state below.

## Current phase

**M0 — Foundation: DONE** (completion audit GREEN WITH DOCUMENTED LIMITATIONS, accepted;
[report](M0_FOUNDATION_COMPLETION_REPORT.md)).

**M1 — WF01 Identity & Onboarding: CLOSED** — 8/8 screens; final re-audit **GREEN WITH DOCUMENTED LIMITATIONS** ([report](reports/WF01_FINAL_REAUDIT.md), [audit](WF01_COMPLETION_AUDIT.md), [UAT matrix](WF01_UAT_MATRIX.md)). P0/P1/P2 = 0; UAT 14/14, 0 expected-fail. External release inputs: `PRODUCTION_LEGAL_CONTENT_REQUIRED`, real production roster data, production REGION/DOMAIN/SKILL taxonomy.

**M2 — WF02 Member Profile & Network: CLOSED** — 7/7 screens; completion audit **GREEN** ([audit](WF02_COMPLETION_AUDIT.md), [UAT matrix](WF02_UAT_MATRIX.md), [report](reports/WF02_completion-audit.md)). P0/P1/P2 = 0; UAT 7/7 cases (12 HC steps + 6 alternates) on the dev DB, a fresh install and after a restart. Release inputs: outbound email provider (magic link + team invitations), PO copy review for S05/S06, plus the WF01 inputs.

**M3 — WF03 HUB / Chapter / CLB Operations: PROTECTED / CLOSED / GREEN** — completion audit **GREEN** ([audit](WF03_COMPLETION_AUDIT.md), [UAT matrix](WF03_UAT_MATRIX.md), [report](reports/WF03_completion-audit.md)); P0/P1/P2 = 0; UAT-WF03-J1 20 steps + SEC-WF03-01 + NEG-WF03; fresh / upgrade / restart PASS. History: DEC-WF03-G1..G15; executable scope **8 screens** (S01–S04, S06–S09); S05 = FUTURE / WF04. C1 closed (DEC-WF03-C1: S06 = profile / detail, S08 = relationships); S08 relationship contract frozen (DEC-WF03-S08-RELATIONSHIP-CONTRACT; migration 009); C2 closed (DEC-WF03-C2). **WF03-T00 ops foundation DONE** (OpsShell, /ops guard, org context, hierarchy reader, `GET /ops/organizations`). **WF03-S01 organization selector / list, WF03-S02 organization dashboard, WF03-S03 organization members, WF03-S04 membership review / leadership ops, WF03-S06 organization profile / detail, WF03-S07 standalone event management (DEC-WF03-S07-EVENT-LIFECYCLE), WF03-S08 organization settings / relationships and WF03-S09 public organization page DONE.** WF03: 8 / 8 executable screens; closing gate PASSED. Process: [PROCESS-P0-ACCELERATED-SAFE-V2](PROCESS_P0_ACCELERATED_SAFE_V2.md). WF01 and WF02 are PROTECTED / CLOSED / GREEN.

| Screen | State |
|---|---|
| WF01-S01 Auth Entry | DONE — functional + typography + pixel gate PASS ([report](reports/WF01-S01_auth-entry.md)) |
| WF01-S02 Check Email | CLOSED / PASS — "Mở Gmail" omitted by contract; runtime copy approved; countdown from server `resend_after_seconds` ([report](reports/WF01-S02_check-email.md)) |
| WF01-S03 Auth Callback | CLOSED / PASS — SUCCESS/EXPIRED/USED; INVALID → S04; decisions DEC-WF01-S03-D1..D7, D6a, ICON ([report](reports/WF01-S03_auth-callback-states.md), [mapping](WF01_S03_STATE_BOARD_MAPPING.md)) |
| WF01-S04 Auth Errors | CLOSED / PASS (BLOCKED copy neutralised: no email promise) — BLOCKED/SESSION_EXPIRED component pixel PASS; GENERIC = DESIGN-GAP-GENERIC (PO review); DEC-WF01-S04-D1..D8 ([report](reports/WF01-S04_auth-errors.md), [mapping](WF01_S04_STATE_BOARD_MAPPING.md)) |
| WF01-S05 Onboarding Purpose | CLOSED / PASS — P0 intent allowlist (4 codes, no investor), skip keeps intent NULL, server guard; investor option = INTENTIONAL-P0-SCOPE; DEC-WF01-S05-D1..D6 ([report](reports/WF01-S05_onboarding-purpose.md), [contract](WF01_S05_INTENT_CONTRACT_GAP.md)) |
| WF01-S06 Onboarding Profile | CLOSED / PASS — six fields; DOMAIN+SKILL picker (max 5); private avatar storage; one completion service for `/session`, `/me/profile`, `/me/profile/completion`; DEC-WF01-S06-D1..D6 ([report](reports/WF01-S06_onboarding-profile.md), [contract](WF01_S06_PROFILE_FIELD_CONTRACT.md)) |
| WF01-S07 Privacy & Visibility | CLOSED / PASS — one acknowledgement → two versioned ConsentRecords; PROFILE_DISCOVERY (NETWORK_ONLY/PRIVATE); avatar visibility enforced at `/media/assets/:id`; Future purposes and skip omitted; DEC-WF01-S07-D1..D8 ([report](reports/WF01-S07_privacy-visibility.md), [contract](WF01_S07_PRIVACY_CONSENT_CONTRACT.md)) |
| WF01-S08 Onboarding Complete | CLOSED / PASS — completion on entry (idempotent, atomic DRAFT → ACTIVE); activation minimum only; `PROFILE_ACTIVATED` audit and `onboarding_completed` analytics once; Challenge/Chapter cards deferred (card 02 Project rendered since DEC-P0-SHELL-D6); exit → `/me`; DEC-WF01-S08-D1..D8 ([report](reports/WF01-S08_onboarding-complete.md), [contract](WF01_S08_COMPLETION_CONTRACT.md)) |

**INTERNAL ALPHA — P0-LANDING: DONE** — `/` is the public homepage (DEC-P0-LANDING-D1..D3; [report](P0_LANDING_IMPLEMENTATION_REPORT.md)). WF01–WF03 remain PROTECTED / CLOSED / GREEN.

**INTERNAL ALPHA — P0-SHELL: DONE (GREEN)** — one integrated app shell: wordmark → `/`, member ↔ ops entries, editor back links, venture editor ↔ team, project-creation entry (S08 card 02 + S01 link), inert items with stated reasons, auth entry responsive below 1024px (DEC-P0-SHELL-D1..D7; [audit](P0_SHELL_NAVIGATION_AUDIT.md), [report](reports/P0-SHELL_navigation-audit.md)). Navigation matrix: 274 links × 5 personas, 0 dead. Only placeholder left: `/ops/org/:id/programmes` (FUTURE / WF04, unlinked).

**INTERNAL ALPHA — M4 WF04 Programme / Challenge (DEMO): PROTECTED / CLOSED / GREEN** — completion audit **GREEN** ([audit](reports/WF04_COMPLETION_AUDIT.md), [UAT matrix](WF04_UAT_MATRIX.md)); 9 / 9 plan tasks; P0 / P1 = 0; P2 = 1 fixed (WF04-P2-01, reset re-mounts open editors); UAT-WF04-J1 / J2 / J3 + SEC-WF04-01 + NEG-WF04 1–20 + NAV / EVT / VIS; restart, fresh DB and the Chapter 01 fixture dependency PASS; production DB / audit writes 0. Future WF04 changes need an explicit task. **WF04-S08 Programme detail / manage DONE** ([report](reports/WF04-S08_programme-detail.md); [DEC-WF04-S08-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s08-d1)): one detail page for PROGRAMME / CHALLENGE, DRAFT / PUBLISHED, from the same session store; basic-information edit (type and owner locked); S01 rows and S07 publish open the detail; no lifecycle change, metric or public page; no DB / audit write. **WF04-S07 Review + publish DONE** ([report](reports/WF04-S07_programme-review.md); [DEC-WF04-S07-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s07-d1)): read-only summary, exact H5 checklist, DRAFT → PUBLISHED in the session store (atomic, idempotent); no DB / audit write. **WF04-S06 Operating team DONE** ([report](reports/WF04-S06_programme-team.md); [DEC-WF04-S06-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s06-d1)): display-only team with the PROGRAMME_ORGANIZER label (grants nothing); no RoleAssignment / membership / leadership / profile write. **WF04-S05 Registration configuration DONE** ([report](reports/WF04-S05_programme-registration.md); [DEC-WF04-S05-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s05-d1)): applicant types and programme questions configured in the session store, profile reuse stated, counts read-only; no application row, engine or rule; no DB / audit write. **WF04-S04 Programme events DONE** ([report](reports/WF04-S04_programme-events.md); [DEC-WF04-S04-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s04-d1)): the current programme's events (`programme_id` boundary) edited with the canonical Event rules in the session store; WF03 Event runtime unchanged; no DB / audit write. **WF04-S03 Structure / journey DONE** ([report](reports/WF04-S03_programme-journey.md); [DEC-WF04-S03-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s03-d1)): ordered stages and CHALLENGE problem statements edited atomically in the session store; S02 → S03; no DB / audit write. **WF04-S02 Create + basic info DONE** ([report](reports/WF04-S02_programme-create.md); [DEC-WF04-S02-D1..D4](../decisions/DECISION_LOG.md#dec-wf04-s02-d1)): `/demo/programmes/new` creates a session DRAFT with the canonical Programme fields, owner from the server-side scope; no DB / audit write. **WF04-S01 Programme / Challenge list DONE** ([report](reports/WF04-S01_programme-list.md); [DEC-WF04-S01-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s01-d1)): `/demo/programmes` lists the in-scope fixtures + session drafts in the ADM5 table; rows non-navigable until S08; "Tạo mới" opens S02 (was disabled until S02). Decisions frozen: [DEC-WF04-H1..H5](../decisions/DECISION_LOG.md#dec-wf04-h1) (human decisions remaining: 0). **WF04-T00 Demo Foundation DONE** ([report](reports/WF04-T00_demo-foundation.md); [DEC-WF04-T00-D1..D5](../decisions/DECISION_LOG.md#dec-wf04-t00-d1)): deterministic fixture (1 Programme + 1 Challenge, Chapter 01), read-only `GET /api/v1/demo/programmes[/{id}]` scoped by `programme:read`, `/demo/programmes` guard + frame ("Dữ liệu demo · Internal Alpha", "Đặt lại demo"), per-actor `sessionStorage` store, OpsShell foot entry; no migration, no DB / audit writes. Plan: [audit](WF04_PRE_IMPLEMENTATION_AUDIT.md), [scope](WF04_DEMO_SCOPE.md), [plan](WF04_SCREEN_IMPLEMENTATION_PLAN.md), [happy path](WF04_HAPPY_PATH_PLAN.md). Next: WF04-S08.

**INTERNAL ALPHA — M5 WF05 Founder / Project / Startup (DEMO): PROTECTED / CLOSED / GREEN** — completion audit **GREEN** ([audit](reports/WF05_COMPLETION_AUDIT.md), [UAT matrix](WF05_UAT_MATRIX.md)); 5 / 5 plan tasks; P0 / P1 / P2 = 0, P3 = 5 recorded; HC-WF05-01..04 + SEC-WF05-01 (8 actors) + NEG-WF05 1–29 + STORE / NAV / VIS / COPY; restart and fresh DB PASS; production DB / audit writes 0; no migration; hydration #418 gate 0 reproductions (OBS-WF05-01 watched). Future WF05 changes need an explicit task ([pre-implementation audit](WF05_PREIMPLEMENTATION_AUDIT.md), [plan](WF05_SCREEN_IMPLEMENTATION_PLAN.md), [happy path](WF05_HAPPY_PATH_PLAN.md)). [DEC-WF05-G1..G5](../decisions/DECISION_LOG.md#dec-wf05-g1) approved (composed design; onboarded members, MemberShell entry "Dự án & Startup · Demo"; PUBLISHED WF04 programmes read-only; PROJECT → TEAM, STARTUP → STARTUP; owner-only browser-session application DRAFT → SUBMITTED); human decisions remaining 0. **WF05-T00 Demo foundation DONE** ([report](reports/WF05-T00_demo-foundation.md); [DEC-WF05-T00-D1..D3](../decisions/DECISION_LOG.md#dec-wf05-t00-d1)): read-only `GET /api/v1/demo/projects[/{id}]` over the canonical WF02 venture, the application session store, the shared demo frame, a hidden MemberShell entry; no migration, no production write. **WF05-S01 My projects / startups + open programmes DONE** ([report](reports/WF05-S01_my-projects.md)): `/demo/projects` in MemberShell (entry "Dự án & Startup · Demo" now shown), the member's owner / ACTIVE-member ventures from WF02 and the PUBLISHED programme, read only. **WF05-S02 Project / Startup detail + participation DONE** ([report](reports/WF05-S02_project-detail.md)): `/demo/projects/:id` (WF02 relation rule, same 404 otherwise): canonical fields, team (owner + ACTIVE), the PUBLISHED programmes with eligibility and the session application status; "Sửa hồ sơ" / "Xem đội" → WF02; S01 rows link here. **WF05-S03 Application draft DONE** ([report](reports/WF05-S03_application-draft.md)): `/demo/projects/:id/applications/:programmeId` for the eligible owner — the live venture as applicant, the WF04 plain-text questions, "Lưu nháp" creates / updates one DRAFT per venture × programme in the browser session (incomplete allowed; refusals atomic); members, archived ventures and SUBMITTED applications are read only; "Rà soát & nộp" saves, then opens S04. **WF05-S04 Review + submit DONE** ([report](reports/WF05-S04_review-submit.md)): `/demo/projects/:id/applications/:programmeId/review` — the live venture, programme, applicant type, every question and answer; the G5 checklist (owner, not archived, type taken, every answer valid); "Nộp đơn" re-reads the venture and programme, then DRAFT → SUBMITTED once, atomically, in the browser session; SUBMITTED final and read only (S03 locked; S01 / S02 "Đã nộp"); no production write. Next: WF05 COMPLETION AUDIT + HAPPY PATH UAT.

**INTERNAL ALPHA — M6 WF06 Ecosystem Data Flywheel / Discovery & Matching: FUTURE / VISION — runtime implementation SKIPPED for Internal Alpha** ([DEC-WF06-INTERNAL-ALPHA-SCOPE](../decisions/DECISION_LOG.md#dec-wf06-internal-alpha-scope); [report](reports/WF06-SCOPE_internal-alpha-decision.md)). Not promoted under Master Spec M6: no WF06 screen, route, API, read model, matching, recommendation / ranking, investor discovery or data-flywheel automation, and no migration. Existing landing / README references stay future-only. The Internal Alpha scope is complete for the audit: P0-LANDING, P0-SHELL, WF01, WF02, WF03, WF04 DEMO, WF05 DEMO.

**INTERNAL ALPHA — COMPLETION AUDIT + RELEASE READINESS: NOT GREEN — NOT READY** ([audit](INTERNAL_ALPHA_COMPLETION_AUDIT.md), [UAT matrix](INTERNAL_ALPHA_UAT_MATRIX.md), [draft manifest](INTERNAL_ALPHA_RELEASE_MANIFEST.md), [report](reports/INTERNAL-ALPHA_completion-audit.md)). All gates pass (scope, 39 executable screens, navigation, 270-cell actor matrix, auth / session, WF01–WF05, data, migrations 001→009, seed, fresh DB, restart, production mode, build) except one: the React hydration error #418 reproduced once in the fresh-DB full run (**IA-P2-02**, open; was OBS-WF05-01). IA-P2-01 (`POST /auth/magic-link` 500 on a malformed `X-Forwarded-For`) found and fixed. No release SHA frozen; nothing deployed.

**INTERNAL ALPHA — CLOSURE DEFECT IA-P2-02 (React hydration #418): CLOSED — READY FOR COMPLETION AUDIT RECHECK** ([report](reports/IA-P2-02_hydration-418.md)). Root cause: React 19.3.0 inside `next@15.5.26` replays a suspended page-root host fiber without rewinding its hydration cursor when a child RSC chunk is still streaming (markup identical on server and client). Fix: `patches/next@15.5.26.patch` (pnpm `patchedDependencies`) backports React's upstream lines; no app code changed. Deterministic repro 42 / 150 → 0 / 150; affected tests, fresh server and fresh DB 0 #418. Deploy note: the image must copy `patches/` before `pnpm install`. The draft manifest stays NOT READY; no release SHA frozen; nothing deployed.

**INTERNAL ALPHA COMPLETION AUDIT — FINAL RECHECK (`dcbde62`): NOT GREEN — release SHA NOT frozen** ([report](reports/INTERNAL-ALPHA_final-recheck.md)). Clean `git archive` install + fresh DB: patch reproducible (frozen install, patched bundle), IA-P2-02 0 #418, format / lint / typecheck / build, unit 237, DB 349, full suite 640 passed / 24 opt-in skipped / 0 failed, migrations, seed, security, navigation, privacy PASS. **Open: IA-P2-03 (P2)** — below 1280 px the WF03 members "Mở →", WF02 team "Huỷ lời mời" and WF03 events actions are unreachable by pointer / touch (clipped tables, overlaid side panel). Watch: IA-OBS-01. Deploy requirement: copy `patches/` before `pnpm install`. Manifest stays DRAFT — NOT READY; nothing deployed.

**INTERNAL ALPHA — CLOSURE DEFECT IA-P2-03 BASIC RESPONSIVE SAFETY: CLOSED — READY FOR FINAL RELEASE RECHECK** ([report](reports/IA-P2-03_basic-responsive-safety.md)). CSS only (`9c61458`): the WF03 members / network and WF02 team tables scroll sideways inside their frame instead of clipping; the WF03 events list scrolls in its card below 1280 px and the side column stacks below 1024 px. 0 unreachable, covered or clipped controls on 28 routes at 1440 / 1024 / 768 / 390; 1440 unchanged; new REL-RESP pointer-reachability test; protected WF02 / WF03 / P0-SHELL 218 passed, WF01 / WF04 / WF05 smoke 39 passed. P0 / P1 / P2 = 0. Release SHA not frozen; nothing deployed.

**INTERNAL ALPHA — FINAL RELEASE RECHECK + FREEZE: GREEN — RELEASE CANDIDATE** ([freeze report](reports/INTERNAL-ALPHA_release-freeze.md), [manifest](INTERNAL_ALPHA_RELEASE_MANIFEST.md) READY). **Release SHA `9c614585ca61fe2e4c957f28d7cc5c78fafe7bc0`**; deploy tooling `68488cfe9732b46aad297e24ab6f2811ce6d9caf` (`deploy/Dockerfile` copies `patches/` before `pnpm install --frozen-lockfile`); rollback `0a2df094b941f6d0f0fc87cdb7767b2e92272198`. Clean install of the SHA: patch applied, format / lint / typecheck / build, unit 237, DB 349, fresh DB (001→009, seed idempotent), full suite 665 = 641 passed / 24 opt-in skipped / 0 failed, 0 #418, responsive 0 unreachable at 1440 / 1024 / 768 / 390; release image built and smoke-tested. P0 / P1 / P2 = 0. Functional QA PASS · Pixel QA PASS · Team UAT PENDING. Nothing deployed.

**INTERNAL ALPHA — DEPLOYED** to https://1hubnetwork.io.vn (Task 20, release `9c61458`, record on `deploy/vps-foundation` `81da9bd`). **TEST PACK READY** ([guide and checklist](INTERNAL_ALPHA_SELF_REVIEW_GUIDE.md), [accounts](INTERNAL_ALPHA_TEST_ACCOUNTS.md), [data / reset](INTERNAL_ALPHA_TEST_DATA_RESET.md), [flows](internal-alpha/guest-auth.md); reports [first pack](reports/INTERNAL-ALPHA_test-pack.md), [post-deploy pack](reports/INTERNAL-ALPHA_post-deploy-test-pack.md)): operator sign-in links, actors A–I, reset rules, Flows 1–6 (WF-TEST-01..06), re-verified read-only on the domain. Team UAT: **PENDING**.

**TASK 21 v2 — DESIGN REVISION AUDIT (corrected Homepage + L1–L6): DONE — HUMAN DECISION REQUIRED** ([audit](../design-revision/00_CORRECTED_SOURCE_MANIFEST.md), [report](reports/TASK-21v2_design-revision-audit.md)). 64 assets verified; root `/` already public. Buckets A 15 / B 26 / C 21; 11 decisions (HD-01…HD-11). The first, withdrawn audit is in `docs/design-revision/superseded/` (DO NOT IMPLEMENT). No runtime change; Task 22 not started.

**TASK 22.1 — CORRECTED PUBLIC HOMEPAGE (Bucket A): DONE** ([report](reports/TASK-22.1_public-homepage.md); precheck stop [report](reports/TASK-22.1_homepage-typography-stop.md)). HD-12 CLOSED as DEC-HD-12: Space Grotesk self-hosted, scoped to revision screens. `/` is rebuilt to `design-reference/final/revision/H1` and stays public with the same entry CTA; HD-01 placeholder blocks are omitted; 0 `href="#"`. Pixel: 22 blocks, max 0.99 % outside text, max 1.40 % beyond ±2 px; P0 / P1 / P2 = 0. Responsive 1024 / 768 / 390 PASS. Full suite 643 passed / 24 skipped / 0 failed. Implementation `a05917a`; nothing deployed.

**TASK 22.2 — CORRECTED L1 AUTH / ONBOARDING (Bucket A): DONE** ([report](reports/TASK-22.2_l1-auth-onboarding.md)). AUTH1–AUTH4 and the ACC-10 subset are rebuilt to `design-reference/final/revision/L1` under DEC-L1-D1…D8. The 8 Bucket B frames (onboarding restructure, AI, roles, consent removal, FP1-OWN) are not built. Auth model, consent step, routes, APIs and DB are unchanged. Space Grotesk is scoped to the auth group and the S08 card; 0 typography violations; P0 / P1 / P2 = 0. Responsive 1440 / 1024 / 768 / 390: 0 overflow. Full suite 644 passed / 24 skipped / 0 failed. Implementation `5735d78`; nothing deployed.

**TASK 22.3 — CORRECTED L2 MEMBER / PROFILE / PROJECT (Bucket A): DONE** ([report](reports/TASK-22.3_l2-member-project.md)). L11 `/me/settings` becomes the overview of existing settings; L13a–c turn `/projects/new` into a 3-step wizard over the existing create and invitation APIs (one canonical venture; the URL carries the id). 6 Bucket B and 2 Bucket C L2 frames are not built. Profile, organisation, venture lifecycle, APIs, DB and RBAC are unchanged; WF05 still reuses the canonical venture. 0 typography violations; P0 / P1 / P2 = 0. Responsive 1440 / 1024 / 768 / 390: 0 overflow. Full suite 652 passed / 24 skipped / 0 failed. Implementation `2a57fe9`; nothing deployed.

**TASK 22.4 — CORRECTED L3 CHAPTER / WF03 (Bucket A): DONE** ([report](reports/TASK-22.4_l3-chapter-wf03.md)). L19 `/organizations/:slug`, L20 `/ops/org/:id`, L23 `…/events` and L26 `…/members` are rebuilt to `design-reference/final/revision/L3` under DEC-L3-D1…D5: full-bleed public page over the unchanged projection, dashboard restyle with a "Tạo sự kiện" entry, event status chips with an on-demand panel, member tabs with inline approve / reject through the unchanged S04 call. L27 (B) and L21, L22, L24, L25 (C) are not built. Business, API, DB, RBAC and lifecycles unchanged; WF03 stays PROTECTED / CLOSED. 0 typography violations; P0 / P1 / P2 = 0. Responsive 1440 / 1024 / 768 / 390: 0 page overflow. Full suite 679 = 655 passed / 24 skipped / 0 failed. Implementation `cc6ca28`; nothing deployed.

**TASK 22 — THẢO 28/09 SCOPE REFREEZE: DONE (docs only)** ([report](reports/TASK-22-2809_scope-refreeze.md), [scope-refreeze](../design-revision/scope-refreeze/overview.md)). DEC-2809-D1…D7 frozen from `Update 28_9.docx`: homepage CTAs with login return, live AI onboarding suggestion, L3 = dashboard / chapter information / member approval, L4 and L6 = Directory / Form only (0 screens each), one canonical Venture with quick-create, server-side Application (DRAFT → SUBMITTED, snapshot on submit). 62 screens: APPROVED ALPHA 24, FUTURE 38. The WF05 session-only Application (DEC-WF05-G5 / T00-D1) and 14 other records are SUPERSEDED; batches 22.5–22.8 of the old order are replaced. 19 human decisions open (HD-A1…A14, HD-02 / 03 / 05 / 08 / 11). Runtime, schema, API and RBAC: 0.

**TASK 22-PREVIEW-01 — INTERNAL ALPHA PREVIEW (HOMEPAGE + L1 + L2): GREEN, frozen, not deployed** ([report](reports/TASK-22-PREVIEW-01_preview-release.md), [manifest](INTERNAL_ALPHA_PREVIEW_RELEASE.md)). APP PREVIEW SHA `cc6ca287a3d549b579ff8c5b6c7f9edd637c03e1` (tag `internal-alpha-preview-01`); rollback `9c61458` (deployed now, schema-safe). No product change: targeted suite 342 / 0 failed, happy path 19 / 19, pixel 0 / 0 / 0, #418 = 0, build PASS. 12 preview limitations documented (inert homepage CTAs, no auth return, no AI, desktop-frame member pages, …).

**TASK 22-PREVIEW-LOGIN-UI — L1 login hotfix: DONE** ([report](reports/TASK-22-PREVIEW-LOGIN-UI_login-hotfix.md)). AUTH1 split layout kept (PO); the Google control is drawn disabled with "Sắp có", plus the divider (DEC-L1-D9); auth logic unchanged. NEW APP PREVIEW SHA `33f8b0c2c2cb7b78ce7d6b8979def4d7660025bd` (tag `internal-alpha-preview-02`), rollback `cc6ca28` (the deployed preview). Regression 219 / 0 failed; pixel 0 / 0 / 0; build PASS. Real e-mail login stays BLOCKED CONFIGURATION ([stop report](reports/TASK-22-PREVIEW-AUTH_email-config-stop.md)).

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
| WF01-S07 | Privacy & Visibility: `/legal/current`, `/legal/{kind}/{version}`, `/me/consents`, `/me/consents/accept`, `/me/visibility`, audit writer |
| WF01-S08 | Onboarding Complete: `POST /me/onboarding/complete`, analytics writer (`onboarding_completed`, `profile_completion_changed`) |
| WF01-REMEDIATION-01 | GAP-ROSTER: roster importer CLI, migration 004 (`uq_active_leadership`, `roster_reconcile_account`), sign-in reconcile |
| WF01-REMEDIATION-02 | GAP-ANALYTICS-REG: `account_created` in the account-insert transaction; race-safe first sign-in |
| WF01-REMEDIATION-03A/03 | DEFECT-RESUME: migration 005, S05 SKIP action, one onboarding resolver for sign-in, `/session`, guards |
| WF01 FINAL RE-AUDIT | Fresh install/DB/restart, full suite, UAT gate: GREEN WITH DOCUMENTED LIMITATIONS — WF01 CLOSED |
| WF02 PRE-IMPLEMENTATION AUDIT | 7 screens audited; HUMAN DECISION REQUIRED (H1–H13); no code change |
| WF02 HUMAN DECISION PACKET | H1–H13 packet: H13 resolved by precedence; 12 human; blocking H1, H2, H6, H7, H9 |
| WF02 DECISION FREEZE | DEC-WF02-H1..H13 recorded; P12 + P13 deletion subset authorized (not created); new open gap: venture region/domain storage |
| WF02-T00 | Venture taxonomy storage decided (0 open decisions); member shell; `GET /me/network`; discovery projection helper; WF01 regression green |
| WF02-S01 | Account Home `/me`: identity, server completion, nav cards, canonical organisations/ventures; pixel drift 0 outside text; H12 harness rule live |
| WF02-S03 | Privacy `/me/privacy`: PROFILE_DISCOVERY (NETWORK_ONLY/PRIVATE), current legal status + re-acceptance, consent history; WF01-S07 services reused; pixel drift 0 |
| WF02-S04 | Roles `/me/roles` + `POST /me/membership-requests` (PENDING_APPROVAL only, G1–G5 frozen); read-only canonical rows; pixel PASS |
| WF02-S02 | Profile edit `/me/profile/edit`: all 10 completion groups editable (H1 addendum), ≥80% reachable through UI; PATCH extended, no migration; pixel drift 0 |
| WF02-S07 | Settings `/me/settings`: sessions list/revoke/revoke-all, account deletion REQUEST; migration 006 (P13 subset); G1–G6 frozen; pixel PASS; SEC-OBS-01 still open |
| SEC-OBS-01 | Magic-link callback: `Referrer-Policy: no-referrer` header (callback only); asset Referers carry no token; auth behaviour unchanged — CLOSED |
| M0-ENTRY-01 | Root `/`: bootstrap placeholder removed; server-side redirect through the canonical onboarding resolver |
| WF02-S06 | Venture team `/projects/:id/team`; `/ventures/{id}/team*` incl. explicit accept/decline; migration 008 (P12 team lifecycle + pending email invitations); fixture remediated (G9); G1–G9 frozen; pixel PASS |
| WF02-S05 | Project/Startup `/projects/new`, `/projects/:id/edit`; `POST/GET/PATCH /ventures*`; migration 007 (region + domains); G1–G5 frozen; shared EditorHeader; pixel PASS |

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
| ~~GAP-ROSTER (P1)~~ **CLOSED** by WF01-REMEDIATION-01 (`pnpm roster:import`, migration 004); real roster data is a go-live input | [report](reports/WF01-REMEDIATION-01_gap-roster.md) |
| ~~GAP-ANALYTICS-REG (P1)~~ **CLOSED** by WF01-REMEDIATION-02 (`account_created`) | [report](reports/WF01-REMEDIATION-02_gap-analytics-registration.md) |
| ANALYTICS-EXT **DEFERRED** by DEC-WF01-ANALYTICS-EXT-DEFER (added later through the same writer) | [DECISION_LOG.md](../decisions/DECISION_LOG.md#dec-wf01-analytics-ext-defer) |
| ~~DEFECT-RESUME (P2)~~ **CLOSED** by DEC-WF01-RESUME-D1 (migration 005 `purpose_step_completed_at`, one resolver) | [report](reports/WF01-REMEDIATION-03_defect-resume.md) |
| **Release blocker** `PRODUCTION_LEGAL_CONTENT_REQUIRED`: real Terms/Privacy text and versions (local uses marked fixtures) | [WF01_S07_PRIVACY_CONSENT_CONTRACT.md](WF01_S07_PRIVACY_CONSENT_CONTRACT.md) |
| Pixel QA reference configuration gaps (11 screens) | [M0-T11 report](reports/M0-T11_manifest-pixel-qa-foundation.md) |

## Next task

- Internal Alpha review track: HUMAN / PO SELF-REVIEW ON DEPLOYED DOMAIN (with the test pack), then ALPHA-AUTO-REVIEW-01.
- Preview track: deploy the NEW exact APP PREVIEW SHA `33f8b0c` to 1hubnetwork.io.vn (Claude B); real e-mail login waits for its configuration.
- Design revision track: TASK 22.5 — APPLICATION PERSISTENCE BACKEND FOUNDATION (first of the [recalculated order](../design-revision/scope-refreeze/task-sequence.md)); the old 22.7 (L54) is cancelled.

Neither is started automatically.

## Related

- [IDEMPOTENCY_STORE_P0.md](IDEMPOTENCY_STORE_P0.md) — idempotency store and its provisional decisions
- [CLAUDE_LATEST_REPORT.md](CLAUDE_LATEST_REPORT.md) — latest task report
- [reports/](reports/) — archived task reports
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — approved decision records
- [README](../../README.md) — project entry point
