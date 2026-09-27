# WF04 Happy Path Plan

**Status: FROZEN** ([DEC-WF04-H1..H5](../decisions/DECISION_LOG.md#dec-wf04-h1)). WF04 = DEMO. The dataset below is implemented by WF04-T00 ([DEC-WF04-T00-D1](../decisions/DECISION_LOG.md#dec-wf04-t00-d1)).

**Progress:** all 8 screens are built; J1 steps 1–11, J2 and J3 are runnable end to end: S01 → S02 create → S03 journey (stages, problem statements) → S04 events → S05 registration → S06 team (display) → S07 review: H5 checklist, publish DRAFT → PUBLISHED → S08 detail (PUBLISHED, stages with dates, events, team; one-off "Đã xuất bản “…”.") → S01 shows it PUBLISHED; refresh keeps it; reset restores the fixtures. J2: S01 row → S08; "Sửa" opens `setup/basic` (type and owner locked) on a session copy. **Differences for the completion audit** ([DEC-WF04-S08-D1](../decisions/DECISION_LOG.md#dec-wf04-s08-d1)): S08 lists every stage with its dates but marks no "current stage" (H3 defines no date rule for it), and shows no application counts (the S08 task forbids a funnel; the illustrative counts stay on S05). The end-to-end UAT run is the next task (WF04 COMPLETION AUDIT + HAPPY PATH UAT).

## Demo data (fixture, labelled DỮ LIỆU DEMO)
| Record | Values | Notes |
|---|---|---|
| Programme P1 | `d4000000-…-0001`, `PROGRAMME`, "Chương trình ươm tạo (demo)", PUBLISHED, owning org = dev fixture Chapter 01 `10000000-…-0101` | 3 stages, 2 events, 2 team rows, application counts SUBMITTED 5 / UNDER_REVIEW 3 / NEEDS_UPDATE 1 |
| Challenge C1 | `d4000000-…-0002`, `CHALLENGE`, "Thử thách đổi mới (demo)", DRAFT, owning org = Chapter 01 | 2 stages, 1 event, 2 problem statements, 1 team row, no applications; passes the H5 checklist |
| Events | 3 rows, `EventDTO` shape, `programme_id` = P1 / C1, Asia/Ho_Chi_Minh | Not rows in `events` |
| Team | 3 rows: "Người vận hành A/B/C (demo)" + `PROGRAMME_ORGANIZER` label | No real person, no email; the label grants nothing (H2) |
| Application counts | per frozen Application status (SOT §6); P1 only (see above), C1 none | Counts only; no applicant identity, no application rows |

Deterministic ids in the reserved `d40…` range, stable slugs, fixed absolute dates (tests that derive a current stage use a fixed clock). The owner's name is read from `organizations` by id; a fixture whose owner does not exist is not listed, so a database without the Chapter 01 dev fixture shows an empty demo. No real company or roster name is invented; the `demo-challenge` seed row is not used.

## Happy paths
| ID | Actor | Steps |
|---|---|---|
| J1 Create and publish a Challenge | Leader (Chapter 01) | 1 sign in → `/ops/network` → OpsShell "Chương trình & Challenge" → S01 lists P1 and C1 · 2 "Tạo mới" → S02: CHALLENGE, name, summary, owner Chapter 01 (read-only for this leader), dates → "Lưu" → 3 S03: 2 stages; 1 problem statement · 4 S04: add 1 event, end ≥ start · 5 S05: applicant types TEAM + STARTUP, 1 question, profile-reuse notice · 6 S06: team list · 7 S07: checklist all green → publish · 8 S08: PUBLISHED, current stage, event, team · 9 back to S01: new row PUBLISHED · 10 refresh: still there · 11 "Đặt lại demo": only P1, C1 remain |
| J2 Browse a running Programme | Platform admin | S01 → P1 → S08: PUBLISHED, current stage by date, events, team, application counts; "Chỉnh sửa" opens setup on a session copy; P1 in the fixture unchanged after reset |
| J3 Keep a draft | Leader | S02 → S03 → leave at S04 → S01 shows the DRAFT → reopen → resumes at the saved data |

## Alternate / negative (mandatory)
| Case | Expected |
|---|---|
| Guest opens any `/demo/*` or demo API | `/auth` (page) / 401 (API) |
| Onboarding incomplete | Resolver step |
| Member without ops access | 404 (not-found shell), no demo entry shown |
| Publish with a failing checklist item (e.g. a CHALLENGE with no problem statement) | Blocked, the failing item named (H5) |
| End before start; name empty / too long | Field error, nothing saved |
| Session storage cleared, reopen a draft URL | "Bản nháp demo không còn" + link to S01 |
| Unknown fixture id | 404 |
| Any demo action | 0 rows written to PostgreSQL, audit or analytics |
| All pages | "Dữ liệu demo · Internal Alpha" notice visible (DemoPage); no email / phone; no console or hydration error |
| Other workflows | WF01–WF03, landing, P0-SHELL specs unchanged and green |

## Related
- [WF04_SCREEN_IMPLEMENTATION_PLAN.md](WF04_SCREEN_IMPLEMENTATION_PLAN.md) — tasks and QA gates
- [WF04_DEMO_SCOPE.md](WF04_DEMO_SCOPE.md) — scope
- [WF04_PRE_IMPLEMENTATION_AUDIT.md](WF04_PRE_IMPLEMENTATION_AUDIT.md) — evidence
