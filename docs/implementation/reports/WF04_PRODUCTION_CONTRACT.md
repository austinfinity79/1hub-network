# WF04 Production Contract

**WF04-PROD-01 — FREEZE PRODUCTION CONTRACT.** 2026-10-01, baseline `78f21f2`. Documentation only: no runtime code, migration, endpoint, production change, push or deploy. Input: the accepted [WF04 production gap matrix](WF04_PRODUCTION_GAP_MATRIX.md) and the PO / architecture decisions of 01/10, recorded as [DEC-W4P](../../decisions/DECISION_LOG.md#dec-w4p). This contract drives WF04-PROD-02 … PROD-07; anything it does not freeze is listed in §19 and may not be inferred.

Status words: **FROZEN** (decided, implement as written) · **MISSING_BUSINESS_DECISION** (open, §19) · **DEFERRED** (out of production v1).

## 1. Production Scope
Production v1 hardens only what the approved WF04 demo already does (DEC-W4P-D01), with real data, server authorization, lifecycle and persistence:

| Flow node (MS:129-144) | Demo screen | Production v1 |
|---|---|---|
| List | S01 | FROZEN: real programmes in the actor's scope |
| Create + basic information | S02, S08-BASIC | FROZEN: create DRAFT; edit name, summary, dates |
| Structure & journey | S03 stages | FROZEN: ordered stage list (DEC-WF04-H3 shape), persisted (§3) |
| Challenge "Bài toán" | S03 problems | FROZEN: inline {title, summary} list for CHALLENGE, persisted (§3) |
| Events | S04 | read-only reference FROZEN (§10); add / edit / delete MISSING_BUSINESS_DECISION (Q1) |
| Registration / participation | S05 | FROZEN: writes the canonical form (§9); field mapping Q3 |
| Operating team | S06 | content MISSING_BUSINESS_DECISION (Q4) |
| Review + publish | S07 | FROZEN: DRAFT → PUBLISHED with the §8 rules |
| Manage / monitor + detail | S08 | FROZEN: detail as today; counts Q5 |
| Member action (apply) | — (WF05) | FROZEN: canonical L5 application (API §21), unchanged |

## 2. Out of Scope
DEFERRED for v1: public `/programmes` directory (HD-A6) and public / Challenge detail pages (L28–L36, DEC-2909-L4H1); `/programmes/create` and its no-permission state (HD-A4 public CTA, C-14); homepage "Triển khai chương trình" (DEC-P3UX-D7); PROGRAMME_ORGANIZER or any new role (D02); ProgrammeOrganizationRelationship, co-host governance (D03); application review, judging, mentor, challenge-owner flows (API §15, A03:85-93); event registration, participation, outcomes; Library "Bài toán" link (§3); unpublish; delete; metrics / analytics / notifications; WF05 / WF06 changes; any redesign (D08).

## 3. Canonical Domain Model
One `Programme` aggregate, `programme_type = PROGRAMME | CHALLENGE` (FRZ D1 ACCEPTED; A02 §2.5). No ProgrammeV2, ChallengeV2, ProblemV2 or WF04Application.

| Concept | Canonical entity (reuse) | Storage |
|---|---|---|
| Programme / Challenge | `Programme` | `programmes` row (M001:269-283) |
| Stages (journey) | child content of the Programme aggregate (FRZ D1 "Structure / Journey") | `programmes.metadata.journey` (validated JSON, no table) |
| Problem statements | **Option A — reuse the Programme aggregate**: type-specific child content of a CHALLENGE (FRZ D1 "challenge-only children … may be added later") | `programmes.metadata.challenge` (validated JSON, no table) |
| Registration configuration | canonical form (DEC-L5, HD-A12) | `programme_application_forms` (M013:29-38) |
| Application | canonical L5 Application (API §21) | `applications` (M013:40-82) — WF04 never writes it |
| Event | canonical Event (SOT §4) | `events` with `programme_id` (M001:285-301) — read only from WF04 (§10) |
| Owning organization | `Organization` | `organizations` |
| Operators | existing role assignments (D02) | `role_assignments` |

Challenge decision (D06): **A**. B is impossible: the Library "Bài toán" set is a static supplied file (`src/lib/library/dir-bai-toan.json`, DEC-L15-D9) with no table, owner or lifecycle in our system, so a Programme cannot relate to it canonically. C is not needed: the approved behaviour is an inline {title, summary} list with no review, scoring, lifecycle or external reference (DEC-WF04-H4), which the aggregate holds. A dedicated `ProblemStatement` child table stays the SOT's later path (FRZ D1) when a reference to a problem is needed.

## 4. Ownership
FROZEN (D03, A02 §2.5 invariant): exactly one canonical owning organization, `programmes.organization_id`, NOT NULL from PROD-02; type HUB, CHAPTER or CLB (DEC-WF04-S02-D2); chosen at create from the actor's scope; immutable afterwards (no ownership transfer is defined, DEC-WF04-S08-D2); `programme_type` immutable (DEC-WF04-S02-D1). Authorization reads only this column. Co-host / partner names, if any, are content and grant nothing. API §8.4 `relationship` is not produced in v1.

## 5. Actor/RBAC Matrix
Existing roles only (A03 §4 P0: `HUB_COMMUNITY_LEADER`, `PLATFORM_ADMIN`). D02 holds against the SOT: SOT:161 governs the permissions of `PROGRAMME_ORGANIZER`, a role "designed now, activated later" (A03 §4), and no SOT gives programme management to that role in P0; the leader's right comes from a RoleAssignment, not from membership. New capability **`programme:manage`** (write), same shape as `org:manage` / `event:manage` (matrix "resource:action", DECISION-AUTHZ-01B amendment): `HUB_COMMUNITY_LEADER` at ORGANIZATION scope = the owning organization (ACTIVE assignment, exact, no inheritance), `PLATFORM_ADMIN` platform-wide.

| Capability | Guest | Member (INDIVIDUAL_USER, HUB_MEMBER) | HUB_COMMUNITY_LEADER of the owning org | PLATFORM_ADMIN |
|---|---|---|---|---|
| Public programme list | DEFERRED | DEFERRED | DEFERRED | DEFERRED |
| Operator list | DENY 401 | DENY 403 / 404 | ALLOW, own orgs (`programme:read`) | ALLOW (`programme:read`) |
| Programme detail (operator) | DENY 401 / `/auth` | DENY 404 | ALLOW in scope; else the same 404 | ALLOW |
| Create | DENY | DENY | ALLOW for an owning org in scope (`programme:manage`) | ALLOW (HUB / CHAPTER / CLB) |
| Edit (basic, journey, problems, registration) | DENY | DENY | ALLOW (`programme:manage`) | ALLOW |
| Publish | DENY | DENY | ALLOW (`programme:manage`) | ALLOW |
| Close (archive DEFERRED, DEC-W4P-D11) | DENY | DENY | ALLOW (`programme:manage`, DEC-W4P-D12) | ALLOW (DEC-W4P-D12) |
| Challenge manage (problem statements) | DENY | DENY | ALLOW (`programme:manage`, CHALLENGE only) | ALLOW |
| Apply / register | DENY 401 | owner of an eligible venture (API §21, relation rule) | as member | as member |
| Read applications | DENY | own only (API §21) | DENY (HD-A13) | DENY (HD-A13) |

Every write re-checks session, onboarding DONE, `programme:manage` on the stored owning organization, and lifecycle. Role, scope or organization from headers, query, body or client state is never authoritative (C-14 and DEC-WF04-H2 precedent).

## 6. Programme Lifecycle
| State | SOT | API | DB | UI | Tests | Keep in production? |
|---|---|---|---|---|---|---|
| DRAFT | SOT:209-210 | §8.4 DTO `status` | `publication_status` (M001:12) | demo create | S02, S07, UAT | Yes |
| PUBLISHED | yes | §8.4, §21 (apply needs it) | yes | demo publish | S07, S08, UAT | Yes |
| CLOSED | yes | none (DEC-L5-D3 cites "programme closed" 409; §21 returns 404 for non-PUBLISHED) | `programme_status` (M015, PROD-02; was missing, gap D1) | constant only (`types.ts:25`) | DB only (PROD-02) | Yes, approved P0 state (DEC-W4P-D11); transition Q2 |
| ARCHIVED | yes | none | yes since M001 (`publication_status`), carried over by M015 for compatibility only | constant only | none | **DEFERRED** (DEC-W4P-D11): not approved for this release; no transition, API, UI or filtering |

| From | To | Actor | Rule | API | Persistence |
|---|---|---|---|---|---|
| — | DRAFT | `programme:manage` on the chosen owning org | §8 create validation | `POST /api/v1/programmes` | row, audit |
| DRAFT | PUBLISHED | `programme:manage` on the owning org | §8 publish rules; atomic, row-locked; repeat → 409 | `POST /api/v1/programmes/{id}/publish` | status, audit `PROGRAMME_PUBLISHED` |
| PUBLISHED | DRAFT | — | no transition in SOT or demo: always 409 | — | — |
| PUBLISHED | CLOSED | `programme:manage` on the owning org | DEC-W4P-D12; atomic, row-locked; repeat → 409 | `POST /api/v1/programmes/{id}/close` | status, audit `PROGRAMME_CLOSED` |
| CLOSED / PUBLISHED / DRAFT | ARCHIVED | — | DEFERRED (DEC-W4P-D11) | — | — |

PO lifecycle clarification of 02/10 ([DEC-W4P-D11](../../decisions/DECISION_LOG.md#dec-w4p-d11)): CLOSED is approved for P0; **ARCHIVED = DEFERRED**. ARCHIVED stays in the DB only because the column has accepted it since M001; it is not added for WF04 and nothing writes or reads it.

Edits in DRAFT and PUBLISHED are allowed as in the approved demo (basic, journey, problems); type and owner never. Registration edits on a programme that already has applications: Q3.

## 7. Challenge Lifecycle
A Challenge is a Programme with `programme_type = CHALLENGE`: the §6 lifecycle, actors and rules apply unchanged (FRZ D1, A02 §2.5). Problem statements have no lifecycle (DEC-WF04-H4) and are edited only while the Challenge is DRAFT or PUBLISHED.

## 8. Publish Rules
| Class | Rule | Source |
|---|---|---|
| REQUIRED BY EXISTING SOT | an owning organization exists | A02 §2.5 invariant |
| REQUIRED BY EXISTING SOT | DRAFT → PUBLISHED only | SOT:209-210 |
| TECHNICALLY REQUIRED | session + onboarding DONE + `programme:manage` on the stored owning org | D02, §5 |
| TECHNICALLY REQUIRED | the programme exists and is in scope, else the same 404 | DEC-WF04-T00-D2; API §21 |
| TECHNICALLY REQUIRED | status is DRAFT, else 409 | API HTTP map |
| TECHNICALLY REQUIRED | name non-blank, type valid, end ≥ start when both dates are set | `programmes.name` NOT NULL; enum; canonical Event rule (DEC-WF03-S07) used by DEC-WF04-H5 |
| DEMO-ONLY | CHALLENGE needs ≥ 1 problem statement | DEC-WF04-H5 / S07-D1, "not a production rule" (DL:1014) — Q7 |
| UNDEFINED | dates required? stages required? a registration form required before publish (without one, WF05 cannot open the apply form, API §21)? | Q7 |

A failed rule returns 422 with each failing item; the S07 checklist shows the server's result.

## 9. Application/Registration Integration
FROZEN (D05): WF04 writes only the canonical registration configuration `programme_application_forms` (applicant types, questions, `version`); applications stay WF05's (API §21), unchanged, never written by WF04. A change bumps `version`; drafts keep `question_set_version`, submitted snapshots are untouched (M013, §21.2). Publishing a programme with a form makes it open to WF05's apply flow by data, with no WF05 code change.

Conflicts for PO review (Q3): (a) the demo offers INDIVIDUAL; canonical `applicant_type` is TEAM / STARTUP and INDIVIDUAL is FUTURE (DEC-WF05-G4, M013:27) — v1 default canonical; (b) demo questions are plain text, canonical questions need `required` and `step` (1–4) — no default may be invented; (c) editing questions after applications exist. Counts (Q5): the demo's fixture counts (UNDER_REVIEW, NEEDS_UPDATE …) cannot exist (`application_status` = DRAFT / SUBMITTED); operator reading of applications is DENY (HD-A13).

## 10. Event Boundary
FROZEN (D07): the approved relationship is `events.programme_id` (SOT §4, DB M001:288, API "if linked to Programme…"). WF04 reads events of a programme (`programme_id = id`) read-only in its detail and S04. WF04 does not copy the Event lifecycle, does not create, edit, publish or delete events, and does not change WF03 authorization, persistence or the WF03 rule that refuses `programme_id` on create (`src/lib/ops/events.ts:195-200`). The demo's S04 add / edit / delete therefore has no production path without a separate decision (Q1).

## 11. Data Contract
| Relation | Table / key | Cardinality | Ownership | Visibility | Migration |
|---|---|---|---|---|---|
| Organization → Programme | `programmes.organization_id` → `organizations.id` | 1 – * | owning org | operator: `programme:read` | NOT NULL + check (PROD-02) |
| Programme status | `programmes.status` | 1 | aggregate | as programme | new `programme_status` enum DRAFT / PUBLISHED / CLOSED; ARCHIVED only carried over from `publication_status` for compatibility, DEFERRED (DEC-W4P-D11) (M015; `publication_status` stays for organizations) |
| Programme dates | `starts_at`, `ends_at` | 1 | aggregate | as programme | CHECK `ends_at >= starts_at` when both set (PROD-02) |
| Programme → stages | `programmes.metadata.journey` `{schema_version 1, stages [{id, position, name, summary, starts_on, ends_on}]}` | 1 – * | aggregate | operator | none |
| Challenge → problem statements | `programmes.metadata.challenge` `{schema_version 1, problem_statements [{id, title, summary}]}` | 1 – * | aggregate (CHALLENGE only) | operator | none |
| Programme → registration form | `programme_application_forms.programme_id` (PK) | 1 – 0..1 | aggregate | operator; members via §21 when PUBLISHED | none (INDIVIDUAL only if Q3 adds it) |
| Programme → Application | `applications.programme_id` | 1 – * | WF05 | owner only (HD-A13) | none |
| Application → Venture | `applications.venture_id` → `projects.id` | * – 1 | WF02 / WF05 | owner only | none |
| Programme → Event | `events.programme_id` | 1 – * | WF03 / Event | read-only in WF04 | none |
| Operators | `role_assignments` (HUB_COMMUNITY_LEADER, ORGANIZATION, owning org) | * | WF03 | — | none |
| Audit | `audit_events` `resource_type = 'programme'` | 1 – * | platform | platform audit | none |

`programmes.slug` stays globally unique, server-generated, never user-edited, not used in routes. Programme ids are server UUIDs; the demo id range `d40…` is not special in production.

## 12. API Contract
Proposed **Amendment A5** to `05_API_CONTRACT_P0` (supersedes §15 for the v1 scope only; judging and review stay out), canonical `/api/v1/programmes` per A04:234, frozen envelope and errors.

| Capability | Existing API | Reuse | Change required | New endpoint required? |
|---|---|---|---|---|
| List (operator) | `GET /api/v1/demo/programmes` (fixture) | envelope, DTO shape (DEC-WF04-T00-D2), scope rule | read `programmes`; same 401 / 403 | Yes: `GET /programmes` |
| Detail | `GET /api/v1/demo/programmes/{id}` | DTO, same-404 rule | read row + form + linked events; malformed id → 404 (fix `URIError`) | Yes: `GET /programmes/{id}` |
| Create | none | validation of DEC-WF04-S02-D1 | `programme:manage`; Idempotency-Key `programme.create`; audit | Yes: `POST /programmes` |
| Edit basic / journey / problems | none | pure edit rules (`basic-info.ts`, `journey.ts`) moved server-side | whole-list replacement for `stages` / `problem_statements`; type and owner refused (400 `not_accepted`) | Yes: `PATCH /programmes/{id}` |
| Registration | WF05 reads the form only | `programme_application_forms` | write + version bump; Q3 mapping | Yes: `PUT /programmes/{id}/registration` |
| Publish | none | `publishProgramme` checklist as §8 | row lock, state check, Idempotency-Key `programme.publish`, audit | Yes: `POST /programmes/{id}/publish` |
| Events (read) | WF03 `GET /ops/organizations/{orgId}/events` (standalone only) | EventDTO | none: included read-only in the detail | No |
| Close | none | — | row lock, state check, Idempotency-Key `programme.close`, audit (DEC-W4P-D12) | Yes: `POST /programmes/{id}/close` |
| Events (write), team | — | — | — | Q1, Q4 (archive DEFERRED, DEC-W4P-D11) |
| Unit list (WF03-S05) | `GET /ops/organizations/{orgId}/programmes` (contract, no handler) | — | stays FUTURE (DEC-WF03-G12) | No |
| Demo API | `/api/v1/demo/programmes*` | — | removed from production runtime (D09); test / local only | — |

PROD-03 status: A5 implemented as `/api/v1/programmes*` ([05 §22](../../architecture/05_API_CONTRACT_P0_v1.0.md)); field refusals use the ops convention, 422 `PROFILE_VALIDATION_FAILED` with `not_accepted` / `immutable` (DEC-W4P-D12), not 400. The demo API stays until PROD-04.

## 13. Security Contract
FROZEN technical decisions T1–T11 (DEC-W4P): server-side authorization on every write; scope injected from the stored owning organization; same 404 for unknown, malformed, out-of-scope ids (no existence leak, no 500); IDOR, role / header spoofing and cross-organization writes rejected; invalid transitions rejected server-side (409); validation server-side (400 / 422); no client role, scope or org is authoritative; application data never exposed to operators (HD-A13); fixtures never reachable in production; demo `sessionStorage` key no longer written.

## 14. Audit/Idempotency Contract
Existing convention (`src/lib/audit/audit.ts`, API §2.3, `src/lib/api/idempotency.ts`):

| Action | Audit action (new) | Idempotency |
|---|---|---|
| Create | `PROGRAMME_CREATED` | required: `programme.create` |
| Edit basic / journey / problems | `PROGRAMME_UPDATED` (changed field names, no content) | not required (whole replacement is repeat-safe) |
| Registration | `PROGRAMME_REGISTRATION_UPDATED` (version) | not required (replacement) |
| Publish | `PROGRAMME_PUBLISHED` (= domain event `ProgrammePublished`, A02:253) | required: `programme.publish`; second publish → 409 |
| Close (DEC-W4P-D12) | `PROGRAMME_CLOSED` | `programme.close`; second close → 409 |

Audit stores ids, status and versions, never free text. Concurrent content edits: last write wins; transitions are row-locked with an expected state.

## 15. Fixture/Seed Policy
FROZEN (D09): production runtime reads no fixture (`src/lib/programme-demo/fixtures.ts`, the `d40…` checks, the session store). Fixtures stay for unit / visual tests and local deterministic demo only. The deterministic seed (`seed_p0_deterministic.sql`) is local / CI only; production never runs it. Production already holds `d4000000-…-0001` and its form (DEP-1): it becomes an ordinary programme of Chapter 01 in v1; its "(demo)" name and any retirement is Q8. The CHALLENGE fixture `d4…0002` exists only in tests.

## 16. Required Production States
Only these may be added to the approved screens (D08): loading; empty; validation (server 400 / 422 mapped to fields and checklist); API error with retry (including a 409 such as already published); permission denied (the existing 404 pattern for operator routes); disabled (in-flight, publish blocked). Removed: the "Dữ liệu demo · Internal Alpha" notice, "Đặt lại demo" and "(demo)" copy. No visual redesign.

## 17. Test Acceptance Criteria
| Area | Must pass |
|---|---|
| Persistence | create / edit / publish survive refresh, logout + login, another browser, server restart |
| Fresh DB / migration | migrate from empty and from the current production schema; seed; rollback / recovery note per migration |
| Authorization | 6 actors × every route and API; `programme:manage` vs `programme:read`; foreign org; header / query / body spoofing |
| IDOR | foreign, unknown, malformed (incl. bad `%`) ids → same 404, never 500 |
| Lifecycle | create → DRAFT; publish once; repeat → 409; unpublish refused; type / owner change refused |
| Idempotency | same key replays; double click creates / publishes once |
| Audit | one row per write with the §14 action |
| Integration | a published programme with a form appears in WF05's apply flow; WF05 L5 suite green |
| Protected | WF01–WF03 regression and WF05 suite green; WF03 events untouched |
| Runtime | hydration #418 = 0, console = 0, 5xx = 0 on every WF04 route; 1440 / 768 / 390 |
| Rewrites | specs asserting "nothing written" (T00–S08, UAT, `read-model.db-test`, WF05 equality tests, `internal-alpha-release` table list) rewritten to the expected writes, not deleted |

## 18. Document Supersession Matrix
Historical records are not rewritten; each row is a proposal the owner applies when the matching task runs.

| Document / Decision | Old statement | Current authority | Action |
|---|---|---|---|
| `CLAUDE.md` §2 | "WF04/WF05 are demo-only unless explicitly promoted" | DEC-W4P-D01 (WF04 promoted, 01/10) | owner updates the wording (C-05) |
| API §15 | "full WF04 Programme creation/configuration/judging lifecycle" out of P0 | DEC-W4P-D01 + §12 Amendment A5 | add A5 in PROD-03; judging stays out |
| API §2.3 | idempotency list | §14 | add `programme.create`, `programme.publish` (A5) |
| API §8.4 | WF03-S05 unit list with `relationship` | DEC-WF03-G12 (FUTURE) + §4 | stays FUTURE |
| A04:234 | move demo endpoints to canonical `/programmes` | — | adopted (§12) |
| Matrix (DECISION-AUTHZ-01B) | `programme:read` only | §5 | add `programme:manage` (doc + code + test) in PROD-03 |
| DEC-2909-L4H2 | real operator workflow needs its own approved design and business contract | this contract + DEC-W4P-D08 | satisfied on PO approval of this contract |
| DEC-WF04-H1 | no pixel parity; INTENTIONAL-DEMO | DEC-W4P-D08 (current UI is the baseline) | pixel reference method: Q9 |
| DEC-WF04-H3 / H4 | stages / problems demo-only; no entity, table or migration | §3 (persisted in the aggregate, still no table) | mark superseded for production |
| DEC-WF04-H5, S07-D1 | demo publish checklist | §8 | mark superseded; CHALLENGE ≥ 1 problem → Q7 |
| DEC-WF04-T00-D1 / D2 / D3, S02-D4 | fixture, demo API, session store, demo ids and slugs | DEC-W4P-D09, §12, §15 | mark superseded for production; kept for tests / local |
| DEC-WF04-S04-D1 / D2 | demo events in the session only | DEC-W4P-D07, §10 | read-only reference; writes Q1 |
| DEC-WF04-S05-D1 | INDIVIDUAL / TEAM / STARTUP; plain-text questions | DEC-W4P-D05, §9 | conflict Q3 |
| DEC-WF04-S06-D1 | fixture team rows | DEC-W4P-D02 | content Q4 |
| DEC-WF05-G3 | WF05 reads the WF04 fixture | HD-A12 / DEC-L5 (DB row) | mark superseded (not marked today) |
| `WF04_COMPLETION_AUDIT.md` | "every other `/programmes*` is 404", "no `applications` table" | DEC-L5, M013 (C-13) | annotate as superseded |
| M013 header, seed comment | form "read-only in Alpha"; "the operator demo … never writes here" | §9, §15 | historical; superseded in production |
| `DB_SCHEMA_GAPS_P0` D1 | `programme_status` missing CLOSED, DEFERRED | §6, §11 | resolved in PROD-02 |
| SOT:161 | organizer permissions are programme-scoped | DEC-W4P-D02 (role not active in P0) | no conflict; programme-scoped roles additive later |
| homepage CTA map `/programmes`, `/programmes/create`; HD-A4 / HD-A6 | targets for the public CTAs | DEC-AIG-D1, DEC-P3UX-D7, DEC-W4P-D10 | stay DEFERRED |

## 19. Remaining PO Decisions
**BLOCKING (before PROD-02): none.** PROD-02 needs no open answer: the status enum aligns with the SOT, the owner and date constraints follow existing invariants, and stages / problems need no table.

| # | Decision | Class | Must be decided before |
|---|---|---|---|
| Q1 | S04 programme events: extend the WF03 event service to accept `programme_id` under a WF04 scope rule (changes a protected WF03 rule), or keep S04 read-only in v1 (removes its add / edit / delete) | NON_BLOCKING | PROD-03 |
| Q2 | Close in v1: actor and rules of PUBLISHED → CLOSED (the CLOSED state is approved, DEC-W4P-D11), discarding a DRAFT (no demo behaviour exists); archive is DEFERRED | **CLOSED for close** by DEC-W4P-D12; discarding a DRAFT stays open | PROD-03 |
| Q3 | Registration mapping: `required` and `step` for operator questions; INDIVIDUAL (default canonical TEAM / STARTUP); question edits once applications exist | NON_BLOCKING | PROD-03 |
| Q4 | S06 content without a programme role: read-only list of the owning org's leaders, or an empty / hidden step | NON_BLOCKING | PROD-04 |
| Q5 | Operator application counts (DRAFT / SUBMITTED aggregates) or none (HD-A13) | NON_BLOCKING | PROD-04 |
| Q6 | Production page routes for the operator screens (today `/demo/programmes/*`) | NON_BLOCKING | PROD-04 |
| Q7 | Publish extras: CHALLENGE ≥ 1 problem; dates, stages or a form required? | **CLOSED** by DEC-W4P-D12: none | PROD-03 |
| Q8 | Production row `d4…0001` "(demo)": keep, rename or retire | NON_BLOCKING | PROD-07 |
| Q9 | Pixel reference: `CLAUDE.md` §5 allows `design-reference/final` only, which has no WF04 frame; D08 makes the current UI the baseline | NON_BLOCKING | PROD-06 |
| Q10 | Owner approval of the §18 document updates (CLAUDE.md §2, API A5, matrix amendment) | NON_BLOCKING | PROD-03 |

DEFERRED: §2 list.

## 20. PROD-02 → PROD-07 execution plan
| Task | Objective | Depends on | STOP gate |
|---|---|---|---|
| PROD-02 DB / persistence | migration `015_p0_programme_production.sql`: `programme_status` enum (DRAFT, PUBLISHED, CLOSED; ARCHIVED only carried over for compatibility, DEFERRED, DEC-W4P-D11) and `programmes.status` converted with existing values; `organization_id` NOT NULL after a data check; `ends_at >= starts_at` CHECK; documented `metadata.journey` / `metadata.challenge` schema (no table); test data through the API or a test-only seed block (never production); schema DB tests; rollback note | PO approval of this contract | any existing row violating a new constraint; any WF03 / WF05 table touched |
| PROD-03 API / RBAC / validation | A5 endpoints; `programme:manage` in matrix doc, code, test; audit and idempotency (§14); server rules from `basic-info`, `journey`, `registration`, `readiness`; malformed-id 404; Q1 / Q2 / Q3 / Q7 applied | PROD-02, Q1–Q3, Q7, Q10 | WF01–WF03 regression not green |
| PROD-04 Frontend fixture → API | screens read / write the API; demo frame, reset and session store removed; §16 states; Q4–Q6 | PROD-03 | any approved-UI change beyond §16 |
| PROD-05 Functional / security QA | §17 rows; rewritten "nothing written" specs; WF05 suite | PROD-04 | any 5xx, #418, authz or IDOR failure |
| PROD-06 Pixel / responsive | method per Q9; 1440 / 768 / 390 | PROD-04, Q9 | baseline overwritten or P0–P2 mismatch |
| PROD-07 Readiness closure | PROCESS V2 §I closing gate; Q8; release manifest; exact-SHA deploy after PO approval | PROD-02…06 | no GREEN verdict |

## Related
- [WF04_PRODUCTION_GAP_MATRIX.md](WF04_PRODUCTION_GAP_MATRIX.md) · [DEC-W4P](../../decisions/DECISION_LOG.md#dec-w4p) · [../PROCESS_P0_ACCELERATED_SAFE_V2.md](../PROCESS_P0_ACCELERATED_SAFE_V2.md) · [../../architecture/05_API_CONTRACT_P0_v1.0.md](../../architecture/05_API_CONTRACT_P0_v1.0.md)
