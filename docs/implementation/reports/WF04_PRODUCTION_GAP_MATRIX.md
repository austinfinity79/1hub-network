# WF04 Production Gap Matrix

**WF04 PRODUCTION HARDENING — PHASE 4.0, PRODUCTION GAP AUDIT ONLY.** 2026-10-01, baseline `78f21f2` (`main` = `origin/main`). Read-only: no runtime code, migration, API, business rule, commit, push, deploy or production access. WF05 and WF06 are out of scope; shared dependencies are named only.

Evidence keys: `DL` = `docs/decisions/DECISION_LOG.md`, `SOT` = `docs/product/1HUB_DATA_SOT_v1.1.md`, `FRZ` = `docs/product/00_DATA_DECISIONS_FREEZE_v1.1.md`, `MS` = `1HUB_IMPLEMENTATION_MASTER_SPEC_v1.3.md`, `A0n` = `docs/architecture/0n_*`, `API` = `05_API_CONTRACT_P0_v1.0.md`, `M0nn` = `db/migrations/0nn_*.sql`, `SEED` = `db/seed/seed_p0_deterministic.sql`, `PD/` = `src/lib/programme-demo/`, `PC/` = `src/components/programme-demo/`.

## 1. Executive Summary

Current classification: **DEMO / GREEN / PROTECTED** (`CLAUDE.md:34`, `docs/implementation/P0_STATUS.md:34`, PROCESS V2 §J).

Production readiness estimate: **≈ 15 %** (effort-weighted). Of the 106 checks in this matrix, 32 are ready (30 %), but they are the cheap ones: the read guard, the error and auth frameworks, the existing `programmes` / `events.programme_id` / `programme_application_forms` / `applications` tables, and screen shells. The production business contract is **0 % frozen**, the operator write path is **0 %** built, and **no operator action persists** (all of them live in `sessionStorage`).

| Area | Ready | Gap | Decision required | Counted from |
|---|---:|---:|---:|---|
| UI | 7 | 3 | 5 | §3, §11 states, §14 |
| Data | 3 | 7 | 6 | §4 (16 fields) |
| DB | 6 | 2 | 7 | §8 A + E |
| API | 1 | 7 | 4 | §9 (user-specific state not in scope) |
| RBAC | 4 | 1 | 6 | §6 (10 capabilities + missing write capabilities) |
| Lifecycle | 1 | 2 | 5 | §7 (incl. reuse of the WF03 event lifecycle) |
| Security | 5 | 5 | 1 | §10 |
| Tests | 5 | 12 | 1 | §12 (tablet NOT_REQUIRED) |
| **Total** | **32** | **39** | **35** | 106 checks |

| Finding | Evidence |
|---|---|
| WF04 cannot be promoted by engineering alone: "a real operator workflow needs its own approved design and business contract (no inferred dashboard, configuration or judging)" | DEC-2909-L4H2 (DL:1301); DEC-L4-D1 (DL:1309); PROCESS V2 §A/§C |
| The SOT freezes the business flow, the single Programme aggregate with subtype, the lifecycle names and the entity relations; every behaviour (who creates, edits, publishes, closes; what a stage, problem or operating team is as data; the public surface) is DEMO, FUTURE or an open decision (HD-A4, HD-A6, HD-A7) | MS:129-144, FRZ:11-50, SOT:209-210; `docs/design-revision/scope-refreeze/human-decisions.md:11-14` |
| No approved WF04 visual reference exists; the demo was built on approved primitives (ADM5, WF02-S02) | `docs/design/WF04_EXTERNAL_REFERENCE.md:24`; `design-reference/final/manifest.yaml` has no WF04 / L4 entry |
| The only real server pieces WF04 uses: session + onboarding guard, org-scoped `programme:read`, and `organizations` rows | PD/guard.ts:19-50; PD/read-model.ts:38-41,103-113; `src/lib/authz/matrix.ts:62` |
| WF05 already owns the only programme data in production: seeded row `d4000000-…-0001` (PUBLISHED) and its `programme_application_forms` row; the WF04 demo never reads them and never writes | SEED:274-292; PD/read-model.ts:17-21; `docs/implementation/INTERNAL_ALPHA_RELEASE_MANIFEST.md:16-26` |

## 2. Current Architecture

