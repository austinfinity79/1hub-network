# WF04 Pre-Implementation Audit

**Update 2026-09-27: H1–H5 FROZEN** as [DEC-WF04-H1..H5](../decisions/DECISION_LOG.md#dec-wf04-h1) (OPEN-WF04 closed, history kept). **WF04-T00 Demo Foundation DONE** ([DEC-WF04-T00-D1..D5](../decisions/DECISION_LOG.md#dec-wf04-t00-d1), [report](reports/WF04-T00_demo-foundation.md)). Human decisions remaining: 0. Implementation deviation from the recommendations below: both fixtures are owned by one organization (Chapter 01; T00-D1). The findings below are the original audit, kept as history.

**Verdict: HUMAN DECISION REQUIRED (5 — [OPEN-WF04 H1–H5](../decisions/DECISION_LOG.md#open-wf04-h1)).** Audit only: no runtime code, no migration, no seed or design change. HEAD `0fcfb59`, 2026-09-27. Mode: WF04 = **DEMO** for INTERNAL ALPHA (Master Spec §4, M4).

**Sources** (precedence order): CLAUDE.md; Master Spec v1.3 §4 WF04, §5, §6, M4, §15; Data Freeze v1.1 D1; Data SOT v1.1 §2, §6 (lifecycles), §8 (visibility), §10–§14; architecture 01 §7, 02 §2.5–2.6, 03 §3–4, 04 A1–A3 / C6 / D; API contract §8.4, §15; capability matrix; migrations 001–009 + `seed_dev.sql`; DB gap register D1; `WF04_EXTERNAL_REFERENCE.md`; `design-reference/final` manifest (WF03-S05 = ADM5); DEC-WF03-G12, DEC-WF03-S07-EVENT-LIFECYCLE, DEC-WF01-S08-D2, DEC-P0-LANDING-D2/D3, DEC-P0-SHELL-D2.

## Findings that shape the plan
| # | Finding | Evidence | Consequence |
|---|---|---|---|
| F1 | No approved WF04 design exists in `design-reference/final`; WF04 is outside the pixel freeze | `WF04_EXTERNAL_REFERENCE.md`; Master Spec header | No pixel baseline; design source = H1 |
| F2 | The external WF04 reference (Claude Docs artifact) is **not readable** by this session (access denied: not shared) | Docs read → `deny / access` | Cannot be inventoried; H1 |
| F3 | Only in-repo visual evidence: ADM5 (WF03-S05 bitmap) — a platform-admin **Challenge** list in the ADM shell with "Bài toán", "Giai đoạn", "Chapter hưởng ứng", phase pills and a publish rule | `WF03-S05__programme-challenge-list__full.png` | Layout reference for the list only; content conflicts → §Conflicts |
| F4 | Architecture already fixes the demo shape: `/demo/programmes`, `/demo/programmes/:id`, `/demo/programmes/:id/setup/*`; "read-only seeded API responses or fixture repository"; no fake records in production tables; fixtures use future production DTO shapes | 01 §7; 04 A1, A2, A3, "Demo later", D4 | Resolved by precedence (not asked) |
| F5 | `programmes` table exists (type, org, slug, name, summary, status, starts/ends, metadata); status uses `publication_status` (no CLOSED) | 001:269; gap D1 | Demo does not write it; CLOSED gap stays DEFERRED |
| F6 | `events.programme_id` nullable exists; the WF03 service is standalone-only and rejects `programme_id` | 001:288; `src/lib/ops/events.ts` | WF04 must not change WF03 Event code |
| F7 | No programme write capability exists; `PROGRAMME_ORGANIZER` is "designed now, activated later"; only `programme:read` (ORG / PLATFORM) | 03 §4; Matrix §B–C | No new capability; demo mutations never reach the server |
| F8 | Full programme lifecycle, application submission/review, judge/mentor/challenge-owner flows are explicitly **out of the P0 API** | API §15 | Stay FUTURE |
| F9 | Seed has one `demo-challenge` DRAFT row in `programmes` (Chapter 01) | `seed_dev.sql:75` | Not used by the demo; seed untouched |

## Actors
| Actor | Source | WF04 alpha |
|---|---|---|
| PLATFORM_ADMIN | 03 §4 P0; Matrix | Organizer-side demo user |
| HUB_COMMUNITY_LEADER (org operator) | Matrix `programme:read` | Organizer-side demo user |
| PROGRAMME_ORGANIZER | 03 §4 "activated later" | Shown as a **display label** in the demo team list only; grants nothing |
| CHALLENGE_OWNER_REPRESENTATIVE, JUDGE, MENTOR, ADVISOR, INVESTMENT_FUND_REPRESENTATIVE | 03 §4 later; SOT §14 not required | FUTURE — not rendered |
| Applicant (Individual / Team / Startup) | SOT §12 | FUTURE (application submission = WF05 / later); appears only as counts |

## Canonical entities
| Entity | Source | Alpha status |
|---|---|---|
| Programme (`PROGRAMME` / `CHALLENGE`) | Freeze D1; 001 `programmes` | DEMO fixture using the canonical column shape; production foundation = existing table |
| Event | SOT §11; 001/002 `events` | REUSE shape (`EventDTO` + `programme_id`); DEMO fixture rows; WF03 service untouched |
| Organization | 001 `organizations` | REUSE by id (owning organization) |
| IndividualProfile | WF01/WF02 | NOT REQUIRED (team shows fixture display names; no profile read) |
| Project / Startup | WF02 `projects` | NOT REQUIRED (named only as applicant type) |
| RoleAssignment / ProgrammeRoleAssignment | 03 §3; 04 C6 (reserved name) | DEMO display only; MISSING table (future) |
| ProgrammeOrganizationRelationship | SOT §5 (roles "…, etc." not frozen) | MISSING; demo shows the lead organization only |
| Application | SOT §6, §12 | DEMO counts by frozen status; MISSING table |
| Participation / Outcome | SOT §5, §13 | NOT REQUIRED / FUTURE |
| Structure / Journey | Freeze D1 (node only, no fields) | H3 |

## Lifecycle
Programme: `DRAFT → PUBLISHED → CLOSED → ARCHIVED` (SOT §6). Demo simulates **create, edit, review, publish (DRAFT → PUBLISHED)**; CLOSED / ARCHIVED appear only as fixture states (no close / archive action). ADM5 pills ("Đang mở nộp", "Đang chấm", "Sắp diễn ra") are phases, not lifecycle (H3). Publish readiness = H5.

## Conflicts (design vs SOT)
| Item | Source | Class |
|---|---|---|
| ADM shell + its 12 nav items (ADM1–ADM14; ADM3/4 not drawn) | ADM5 | REMOVE (OpsShell per DEC-WF03-G15) |
| "Bài toán" column + Challenge publish rule | ADM5 | NEEDS DECISION (H4, H5) |
| "Giai đoạn" phase + deadline | ADM5 | NEEDS DECISION (H3) |
| "Đang chấm" (judging) | ADM5 | INTENTIONAL-FUTURE |
| "Chapter hưởng ứng" | ADM5 (relationship type not frozen) | REMOVE FROM INTERNAL ALPHA |
| Real company names (Viettel Post, MB Bank, Lộc Trời) | ADM5 | REMOVE (fixture uses neutral demo names) |
| Investor / dataroom / fundraising, startup / summit / investor review, vote | ADM6/7/11/12 labels; SOT §14 | INTENTIONAL-FUTURE |
| Fake metrics ("4 challenge · 1 đang mở nộp") | ADM5 header | INTENTIONAL-DEMO only if computed from fixture rows |

## Resolved by precedence (not asked)
Routes `/demo/programmes/*` (04 A2) · fixture repository, no production-table writes (01 §7) · one aggregate + type (D1) · lifecycle names (SOT §6) · Event reuse by shape, `programme_id` set (SOT §11) · application config = applicant types `INDIVIDUAL | TEAM | STARTUP` + programme-specific questions, profile reuse (SOT §12) · no new capability or RBAC system (Matrix; 03) · no WF03 reopening (G12).

## Related
- [WF04_DEMO_SCOPE.md](WF04_DEMO_SCOPE.md) — screen classification and demo boundary
- [WF04_SCREEN_IMPLEMENTATION_PLAN.md](WF04_SCREEN_IMPLEMENTATION_PLAN.md) — routes, order, QA
- [WF04_HAPPY_PATH_PLAN.md](WF04_HAPPY_PATH_PLAN.md) — journeys and demo data
- [DECISION_LOG.md](../decisions/DECISION_LOG.md#open-wf04-h1) — OPEN-WF04 H1–H5
