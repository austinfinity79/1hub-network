# WF04 Happy Path Plan

**Status: PROPOSED — pending [OPEN-WF04 H1–H5](../decisions/DECISION_LOG.md#open-wf04-h1).** WF04 = DEMO. Journeys assume the recommended options; any other answer changes J1 steps 4 and 8.

## Demo data (fixture, labelled DỮ LIỆU DEMO)
| Record | Values | Notes |
|---|---|---|
| Programme P1 | `PROGRAMME`, "Chương trình ươm tạo (demo)", PUBLISHED, owning org = seed HUB `10000000-…-0001` | 3 stages, 2 events, 2 team rows, application counts |
| Challenge C1 | `CHALLENGE`, "Thử thách đổi mới (demo)", DRAFT, owning org = seed Chapter 01 `10000000-…-0101` | 2 stages, 1 event, 2 problem statements (if H4 = b) |
| Events | 3 rows, `EventDTO` shape, `programme_id` = P1 / C1, Asia/Ho_Chi_Minh | Not rows in `events` |
| Team | 2–3 rows: fictional display name + `PROGRAMME_ORGANIZER` label | No real person, no email |
| Application counts | per frozen Application status (SOT §6), e.g. SUBMITTED 4, UNDER_REVIEW 2 | Counts only; no applicant identity |

Deterministic ids under a distinct prefix (`d4000000-0000-0000-0000-00000000000N`), stable slugs, fixed dates relative to a fixed demo clock in tests. Organization names are read from `organizations` by id; a missing id shows "Tổ chức (demo)". No real company or roster name is invented; the `demo-challenge` seed row is not used.

## Happy paths
| ID | Actor | Steps |
|---|---|---|
| J1 Create and publish a Challenge | Leader (Chapter 01) | 1 sign in → `/ops/network` → demo entry → S01 lists P1 and C1 · 2 "Tạo mới" → S02: CHALLENGE, name, summary, owning org Chapter 01, dates → 3 S03: 2 stages; 1 problem statement (H4) · 4 S04: add 1 event, end ≥ start · 5 S05: applicant types TEAM + STARTUP, 1 question, profile-reuse notice · 6 S06: team list · 7 S07: checklist all green (H5) → publish · 8 S08: PUBLISHED, current stage, event, team · 9 back to S01: new row PUBLISHED · 10 refresh: still there · 11 "Đặt lại demo": only P1, C1 remain |
| J2 Browse a running Programme | Platform admin | S01 → P1 → S08: PUBLISHED, current stage by date, events, team, application counts; "Chỉnh sửa" opens setup on a session copy; P1 in the fixture unchanged after reset |
| J3 Keep a draft | Leader | S02 → S03 → leave at S04 → S01 shows the DRAFT → reopen → resumes at the saved data |

## Alternate / negative (mandatory)
| Case | Expected |
|---|---|
| Guest opens any `/demo/*` or demo API | `/auth` (page) / 401 (API) |
| Onboarding incomplete | Resolver step |
| Member without ops access | 404 (not-found shell), no demo entry shown |
| Publish with a failing checklist item | Blocked, the failing item named (H5) |
| End before start; name empty / too long | Field error, nothing saved |
| Session storage cleared, reopen a draft URL | "Bản nháp demo không còn" + link to S01 |
| Unknown fixture id | 404 |
| Any demo action | 0 rows written to PostgreSQL, audit or analytics |
| All pages | "DỮ LIỆU DEMO" visible; no email / phone; no console or hydration error |
| Other workflows | WF01–WF03, landing, P0-SHELL specs unchanged and green |

## Related
- [WF04_SCREEN_IMPLEMENTATION_PLAN.md](WF04_SCREEN_IMPLEMENTATION_PLAN.md) — tasks and QA gates
- [WF04_DEMO_SCOPE.md](WF04_DEMO_SCOPE.md) — scope
- [WF04_PRE_IMPLEMENTATION_AUDIT.md](WF04_PRE_IMPLEMENTATION_AUDIT.md) — evidence