| Layer | Today | Evidence |
|---|---|---|
| Entry | OpsShell foot "Chương trình & Challenge" (group "Demo · Internal Alpha") for actors who pass the ops guard | `src/components/shell/ops-shell.tsx:74`, `src/lib/ops/nav.ts:53-57` |
| Guard | `requireOps()` (session → `/auth`, onboarding → step, `network:read`) then `programme:read` anywhere, else 404; per-id `requireDemoProgrammeRoute` (UUID, fixture range, scope) | PD/guard.ts:19-50; `src/lib/ops/guard.ts:31-44` |
| Read model | Deep-frozen TypeScript fixture (`DEMO_PROGRAMMES`: PROGRAMME `d4…0001` PUBLISHED, CHALLENGE `d4…0002` DRAFT) filtered by allowance; joined with real `organizations` | PD/fixtures.ts:19-204; PD/read-model.ts:56-69 |
| API | `GET /api/v1/demo/programmes`, `GET …/{id}`; POST/PUT/PATCH/DELETE → 405; no query or body accepted | `src/app/api/v1/demo/programmes/route.ts:10-22`, `[id]/route.ts:15-20` |
| Client store | `window.sessionStorage` key `hub.wf04-demo.v1.<sha256(accountId)[0:16]>`; pure edit functions; same-tab events; reset button | PD/session-store.ts:7-40; PC/demo-store.tsx:62-144 |
| DB | Reads `organizations`, `role_assignments`, `individual_profiles`, sessions; **never** reads `programmes`, `events`, `programme_application_forms`, `applications`; writes nothing | PD/read-model.ts:17-21; `read-model.db-test.ts:198-220` |
| Shared | WF03: OpsShell, `requireOps`, `EventDTO`, `EVENT_LIMITS`; WF05 reuses `DemoPage`, `ProgrammeStatusPill`, labels; WF05 reads the seeded DB row, not the fixture | PC/demo-frame.ts:5-10; `src/lib/application/application.ts:86-127` |

## 3. Screen Inventory

All routes: actor = HUB_COMMUNITY_LEADER (own organization scope) or PLATFORM_ADMIN; data = FIXTURE + `sessionStorage`; state = `sessionStorage`; DB persistence = none; tests = the WF04 visual spec of the same id plus `wf04-uat-journey`, `wf04-t00`, `p0-shell-navigation`, `internal-alpha-release`.

| Screen | Route | Component | Visible actions | API | Fixture dependency |
|---|---|---|---|---|---|
| S01 list | `/demo/programmes` | PC/programme-list.tsx | "Tạo mới", row link, "Thử lại", "Đặt lại demo"; no filter, search or tabs | `GET /api/v1/demo/programmes` (the only client API call) | full |
| S02 create | `/demo/programmes/new` | PC/programme-create.tsx | type, name, summary, owner, dates; "Huỷ", "Lưu" | none (owners from `demoOwnerOptions`, DB) | owner options are real |
| S08-BASIC | `/demo/programmes/[id]/setup/basic` | PC/programme-basic-edit.tsx | "Lưu thông tin" (name, summary, dates) | none | full |
| S03 journey | `…/setup/journey` | PC/programme-journey.tsx | stage add / edit / ↑↓ / delete; CHALLENGE "Bài toán" add / edit / delete | none | full |
| S04 events | `…/setup/events` | PC/programme-events.tsx | "Thêm sự kiện", "Sửa" (DRAFT, PUBLISHED), "Xoá" (DRAFT) | none | full |
| S05 registration | `…/setup/registration` | PC/programme-registration.tsx | applicant types (Cá nhân / Đội / Startup), questions; counts card read-only | none | full (counts hard-coded, `fixtures.ts:112`) |
| S06 team | `…/setup/team` | PC/programme-team.tsx | none (display rows) | none | full |
| S07 review | `…/setup/review` | PC/programme-review.tsx | checklist "Sửa" links, "Xuất bản" | none | full |
| S08 detail | `/demo/programmes/[id]` | PC/programme-detail.tsx | "Rà soát & xuất bản" / "Rà soát", "Sửa", "Quản lý" per card | none (server read via guard) | full |
| WF03-S05 | `/ops/org/[orgId]/programmes` | `RoutePlaceholder` | none; unlinked | contract only (API:833-856), no handler | — (FUTURE, DEC-WF03-G12, DL:765) |

## 4. Data Source Matrix

