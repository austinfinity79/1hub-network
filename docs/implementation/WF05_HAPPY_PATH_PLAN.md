# WF05 Happy Path Plan

**Status: DRAFT — waits for [OPEN-WF05-G1..G5](../decisions/DECISION_LOG.md#open-wf05-g1)** (recommended options assumed below). WF05 = DEMO. Screens: [WF05_SCREEN_IMPLEMENTATION_PLAN.md](WF05_SCREEN_IMPLEMENTATION_PLAN.md).

## Demo data
| Record | Source | Notes |
|---|---|---|
| Ventures | Canonical `projects` / `project_members`, read live through WF02 services | Seed "Demo Startup" (`50000000-…-0001`, STARTUP, ACTIVE, owner member@); UAT creates its own PROJECT / STARTUP ventures through WF02 and removes them |
| Programmes | WF04 fixtures, PUBLISHED only | P1 "Chương trình ươm tạo (demo)": applicant types TEAM + STARTUP, 2 questions. C1 (DRAFT) and ops session drafts are never shown |
| Applications | Actor's browser session, SOT §12 shape | Venture id + programme id + status + answers; nothing copied |

## Happy path — HC-WF05
| ID | Actor | Route | Action | Data | Expected | Depends |
|---|---|---|---|---|---|---|
| HC-WF05-01 | Owner (onboarded member) | `/me` → MemberShell entry → `/demo/projects` | Enter the demo | read | Own ventures (relation "Chủ sở hữu") + open programme P1; "Dữ liệu demo" notice | T00, G2, G3 |
| HC-WF05-02 | Member without a venture | `/demo/projects` → `/projects/new` | Create a STARTUP (WF02) and come back | WF02 write | S01 lists it (DRAFT) — the same record | WF02-S05 |
| HC-WF05-03 | Owner | `/demo/projects/:id` | Open the venture | read | Type, name, summary, status, region, domains, team summary as in WF02 | S02 |
| HC-WF05-04 | Owner | "Sửa hồ sơ" → `/projects/:id/edit` → back | Change the summary (WF02) | WF02 write | S02 shows the new summary (no copy) | WF02-S05 |
| HC-WF05-05 | Owner | "Đội" → `/projects/:id/team` | Invite a member (WF02) | WF02 write | S02 counts owner + ACTIVE members only | WF02-S06 |
| HC-WF05-06 | Owner | S02 → "Đăng ký" P1 | Start an application | read | S03: applicant card = live venture (STARTUP), P1's 2 questions | G4 |
| HC-WF05-07 | Owner | S03 | Answer, "Lưu nháp", refresh | session DRAFT | DRAFT kept; no DB row | G5 |
| HC-WF05-08 | Owner | S04 | Checklist green → "Nộp" | DRAFT → SUBMITTED | Read-only SUBMITTED; S01 / S02 show "Đã nộp" for P1; no second "Đăng ký" | G5 |
| HC-WF05-09 | Owner | WF02 edit → S04 | Rename the venture | WF02 write | The application shows the new name (reference) | — |
| HC-WF05-10 | ACTIVE member | accept (WF02) → `/demo/projects/:id` | Open as a member | read | Read-only; no "Đăng ký"; the owner's session application is not visible | G5 |
| HC-WF05-11 | Owner of a PROJECT | S02 → P1 | Apply as TEAM | session | Eligible (TEAM ∈ P1); team = owner + ACTIVE members | G4 |
| HC-WF05-12 | Owner | "Đặt lại demo" | Reset | session cleared | Applications gone; ventures unchanged | T00 |

## Negative / security — NEG-WF05
| ID | Case | Expected |
|---|---|---|
| 01 | Guest on any `/demo/projects*` / demo API | `/auth` / 401 |
| 02 | Onboarding incomplete | Resolver step / 403 |
| 03 | Non-owner, non-member (incl. a pending invitee) opens a venture | 404, same as a random id |
| 04 | ACTIVE team member on S03 / S04 | Read-only; cannot create or submit |
| 05 | Foreign venture id in an application URL | 404 |
| 06 | Random UUID; malformed id | Not found / 404 |
| 07 | Programme DRAFT, unknown, or an ops-session draft id | Not listed; URL 404 |
| 08 | Venture type not accepted by the programme | No "Đăng ký"; S04 blocked |
| 09 | Spoofed `owner_profile_id`, profile or applicant id (form, query, store) | Ignored; applicant = the route's venture after the server check |
| 10 | Spoofed `x-role`, `orgId`, `role_label` "Founder", PROGRAMME_ORGANIZER label | No effect |
| 11 | PLATFORM_ADMIN / HUB_COMMUNITY_LEADER without a relation to the venture | 404 (no admin read) |
| 12 | ARCHIVED venture | Read-only; cannot start an application |
| 13 | Invalid transition (SUBMITTED → DRAFT, re-submit, any review state) | Refused, nothing changes; double submit = one transition |
| 14 | Second application for the same (venture, programme) | Resumes the existing one |
| 15 | Store written by another actor | Not read (per-actor key) |
| 16 | PII | No email, profile / account id, slug or metadata in DTOs; invitee emails never in WF05 |
| 17 | Public route | No `/programmes/:slug`, no public venture page |

## Data invariants — INV-WF05
1. One canonical venture: WF05 reads `projects` by id and stores only the id; no programme-specific project, startup, founder, team or member record.
2. Owner = `projects.owner_profile_id`, resolved server-side; never client input.
3. The team stays `project_members`, read-only in WF05.
4. A programme reference never copies venture data; the application renders the venture live.
5. Profile completion is untouched.
6. Visibility: relation-only venture read; no organizer, admin or public read.
7. No RoleAssignment; no capability from a role label or "Founder".
8. No cross-project mutation; WF05 mutates nothing server-side (WF02 edits keep WF02 guards).
9. No PII leak in pages, APIs, the store or logs.
10. Production DB, audit and analytics writes from WF05 = 0 (row-exact fingerprints before / after).

## WF01–WF04 protection
| Shared area | Touch | Regression |
|---|---|---|
| WF02 venture / team runtime | Read-only import of services | WF02-S05, S06, UAT, venture / team DB tests |
| P0-SHELL MemberShell | One entry (G2) | P0-SHELL crawl, shell-routes, WF02-S01…S07 pixel |
| Auth / session | Reuse only | WF01 auth smoke |
| WF04 fixtures | Read-only import, PUBLISHED filter | WF04 specs (all) |
| Taxonomy DTO | Reuse | WF02-S05 |

## Related
- [WF05_PREIMPLEMENTATION_AUDIT.md](WF05_PREIMPLEMENTATION_AUDIT.md) — evidence
- [WF05_SCREEN_IMPLEMENTATION_PLAN.md](WF05_SCREEN_IMPLEMENTATION_PLAN.md) — tasks
- [WF04_HAPPY_PATH_PLAN.md](WF04_HAPPY_PATH_PLAN.md) — WF04 precedent
