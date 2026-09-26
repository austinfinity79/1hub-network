# WF04 Screen Implementation Plan

**Status: FROZEN** ([DEC-WF04-H1..H5](../decisions/DECISION_LOG.md#dec-wf04-h1)); **T00 DONE** ([DEC-WF04-T00-D1..D5](../decisions/DECISION_LOG.md#dec-wf04-t00-d1), [report](reports/WF04-T00_demo-foundation.md)); **S01 DONE** ([DEC-WF04-S01-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s01-d1), [report](reports/WF04-S01_programme-list.md)); **S02 DONE** ([DEC-WF04-S02-D1..D4](../decisions/DECISION_LOG.md#dec-wf04-s02-d1), [report](reports/WF04-S02_programme-create.md)); **S03 DONE** ([DEC-WF04-S03-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s03-d1), [report](reports/WF04-S03_programme-journey.md)); **S04 DONE** ([DEC-WF04-S04-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s04-d1), [report](reports/WF04-S04_programme-events.md)); **S05 DONE** ([DEC-WF04-S05-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s05-d1), [report](reports/WF04-S05_programme-registration.md)); **S06 DONE** ([DEC-WF04-S06-D1..D3](../decisions/DECISION_LOG.md#dec-wf04-s06-d1), [report](reports/WF04-S06_programme-team.md)). WF04 = DEMO. Process: [PROCESS-P0-ACCELERATED-SAFE-V2](PROCESS_P0_ACCELERATED_SAFE_V2.md). 8 executable demo screens ([scope](WF04_DEMO_SCOPE.md)), 9 tasks. Next: S07.

## Routing (04 A2; DEC-WF04-H2, T00-D4/D5)

T00 built the guard, the frame, the demo API and the route builders (`src/lib/programme-demo/routes.ts`); S01 built the list at `/demo/programmes`; S02 built `/demo/programmes/new` (S01 "Tạo mới" opens it); S03 built `setup/journey` (an S02 save continues there; `:id` resolution per S03-D2); S04 built `setup/events` (S03 "Tiếp theo" opens it); S05 built `setup/registration` (S04 "Tiếp theo" opens it); S06 built `setup/team` (S05 "Tiếp theo" opens it). Every other route below is the ordinary 404 until its task builds it; S01 rows do not link until S08 (S01-D1); S06 "Tiếp theo" is disabled until S07 (S06-D3).

| Route | Screen | Render | Back | Next | Refresh / unknown id |
|---|---|---|---|---|---|
| `/demo/programmes` | S01 | Server (fixture) + client (session drafts) | OpsShell / wordmark | row → S08; "Tạo mới" → `/new` | Stable |
| `/demo/programmes/new` | S02 create | Client: creates a session draft id, then replaces the URL | S01 | `setup/basic` | Refresh creates nothing twice (draft id kept in the URL) |
| `/demo/programmes/:id` | S08 | Fixture id → server; session id → client | S01 | "Chỉnh sửa" → `setup/basic` | Fixture: stable; session id after storage loss → "Bản nháp demo không còn" + link to S01; unknown fixture-format id → not-found shell (404) |
| `/demo/programmes/:id/setup/basic` | S02 | Client (session layer over fixture) | S08 | `journey` | Stable within the tab session |
| `…/setup/journey` | S03 | Client | `basic` | `events` | Same |
| `…/setup/events` | S04 | Client | `journey` | `registration` | Same |
| `…/setup/registration` | S05 | Client | `events` | `team` | Same |
| `…/setup/team` | S06 | Client | `registration` | `review` | Same |
| `…/setup/review` | S07 | Client | `team` | publish → S08 | Same |
| `GET /api/v1/demo/programmes`, `GET /api/v1/demo/programmes/:id` | fixture read (**T00**) | Server | — | — | 401 guest; list 403 without `programme:read`; detail 404 for unknown / out of scope; no mutation method |

Setup steps share one stepper; each step saves to the session layer and never to the server. Fixture programmes open in setup as a session copy (the fixture file never changes).

## Order
| # | Task | Screens | Inputs | Scope | Path | State |
|---|---|---|---|---|---|---|
| 0 | WF04-T00 Demo foundation | — | H1, H2 | Fixture repository + DTOs (canonical shapes), demo API, `/demo` guard, demo layout inside OpsShell, entry link, "DỮ LIỆU DEMO" banner + "Đặt lại demo", session store | Full preflight (new route group + shell entry + guard) | **DONE** ([report](reports/WF04-T00_demo-foundation.md)) |
| 1 | WF04-S01 List | S01 | T00, H1 | Table (name, owning org, type, dates, problem count, status), header totals, loading / empty / error states; no type filter or current stage (not in the list DTO) | Fast path | **DONE** ([report](reports/WF04-S01_programme-list.md)) |
| 2 | WF04-S02 Create + basic info | S02 | S01 | Loại (once), Tên, Tóm tắt, Thời gian (optional, end ≥ start, Asia/Ho_Chi_Minh), Đơn vị chủ trì from the server-computed scope; enables S01 "Tạo mới" | Fast path + human decision (S02-D1/D2) | **DONE** ([report](reports/WF04-S02_programme-create.md)) |
| 3 | WF04-S08 Detail / manage | S08 | S01, S02 | Overview cards, status chip, sections for journey / events / team / application counts, edit entry (`setup/basic` with the S02 form, type locked); makes S01 rows navigate | Fast path | TODO |
| 4 | WF04-S03 Journey | S03 | S02, H3, H4 | Ordered stages (add / edit / remove / ↑↓), CHALLENGE problem statements; the step after an S02 save | Focused preflight | **DONE** ([report](reports/WF04-S03_programme-journey.md)) |
| 5 | WF04-S04 Events | S04 | S02 | Programme-linked events (`EventDTO` + `programme_id`), S07 rules, add / edit / remove-draft; enables S03 "Tiếp theo" | Fast path | **DONE** ([report](reports/WF04-S04_programme-events.md)) |
| 6a | WF04-S05 Registration config | S05 | S02 | Applicant types, plain-text questions, profile-reuse notice, read-only counts; enables S04 "Tiếp theo" | Fast path | **DONE** ([report](reports/WF04-S05_programme-registration.md)) |
| 6b | WF04-S06 Operating team | S06 | S02 | Display-only team list with the `PROGRAMME_ORGANIZER` display label (grants nothing); enables S05 "Tiếp theo" | Fast path | **DONE** ([report](reports/WF04-S06_programme-team.md)) |
| 7 | WF04-S07 Review + publish | S07 | S02–S06, H5 | Checklist per H5 (`publishReadiness`); DRAFT → PUBLISHED in session; enables S06 "Tiếp theo" | Focused preflight | NEXT |
| 8 | WF04 demo happy-path closure | all | 0–7 | Journeys J1–J3, navigation crawl, regression, completion audit | Closing gate | TODO |

**Why this order:** foundation and read model first; S08 before the setup steps so every created draft has a destination; S03 and S07 carry the most rules (H3–H5) and come after the low-risk screens. Shared helpers already exist from T00: `publishReadiness` (H5), the session store, `DemoPage`, `demoRoutes`.

## QA gates per task
| Gate | Required |
|---|---|
| Functional | Playwright per screen (create / edit / validate / publish in session; fixture reads) |
| Visual | 1440×900 + full-page capture; typography assertion (Be Vietnam Pro 400/500/600); primitive segments vs approved sources (OpsShell, ADM5 table header / row / pill / primary button, S07 form fields) with Structural / Major / Component = 0; **no pixel-equivalence claim** (no WF04 baseline) |
| Navigation | Extend `p0-shell-navigation.spec.ts` crawl to `/demo/*`: no `#`, no dead link, back / next, refresh |
| State | Session store: survives refresh, "Đặt lại demo" clears, storage loss handled, fixture unchanged |
| Security | Guest → `/auth`; incomplete → resolver; member without ops access → 404; no email / phone / session data in DTOs; **0 DB, audit or analytics writes** (row counts before / after) |
| Regression | Targeted: shell, P0-SHELL, WF03 ops specs; **full suite** at T00 (shell change) and T08 |
| DB suites | Not required for fixture-only tasks (1–7); T00 adds the "no write" check |

## Related
- [WF04_PRE_IMPLEMENTATION_AUDIT.md](WF04_PRE_IMPLEMENTATION_AUDIT.md) — evidence
- [WF04_DEMO_SCOPE.md](WF04_DEMO_SCOPE.md) — classification and boundary
- [WF04_HAPPY_PATH_PLAN.md](WF04_HAPPY_PATH_PLAN.md) — journeys and demo data