| Field | Class | Source | Production need |
|---|---|---|---|
| Title, summary, dates | FIXTURE + CLIENT_ONLY_STATE | PD/fixtures.ts:32,121; PD/basic-info.ts:103,157-164 | REAL_DB: `programmes.name/summary/starts_at/ends_at` exist |
| Type PROGRAMME / CHALLENGE | FIXTURE + CLIENT_ONLY_STATE | PD/fixtures.ts:29,118 | REAL_DB: `programmes.programme_type` exists |
| Status | FIXTURE + CLIENT_ONLY_STATE | PD/fixtures.ts:34,123; PD/readiness.ts:77 | REAL_DB: `programmes.status` exists (no CLOSED) |
| Owner organization id | FIXTURE (`10000000-…-0101`) / client choice for drafts | PD/fixtures.ts:19; PD/basic-info.ts:117 | REAL_DB: `programmes.organization_id` (nullable) |
| Owner organization ref | REAL_DB | PD/read-model.ts:38-41 | ready |
| Allowance (actor scope) | REAL_DB (server-computed) | PD/guard.ts; `src/lib/ops/scope.ts:17-33` | ready |
| Journey stages | FIXTURE + CLIENT_ONLY_STATE, "never persisted" | PD/types.ts:16-18,62-69 | NOT_IMPLEMENTED: no table (decision) |
| Problem statements | FIXTURE + CLIENT_ONLY_STATE | PD/types.ts:71-72 | NOT_IMPLEMENTED: no entity (DEC-WF04-H4) |
| Programme events | FIXTURE + CLIENT_ONLY_STATE | PD/fixtures.ts:66-95 | REAL_DB possible: `events.programme_id` exists; WF03 service refuses it (`src/lib/ops/events.ts:195-200`) |
| Registration config | FIXTURE + CLIENT_ONLY_STATE (types incl. INDIVIDUAL; plain-string questions) | PD/registration.ts:28-56 | REAL_DB partial: `programme_application_forms` (TEAM/STARTUP; `{id,prompt,required,step}`) |
| Operating team | FIXTURE only (display) | PD/fixtures.ts:96-107 | NOT_IMPLEMENTED (decision) |
| Application counts | FIXTURE only (SUBMITTED 5, UNDER_REVIEW 3, NEEDS_UPDATE 1) | PD/fixtures.ts:112 | DERIVED from `applications` possible for DRAFT / SUBMITTED only |
| List counts | DERIVED | PD/session-store.ts:151-163 | DERIVED (logic reusable) |
| Publish readiness | DERIVED, client-side, H5 "not a production rule" | PD/readiness.ts:25-48; DL:1014 | decision |
| CTA availability | DERIVED, client-side | PC/programme-review.tsx:137,341 | must be server-enforced |
| Notice, labels | STATIC_CONTENT (demo copy) | PD/copy.ts:4-47 | remove demo wording |

## 5. Action Matrix

| Screen | Action | Current behaviour / persistence | Expected (SOT) | Classification |
|---|---|---|---|---|
| S01 | List | GET demo API → fixture ∪ session drafts | list of real programmes in scope | FIXTURE_BACKED, MISSING_API |
| S02 | "Lưu" create | client validation → session DRAFT; new UUID per submit; no Idempotency-Key | Create node frozen (MS:129-144); who may create is HD-A4 | DEMO_ONLY, MISSING_PERSISTENCE, MISSING_API, MISSING_AUTHORIZATION, MISSING_AUDIT, MISSING_BUSINESS_DECISION |
| S08-BASIC | "Lưu thông tin" | session copy; editable even when PUBLISHED | edit rules after publish undefined | DEMO_ONLY, MISSING_PERSISTENCE, MISSING_STATE_RULE, MISSING_BUSINESS_DECISION |
| S03 | Stage add / edit / reorder / delete | session only | Structure/Journey is a child (FRZ:32-38) but its data model is demo-only (DEC-WF04-H3) | MISSING_BUSINESS_DECISION |
| S03 | Problem add / edit / delete | session only | "may be added later" (FRZ:22-27); no entity (DEC-WF04-H4) | MISSING_BUSINESS_DECISION |
| S04 | Event add / edit / delete | session only; edit DRAFT+PUBLISHED, delete DRAFT | Programme 1–* Event (SOT:142-151); scope policy undefined (API:904) | MISSING_PERSISTENCE, MISSING_API, MISSING_BUSINESS_DECISION |
| S05 | "Lưu cấu hình" | session only; never reaches `programme_application_forms` | config in DB is read-only in Alpha (M013:6-9) | MISSING_PERSISTENCE, MISSING_API, MISSING_VALIDATION (type / shape mismatch), MISSING_BUSINESS_DECISION |
| S06 | — | display only | programme-scoped organizer roles (SOT:161) not activated (A03:85-93) | MISSING_BUSINESS_DECISION |
| S07 | "Xuất bản" | client checklist → session PUBLISHED; DB and WF05 unaffected | `ProgrammePublished` (A02:253); publish rule undefined | DEMO_ONLY, MISSING_PERSISTENCE, MISSING_API, MISSING_STATE_RULE, MISSING_AUDIT, MISSING_BUSINESS_DECISION |
| S08 | Manage / Monitor | no metric or count (DEC-WF04-S08-D1) | Manage/Monitor node (MS:142) | MISSING_BUSINESS_DECISION |
| all | "Đặt lại demo" | clears this actor's session key | none in production | NOT_IN_SCOPE (remove) |
| — | Delete / unpublish / close / archive | not implemented | CLOSED / ARCHIVED FUTURE (DL:1027) | MISSING_BUSINESS_DECISION |

