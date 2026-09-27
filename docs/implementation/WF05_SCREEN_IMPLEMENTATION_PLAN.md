# WF05 Screen Implementation Plan

**Status: FROZEN** by [DEC-WF05-G1..G5](../decisions/DECISION_LOG.md#dec-wf05-g1); **T00 DONE** ([DEC-WF05-T00-D1..D3](../decisions/DECISION_LOG.md#dec-wf05-t00-d1), [report](reports/WF05-T00_demo-foundation.md)); **S01 DONE** ([report](reports/WF05-S01_my-projects.md)); **S02 DONE** ([report](reports/WF05-S02_project-detail.md)); **S03 DONE** ([report](reports/WF05-S03_application-draft.md)); **S04 DONE** ([report](reports/WF05-S04_review-submit.md)). Every executable screen is built. **Closure DONE — GREEN: WF05 PROTECTED / CLOSED / GREEN** ([audit](reports/WF05_COMPLETION_AUDIT.md), [UAT](WF05_UAT_MATRIX.md)). WF05 = DEMO. Audit: [WF05_PREIMPLEMENTATION_AUDIT.md](WF05_PREIMPLEMENTATION_AUDIT.md). Process: [PROCESS-P0-ACCELERATED-SAFE-V2](PROCESS_P0_ACCELERATED_SAFE_V2.md). Estimate: **4 executable screens, 6 tasks** (T00, S01–S04, closure).

## Journey classification
| Step | Class | Where |
|---|---|---|
| Member creates / edits the canonical Project / Startup | SUPPORTING | WF02-S05 as is |
| Owner manages the team | SUPPORTING | WF02-S06 as is |
| Founder sees their ventures and open programmes | EXECUTABLE (DEMO) | WF05-S01 |
| Venture profile / participation detail | EXECUTABLE (DEMO) | WF05-S02 |
| Apply to a programme reusing the canonical venture | EXECUTABLE (DEMO) (DEC-WF05-G3..G5) | WF05-S03, S04 |
| Review, selection, participation, outcome, achievements, timeline | FUTURE | — |
| Solution profile / "nộp giải pháp" | FUTURE | — |
| Investor, data room, fundraising, mentor, judge | OUT OF SCOPE (SOT §14) | — |

## Screen inventory
| ID | Purpose | Actor | Route | Design | Entities | Read model / API | Class | Decisions (frozen) |
|---|---|---|---|---|---|---|---|---|
| WF05-S01 | My ventures (owner / member), open programmes, my demo applications | Onboarded member | `/demo/projects` | G1 composed (WF02-S01 cards, WF04 DemoPage) | Venture, team relation, Programme, Application | `GET /api/v1/demo/projects` + session | DEMO | G1–G3 |
| WF05-S02 | Venture participation detail: canonical summary, team summary, eligible programmes, applications | Owner, ACTIVE member | `/demo/projects/:id` | G1 composed (PRO1 header, PRO3 table) | Venture, `project_members`, Programme, Application | `GET /api/v1/demo/projects/{id}` + session | DEMO | G1–G4 |
| WF05-S03 | Application draft: applicant = the venture (reference), programme-specific answers | Owner | `/demo/projects/:id/applications/:programmeId` | G1 composed (WF04-S05 question form) | Application, Venture ref, Programme | same + session | DEMO | G1, G4, G5 |
| WF05-S04 | Review checklist + submit (DRAFT → SUBMITTED), then read-only | Owner | `…/applications/:programmeId/review` | G1 composed (WF04-S07 checklist) | Application | session | DEMO | G1, G5 |
| — | Create / edit venture; team | Owner / member | `/projects/new`, `/projects/:id/edit`, `/projects/:id/team` | WF02-S05 PRO1, WF02-S06 PRO3 (approved) | Venture, team | `/ventures*` | SUPPORTING (protected WF02) | — |
| — | Public venture page, discovery | — | — | PRO1 "Xem bản public" | Venture | — | FUTURE (WF06) | — |
| — | Organizer application review, participation, outcome | — | — | ORG1 KPIs | Application, Participation, Outcome | — | FUTURE (API §15) | — |

## Routes
| Route | Class | Reason |
|---|---|---|
| `/projects/new`, `/projects/:id/edit`, `/projects/:id/team`, `/me`, `/me/roles` | EXISTING (WF02, unchanged) | Canonical venture and team |
| `/demo/projects`, `/demo/projects/:id` | NEW | Frozen by architecture 04 A2 |
| `/demo/projects/:id/applications/:programmeId`, `…/review` | NEW (demo) | One refreshable draft / review per (venture, programme); same pattern as `/demo/programmes/:id/setup/*` |
| `/programmes/:slug`, `/applications`, public venture page, `/demo/projects/:id/edit` | FUTURE / OMIT | No duplicate venture route: editing stays on WF02 |

## API
| Kind | Items |
|---|---|
| Reusable | WF02 `/ventures*` and team routes; services `src/lib/venture/{venture,team}.ts`, `src/lib/network/network.ts` (server-side, read only) |
| Missing → demo read (GET only, new) | `GET /api/v1/demo/projects` → my ventures (WF02 `VentureDTO` fields + relation) and open programmes; `GET /api/v1/demo/projects/{id}` → the venture (404 unless owner / ACTIVE member), team summary, open programmes with eligibility |
| Demo-only | Application in the actor's browser session (SOT §12 shape: `primary_applicant_type`, `primary_applicant_id`, `programme_id`, `status`, `programme_specific_answers`); never venture fields |
| Production additions | **None** (`GET /me/ventures` stays unbuilt; no application / participation API) |

## DB
Reusable: `projects`, `project_members`, `project_domains`, `vocabulary_items`, `individual_profiles`. **Migration required: NO. Proposed migration: none.** Seed unchanged (UAT creates ventures through WF02 and removes them).

## Tasks
| # | Task | Scope | Depends | Security cases | Visual source | Targeted regression | DONE gate |
|---|---|---|---|---|---|---|---|
| 0 | WF05-T00 Demo foundation — **DONE** ([report](reports/WF05-T00_demo-foundation.md)) | `/demo/projects*` guard (auth + onboarding resolver), MemberShell entry (G2), frame + "Dữ liệu demo" + reset, WF05 session store, read models (my ventures via WF02 services; PUBLISHED fixture programmes), demo GET API | G1–G5 | guest, onboarding, member without venture, spoofed headers, no PII, 0 writes | MemberShell, WF04 DemoPage / notice | P0-SHELL, shell-routes, WF02-S01/S04/S05/S06 + UAT, WF04-T00 | functional + primitives + regression |
| 1 | WF05-S01 My ventures + programmes — **DONE** ([report](reports/WF05-S01_my-projects.md)); MemberShell entry shown | `/demo/projects` | T00 | foreign ventures never listed; DRAFT / ops-session programmes never listed | G1 primitives | T00, WF02-S01 | same |
| 2 | WF05-S02 Venture detail — **DONE** ([report](reports/WF05-S02_project-detail.md)); S01 rows link here; "Đăng ký" disabled until S03 | `/demo/projects/:id`; links to WF02 edit / team | S01 | non-member / pending invitee / random / malformed → 404; member read-only | PRO1 header, PRO3 table | S01, WF02-S05/S06 | same |
| 3 | WF05-S03 Application draft — **DONE** ([report](reports/WF05-S03_application-draft.md)); S02 "Đăng ký" / "Tiếp tục" open it; "Rà soát & nộp" saves, then opens S04 (since S04) | answers, save DRAFT, refresh, reset | S02, G4, G5 | owner only; ineligible type; ARCHIVED; duplicate; spoofed applicant id | WF04-S05 form | S02 | same |
| 4 | WF05-S04 Review + submit — **DONE** ([report](reports/WF05-S04_review-submit.md)); stays on S04 read only after submit; S02 "Xem đơn", S03 "Xem đơn đã nộp" | checklist, DRAFT → SUBMITTED, read-only after | S03 | double submit once; no other transition | WF04-S07 checklist | S03, WF04-S07 | same |
| 5 | WF05 COMPLETION AUDIT + HAPPY PATH UAT — **DONE — GREEN** ([audit](reports/WF05_COMPLETION_AUDIT.md), [UAT](WF05_UAT_MATRIX.md)) | journeys, SEC matrix, invariants, restart, full regression | 0–4 | all | all | full suite | GREEN verdict |

Each task: targeted tests and pixel only; the full suite runs at closure (PROCESS §E). Touching WF02 or P0-SHELL code outside T00's entry is out of plan.

## Related
- [WF05_PREIMPLEMENTATION_AUDIT.md](WF05_PREIMPLEMENTATION_AUDIT.md) — evidence
- [WF05_HAPPY_PATH_PLAN.md](WF05_HAPPY_PATH_PLAN.md) — journeys, negative matrix, invariants
- [WF04_SCREEN_IMPLEMENTATION_PLAN.md](WF04_SCREEN_IMPLEMENTATION_PLAN.md) — WF04 precedent
