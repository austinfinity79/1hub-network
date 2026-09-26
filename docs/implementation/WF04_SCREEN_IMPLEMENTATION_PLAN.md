# WF04 Screen Implementation Plan

**Status: PROPOSED — blocked on [OPEN-WF04 H1–H5](../decisions/DECISION_LOG.md#open-wf04-h1).** WF04 = DEMO. Process: [PROCESS-P0-ACCELERATED-SAFE-V2](PROCESS_P0_ACCELERATED_SAFE_V2.md). 8 executable demo screens ([scope](WF04_DEMO_SCOPE.md)), 9 tasks. No task starts before H1–H5 are answered.

## Routing (04 A2; H2 for access)
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
| `GET /api/v1/demo/programmes`, `GET /api/v1/demo/programmes/:id` | fixture read | Server | — | — | Same guard as pages; 404 for unknown |

Setup steps share one stepper; each step saves to the session layer and never to the server. Fixture programmes open in setup as a session copy (the fixture file never changes).

## Order
| # | Task | Screens | Inputs | Scope | Path |
|---|---|---|---|---|---|
| 0 | WF04-T00 Demo foundation | — | H1, H2 | Fixture repository + DTOs (canonical shapes), demo API, `/demo` guard, demo layout inside OpsShell, entry link, "DỮ LIỆU DEMO" banner + "Đặt lại demo", session store | Full preflight (new route group + shell entry + guard) |
| 1 | WF04-S01 List | S01 | T00, H1 | Table (type, name, owning org, status, dates, current stage), type filter, counts from rows | Fast path |
| 2 | WF04-S02 Create + basic info | S02 | S01 | Type, name, summary, owning org (from the actor's `GET /ops/organizations` scope), start / end (end ≥ start, Asia/Ho_Chi_Minh) | Fast path |
| 3 | WF04-S08 Detail / manage | S08 | S01, S02 | Overview cards, status chip, sections for journey / events / team / application counts, edit entry | Fast path |
| 4 | WF04-S03 Journey | S03 | S02, H3, H4 | Per H3 (stages) and H4 (Challenge problem statements) | Focused preflight |
| 5 | WF04-S04 Events | S04 | S02 | Programme-linked events in `EventDTO` shape; S07 validation limits (`EVENT_LIMITS`, `EVENT_TIMEZONE`); no WF03 service change | Fast path |
| 6 | WF04-S05 + S06 Registration config + operating team | S05, S06 | S02 | Same risk (config / display only), same components: applicant types, questions, profile-reuse notice; team list `PROGRAMME_ORGANIZER` label | Fast path |
| 7 | WF04-S07 Review + publish | S07 | S02–S06, H5 | Checklist per H5; DRAFT → PUBLISHED in session; detail reflects it | Focused preflight |
| 8 | WF04 demo happy-path closure | all | 0–7 | Journeys J1–J3, navigation crawl, regression, completion audit | Closing gate |

**Why this order:** foundation and read model first; S08 before the setup steps so every created draft has a destination; S03 and S07 carry the open decisions and come after the low-risk screens.

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