## 6. Actor/RBAC Matrix

Only actors the SOT and the system support. "DEMO" = allowed today in the browser session only; for production it is UNDEFINED.

| Capability | Guest | Member | HUB_COMMUNITY_LEADER (own org) | PLATFORM_ADMIN | PROGRAMME_ORGANIZER (designed, inactive) | Venture owner |
|---|---|---|---|---|---|---|
| View operator list | DENY (401 / `/auth`) | DENY (403 / 404) | ALLOW (`programme:read`) | ALLOW | DENY (label only, DL:1024) | DENY |
| View operator detail | DENY | DENY | ALLOW (same 404 out of scope) | ALLOW | DENY | DENY |
| Public directory / detail | UNDEFINED (HD-A6; L28 FUTURE) | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED | UNDEFINED |
| Create | DENY | UNDEFINED (HD-A4) | DEMO → UNDEFINED | DEMO → UNDEFINED | UNDEFINED | — |
| Edit basic / journey / registration | DENY | DENY | DEMO → UNDEFINED | DEMO → UNDEFINED | UNDEFINED (SOT:161) | — |
| Change status (publish / close / archive) | DENY | DENY | DEMO publish → UNDEFINED | DEMO publish → UNDEFINED | UNDEFINED | — |
| Manage programme events | DENY | DENY | DEMO → UNDEFINED (API:904) | DEMO → UNDEFINED | UNDEFINED | — |
| Manage operating team / roles | DENY | DENY | display only → UNDEFINED | display only → UNDEFINED | UNDEFINED (A03:85-93) | — |
| View applications (operator) | DENY | DENY | DENY in Alpha (HD-A13) | DENY | FUTURE | own only |
| Apply (WF05, production) | DENY (401) | team member 403 | as member | as member | — | ALLOW (API:1391-1405) |

Every UNDEFINED cell is a **MISSING_BUSINESS_DECISION** (§13). Only `programme:read` exists in `src/lib/authz/matrix.ts:22-32,62`; there is no create, manage or publish capability.

## 7. State/Lifecycle Matrix

| Source | Programme / Challenge states |
|---|---|
| SOT | `DRAFT → PUBLISHED → CLOSED → ARCHIVED` (SOT:209-210; FRZ:42) |
| DB | `publication_status` = DRAFT, PUBLISHED, ARCHIVED; **no CLOSED** (M001:12,276); gap D1 DEFERRED (`docs/implementation/DB_SCHEMA_GAPS_P0.md:113`) |
| API | no transition endpoint; lifecycle out of P0 (API:1161); WF05 §21 accepts PUBLISHED + form only (API:1399) |
| UI | `PROGRAMME_DEMO_STATUSES` = DRAFT, PUBLISHED; `PROGRAMME_LIFECYCLE` declared but unused (PD/types.ts:24-27) |
| Tests | DRAFT → PUBLISHED in session only (S07, UAT NEG-16/17, `readiness.test.ts`) |

| Transition | Who | Endpoint / action | Persistence | Validation | Tests |
|---|---|---|---|---|---|
| (none) → DRAFT | leader / admin in scope (demo) | S02 "Lưu" | session | client (`basic-info.ts:60-77`) | S02, UAT |
| DRAFT → PUBLISHED | leader / admin in scope (demo) | S07 "Xuất bản" | session | client H5 checklist (`readiness.ts:25-80`) | S07, S08, UAT |
| PUBLISHED → CLOSED | UNDEFINED | none | none (enum missing) | none | none |
| → ARCHIVED | UNDEFINED | none | none | none | none |
| PUBLISHED → DRAFT (unpublish) | not allowed in demo | none | none | none | S07 "no publish / unpublish" |

Inconsistencies: (1) CLOSED in SOT, absent in DB (and DEC-L5-D3 `APPLICATION_NOT_ELIGIBLE` 409 for "programme closed" vs API:1399 404); (2) every transition is enforced only client-side; (3) a PUBLISHED programme stays fully editable; (4) H5 publish rule is "not a production rule" (DL:1014) yet it is the only rule; (5) WF04 session publish never reaches the DB row that WF05 reads.

## 8. Persistence Gaps

**A. Entities already in the real DB:** `programmes` (M001:269-283), `events.programme_id` + index (M001:288,301), `programme_application_forms` (M013:29-38), `applications` (M013:40-82, WF05), `audit_events`, `idempotency_keys`, `role_assignments` (free-text `scope_type`).

**B. Fixture-backed screens:** all nine WF04 screens (S01–S08, S08-BASIC). The WF04 CHALLENGE fixture `d4…0002` has no DB row; DB programme `c0…0001` (DRAFT) is never shown.

**C. Actions that do not persist:** create, edit basic, every stage / problem / event / registration edit, publish, reset (everything).

**D. Missing relations:** Programme ↔ Organization many-to-many (SOT:142 vs single nullable `organization_id`); programme-scoped roles (SOT:161); Programme ↔ stage; Challenge ↔ problem statement; Programme ↔ Participation / Outcome (FUTURE).

**E. Likely schema needs (not created):**

| Need | Business reason | Reuse | New table / column required? | Duplicate-domain risk |
|---|---|---|---|---|
| `organization_id NOT NULL` + `ends_at ≥ starts_at` CHECK | A02:140 "at least one responsible Organization"; date order | `programmes` | constraint only, after a data check | none |
| CLOSED status | SOT lifecycle | `programmes.status` | yes: a `programme_status` enum (extending `publication_status` would also change `organizations`) | low |
| Journey stages | Structure/Journey child (FRZ:32-38) | `programmes.metadata` jsonb, or a table | **decision first** | medium (stage vs event) |
| Problem statements | Challenge child "later" (FRZ:22-27) | none; the Library "Bài toán" dataset is external JSON (DL:1346) | **decision first** | **high** (two problem models) |
| Programme events | Programme 1–* Event | `events` + `programme_id` | no; WF03 service rule change instead | high if a second event model is built |
| Registration config edits | operator configures what WF05 shows | `programme_application_forms` (+ `applications.question_set_version`, `snapshot`) | no new table if version bump + snapshots suffice; INDIVIDUAL needs `applicant_type` change (**decision**) | low |
| Operating team | programme-scoped organizer roles | `role_assignments` (scope_type PROGRAMME) vs reserved `programme_role_assignments` (A04:449-475) | **decision first** | **high** (two RBAC stores) |
| Organization relationships | Lead / co-organizer / challenge owner (SOT:109-116) | reserved `programme_organization_relationships` | **decision first** | medium |
| Application counts | Manage / Monitor | `applications` | no (derived; DRAFT / SUBMITTED only) | none |
| Audit | mutations must be audited (CLAUDE.md §4) | `audit_events` | no (new action codes in code) | none |
| Demo row `d4…0001` in production | it is "(demo)" data in a real table (A01:205; conflict C-12) | — | **decision** (keep as real, rename, or retire) | n/a |

## 9. API Gaps

| Capability | Existing endpoint | Current behaviour | Prod requirement | Gap |
|---|---|---|---|---|
| List | `GET /api/v1/demo/programmes`; contract `GET /ops/organizations/{orgId}/programmes` (API:833-856, no handler) | fixture; 401 / 403 | real rows in scope; one namespace (A04:234 → canonical `/programmes`) | MISSING_API; namespace decision |
| Detail | `GET /api/v1/demo/programmes/{id}` | fixture; same 404 out of scope; malformed `%` → `URIError` → 500 | real row + children | MISSING_API; 500 bug |
| User-specific state | none | — | not required by SOT (no "my programmes") | NOT_IN_SCOPE |
| Create | none | session | `POST` with scope injection, Idempotency-Key, audit | MISSING_API (blocked by HD-A4) |
| Update basic | none | session | `PATCH` with state rule | MISSING_API (blocked by state decision) |
| Journey / problems | none | session | — | MISSING_BUSINESS_DECISION |
| Programme events | WF03 `/ops/organizations/{orgId}/events` refuses `programme_id` | session | link rule (API:904) | MISSING_BUSINESS_DECISION; WF03 change |
| Registration config write | none (WF05 reads only) | session | write + version bump | MISSING_API (blocked by type / shape decision) |
| Team | none | display | — | MISSING_BUSINESS_DECISION |
| Publish | none | session | transition endpoint, server checklist, audit, idempotent | MISSING_API (blocked by publish rule) |
| Close / archive | none | none | — | MISSING_BUSINESS_DECISION |
| Authorization | `programme:read` only | read enforced server-side | write capabilities | MISSING_AUTHORIZATION |
| Errors | frozen envelope via `withApi` | read errors correct | same for writes (409 state, 422 validation) | ready (framework) |

## 10. Security Gaps

| Concern | Status | Evidence |
|---|---|---|
| Server-side RBAC on read | READY | PD/guard.ts:19-50; db-test "ordinary member is denied", "leader of another organization sees no Chapter 01 fixture" |
| Scope injection (no client org / role) | READY | `route.ts:12-13`; PD/read-model.ts:94-97 |
| IDOR on read | READY | same 404 for unknown / out-of-scope / non-demo ids (`read-model.db-test.ts:116-126,161-170`) |
| Role / header spoofing | READY | T00 :174; S01–S08; UAT SEC-WF04-01 |
| Unauthorized write | GAP | no write path exists; all writes must gain server checks |
| Audit of mutations | GAP | no `PROGRAMME_*` action (`src/lib/audit/audit.ts:9-43`) |
| Idempotency | GAP | no programme operation in `src/lib/api/idempotency.ts:21-32` |
| Private data leakage | READY | applications owner-only (HD-A13); WF04 reads no application |
| Session data left after logout | GAP (demo-only) | logout does not clear `hub.wf04-demo.v1.*` (`src/app/api/v1/auth/logout/route.ts`) |
| Malformed id → 500 | GAP | `[id]/route.ts:18` `decodeURIComponent` throws |
| Demo vs production data isolation | BUSINESS_DECISION_REQUIRED | row `d4…0001` "(demo)" in production (A01:205; C-12) |

## 11. Production Quality Gaps

| Item | Class | Note |
|---|---|---|
| Server-side RBAC (write) | GAP | read READY |
| Ownership / scope injection (write) | GAP | read READY |
| Validation | GAP | client-only today |
| Invalid transition protection | GAP | client-only; DB has no CLOSED |
| Duplicate submission / idempotency | GAP | client `inFlight` only |
| Refresh persistence | GAP | `sessionStorage` only |
| Logout / login persistence | GAP | lost across browsers; residue in the tab |
| Restart persistence | NOT_APPLICABLE today (client); GAP for production | — |
| Fresh DB behaviour | GAP | fixture never in DB; `d4…0002` absent |
| Migration safety | GAP | none written; CLOSED enum and constraints need additive, reversible migrations |
| Deterministic seed separation | BUSINESS_DECISION_REQUIRED | `d4…0001` shared by seed, fixture and production |
| Audit / history | GAP | no programme audit; form history via version + snapshot only |
| IDOR | READY (read) / GAP (write) | — |
| Role spoofing | READY | — |
| Hidden / private leakage | READY | — |
| Error states | READY | read-failed, save-failed, missing (PC/setup-screen.tsx:83-218) |
| Empty states | READY | "Chưa có chương trình hoặc challenge nào…" (PC/programme-list.tsx:37,115) |
| Loading states | READY | PC/programme-list.tsx:36; PC/setup-screen.tsx:83-93 |

## 12. Test Coverage Gaps

Existing: 10 Playwright specs (115 tests), 9 Vitest files (65), 1 DB test (9). Many assert that WF04 writes **nothing** to the DB (md5 fingerprints in S06, S07, S08, UAT; counts in T00–S05; `read-model.db-test.ts:198-220`); WF05 tests assert DB row = WF04 fixture (`src/lib/project-demo/read-model.db-test.ts:105`; `wf05-s01-my-projects.spec.ts:253`); `internal-alpha-release.spec.ts:756` limits table names. All of these must be rewritten, not deleted, when persistence lands.

| Category | Today | Production |
|---|---|---|
| Happy path | yes (session) | REQUIRED_FOR_PRODUCTION (persisted) |
| Negative path | yes (client) | REQUIRED_FOR_PRODUCTION (server 409 / 422) |
| Authorization | yes (read) | REQUIRED_FOR_PRODUCTION (write) |
| IDOR | yes (read) | REQUIRED_FOR_PRODUCTION (write) |
| Role spoof | yes | reuse |
| State transitions | session DRAFT → PUBLISHED | REQUIRED_FOR_PRODUCTION |
| Duplicate actions | client double-click | REQUIRED_FOR_PRODUCTION (Idempotency-Key) |
| Fresh DB | none | REQUIRED_FOR_PRODUCTION |
| Existing-DB migration | none | REQUIRED_FOR_PRODUCTION |
| Restart | none | REQUIRED_FOR_PRODUCTION |
| Direct route | yes | reuse |
| Refresh | session | REQUIRED_FOR_PRODUCTION (server) |
| Desktop 1440 | yes | reuse |
| Tablet 1024 | none (768 used) | NOT_REQUIRED (PROCESS V2 uses 1440 / 768 / 390) |
| Mobile 390 / 768 | yes | reuse |
| Pixel | primitives only, no WF04 reference | REQUIRED_FOR_PRODUCTION once a reference is approved |
| Console | yes (`afterEach`) | reuse |
| Hydration #418 | implicit only | REQUIRED_FOR_PRODUCTION (explicit) |
| 5xx | one stubbed 500 (S01) | REQUIRED_FOR_PRODUCTION (route sweep) |

## 13. Business Decisions Required

| # | Decision | Why | Evidence |
|---|---|---|---|
| 1 | Promote WF04 at all, and which flow nodes (List, Create/Basic, Journey, Events, Registration, Team, Review/Publish, Manage/Monitor, Detail) become production | a real operator workflow "needs its own approved design and business contract" | DEC-2909-L4H2 (DL:1301); `CLAUDE.md:34`; PROCESS V2 §A/§J |
| 2 | Who may create, edit, publish: leader / admin (DEC-WF04-H2 demo) or programme-scoped organizer (SOT:161; A03:139); capability names | no write capability exists | HD-A4 open; `matrix.ts:22-32` |
| 3 | Production lifecycle: CLOSED / ARCHIVED in scope? who triggers? edits after publish? unpublish? | SOT has CLOSED, DB does not; demo edits PUBLISHED freely | SOT:209-210; M001:12; DL:1027 |
| 4 | Production publish rule (H5 is "not a production rule") | publish gating | DL:1014, 1108 |
| 5 | Journey stages as canonical data, and their shape | demo-only today | DEC-WF04-H3 (DL:1025) |
| 6 | Challenge problem statements: entity? relation to the Library "Bài toán" dataset? | risk of two problem models | DEC-WF04-H4 (DL:1026); DL:1346 |
| 7 | Operating team: activate PROGRAMME_ORGANIZER? scope store (`role_assignments` PROGRAMME vs `programme_role_assignments`)? invite flow? | display only today | DEC-WF04-H2 / S06; A03:85-93; A04:449-475 |
| 8 | Responsible organizations: single owner or ProgrammeOrganizationRelationship (co-organizer, challenge owner) | SOT vs schema conflict | SOT:142; M001:271; API:849 |
| 9 | Programme-linked events: may the WF03 event service create them, under which scope rule? (changes a protected WF03 rule) | WF03 refuses `programme_id` | `src/lib/ops/events.ts:195-200`; API:904; DL:847,961 |
| 10 | Registration config: INDIVIDUAL applicant type; operator-editable question shape (required, step); edits after applications exist | demo vs DB shapes differ | DL:1086,1144; M013:27 |
| 11 | Manage / Monitor content (real counts from `applications`; review is FUTURE) | MS:142 node has no content | DEC-WF04-S08-D1 (DL:1118) |
| 12 | Public surface: `/programmes` directory (HD-A6), public detail (L28 FUTURE), homepage "Triển khai chương trình" (DEC-P3UX-D7) | CTA and route undecided | `human-decisions.md:13`; DL:1300,1527 |
| 13 | Seeded "(demo)" programme `d4…0001` in production: keep as a real programme, rename, or retire; tag / isolation | A01:205; conflict C-12 | SEED:274-292; MANIFEST:16-26 |
| 14 | Approved WF04 visual reference (or approve the demo screens as the reference) | no pixel baseline | `WF04_EXTERNAL_REFERENCE.md:24` |
| 15 | Contract housekeeping: `CLAUDE.md` §2 wording (C-05), API §8.4 WF03-S05 bridge vs DEC-WF03-G12, endpoint namespace (A04:234), stale WF04 closure audit (C-13), DEC-WF05-G3 not marked superseded | documents disagree | `scope-refreeze/conflict-audit.md:11,18-19`; DL:765,1143 |

## 14. Proposed Production Hardening Tasks

| Task | Objective | Likely files / modules | Depends on | Acceptance criteria | Tests | STOP gate |
|---|---|---|---|---|---|---|
| WF04-PROD-01 Freeze production contract | PO decision packet for §13 #1–#15; frozen business, data, API, RBAC, lifecycle and design contract | `docs/decisions`, `docs/architecture/05_API_*`, DB schema doc, new WF04 production contract doc | none | every §6 UNDEFINED cell decided; lifecycle and capabilities named; approved visual reference chosen | none (documents) | STOP until the PO approves the packet (PROCESS V2 §A/§C) |
| WF04-PROD-02 DB / persistence | additive migration(s) for the decided model only; seed separation | `db/migrations/015_*`, `db/seed/*`, `src/lib/db/schema.db-test.ts` | PROD-01 | fresh DB and existing DB migrate cleanly; no duplicate domain table; `d4…0001` handled per decision #13 | migration + fresh-DB + seed tests | STOP if a decided entity collides with WF03 / WF05 tables |
| WF04-PROD-03 API / RBAC / validation | canonical programme endpoints; new capabilities in the matrix; server validation, state rules, audit, Idempotency-Key; WF03 event link if decided | `src/app/api/v1/programmes/**` (or decided namespace), `src/lib/authz/matrix.ts`, `src/lib/audit/audit.ts`, `src/lib/api/idempotency.ts`, `src/lib/ops/events.ts` (only if #9) | PROD-01, PROD-02 | every action in §5 is server-enforced; same 404 for out-of-scope; 409 on invalid transition | API, authz, IDOR, spoof, idempotency, DB tests | STOP if WF01–WF03 regression is not green |
| WF04-PROD-04 Frontend fixture → real API | swap `sessionStorage` + fixture for the API; remove demo notice, reset and "(demo)" copy; keep screens | `src/components/programme-demo/**` (renamed), `src/lib/programme-demo/**`, routes under the decided path | PROD-03 | no fixture read in production code; refresh / logout / restart keep data; UI unchanged except real states | rewritten S01–S08 + UAT (fingerprint asserts replaced by expected writes) | STOP on any approved-UI change beyond states |
| WF04-PROD-05 Functional / security QA | full negative, IDOR, spoof, unauthorized-write, duplicate and state tests; WF05 tests that read the shared row | `tests/visual/specs/wf04-*`, `wf05-*`, `internal-alpha-release` | PROD-04 | all §12 REQUIRED rows covered | the suite itself | STOP on any 5xx, #418 or authz failure |
| WF04-PROD-06 Pixel / responsive regression | baseline against the approved reference at 1440 / 768 / 390 | WF04 visual specs | PROD-01 (reference), PROD-04 | P0–P2 mismatches fixed; no baseline overwritten | pixel + responsive | STOP if the reference is not approved (merge into PROD-05 if the demo screens are approved as-is) |
| WF04-PROD-07 Production readiness closure | closing gate (PROCESS V2 §I): completion audit, UAT, invariants, security, pixel, fresh DB / migration / restart, deploy exact SHA | reports, `P0_STATUS.md`, release manifest | PROD-02…06 | GREEN closing verdict | full regression (workflow closes) | STOP before deploy for PO approval |

## Related
- [INTERACTION_ACTION_REGISTRY.md](INTERACTION_ACTION_REGISTRY.md) · [WF04_COMPLETION_AUDIT.md](WF04_COMPLETION_AUDIT.md) · [../WF04_DEMO_SCOPE.md](../WF04_DEMO_SCOPE.md) · [../PROCESS_P0_ACCELERATED_SAFE_V2.md](../PROCESS_P0_ACCELERATED_SAFE_V2.md) · [../../design-revision/scope-refreeze/human-decisions.md](../../design-revision/scope-refreeze/human-decisions.md)
