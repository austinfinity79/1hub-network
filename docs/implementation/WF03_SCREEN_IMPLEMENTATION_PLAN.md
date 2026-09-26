# WF03 Screen Implementation Plan

**Status: DECISIONS FROZEN** ([DEC-WF03-G1..G15](../decisions/DECISION_LOG.md#dec-wf03-g1)). Executable P0 scope = **8 screens**; WF03-S05 = FUTURE / WF04 (G12). Process: [PROCESS-P0-ACCELERATED-SAFE-V2](PROCESS_P0_ACCELERATED_SAFE_V2.md). C1 closed by [DEC-WF03-C1](../decisions/DECISION_LOG.md#dec-wf03-c1) (S06 = profile / detail, S08 = relationships). S08 relationship contract frozen by [DEC-WF03-S08-RELATIONSHIP-CONTRACT](../decisions/DECISION_LOG.md#dec-wf03-s08-relationship-contract) (closes OPEN-WF03-S08-RELATIONSHIP-CONTRACT). C2 closed by [DEC-WF03-C2](../decisions/DECISION_LOG.md#dec-wf03-c2).

## Order
| # | Task | Route | Inputs | Scope | Path | State |
|---|---|---|---|---|---|---|
| 0 | WF03-T00 Ops foundation | `/ops/*` shell + guard | G9, G11, G15 (C2 fixture) | OpsShell (G15); server guard session → `require(capability, ORGANIZATION orgId)`; hierarchy service over `organization_relationships` (G9); org read model; `GET /ops/organizations` | Full preflight (new shell + security foundation) | **DONE** ([report](reports/WF03-T00_ops-foundation.md)) |
| 1 | S01 Organization selector / list | `/ops/network` | T00, G11 | Orgs in exact scope (PLATFORM_ADMIN per contract); HUB / CHAPTER / CLB | Fast path | **DONE** ([report](reports/WF03-S01_organization-list.md)) |
| 2 | S02 Organization dashboard | `/ops/org/:orgId` | T00, G1 | Canonical counters only, each with a named query | Fast path | **DONE** ([report](reports/WF03-S02_organization-dashboard.md)) |
| 3 | S03 Organization members | `/ops/org/:orgId/members` | T00, G3, G4 | Safe projection + membership state/provenance + leadership facts | Full preflight (privacy DTO) | **DONE** ([report](reports/WF03-S03_organization-members.md)) |
| 4 | S04 Membership review / leadership ops | `/ops/org/:orgId/members/:profileId` | S03, G5, G6, G14 | PENDING → ACTIVE / REJECTED; leadership create/end per API; audit | Full preflight (mutations + audit) | **DONE** ([report](reports/WF03-S04_membership-review-leadership.md)) |
| 5 | S06 Organization profile / detail | `/ops/org/:orgId/profile` | G8, G9, G14, DEC-WF03-C1 | Canonical profile read + name / description edit; hierarchy read-only | Full preflight (C1 freeze + mutation) | **DONE** ([report](reports/WF03-S06_organization-profile.md)) |
| 6 | S08 Organization settings / relationships | `/ops/org/:orgId/settings` | G9, DEC-WF03-C1, DEC-WF03-S08-RELATIONSHIP-CONTRACT, migration 009 | PARENT create / change / close over `organization_relationships` (`org:manage_relationship`, both ends) | Focused full preflight + freeze | **DONE** ([report](reports/WF03-S08_organization-relationships.md)) |
| 7 | S07 Event management | `/ops/org/:orgId/events` | T00, G2, G10, G14 | Standalone list / detail / create / edit / publish / cancel; S07 screen-contract addendum | Full preflight (addendum + lifecycle) | **DONE** ([report](reports/WF03-S07_event-management.md); lifecycle [DEC-WF03-S07-EVENT-LIFECYCLE](../decisions/DECISION_LOG.md#dec-wf03-s07-event-lifecycle)) |
| 8 | S09 Public organization page | `/organizations/:slug` | G13, G9, G10 | Public-safe projection + published standalone events | Fast path | after S07 |
| 9 | WF03 completion audit + UAT | — | 1–8 | Closing gate (§I) | — | — |
| — | S05 Unit programmes | `/ops/org/:orgId/programmes` | G12 | **FUTURE / WF04 — not implemented** | — | FUTURE |

**Why S06 before S08:** S06 (profile) needs no hierarchy writes, while S08 depends on the G9 invariant and on optional migration 009. C1 is closed (DEC-WF03-C1) and the S08 relationship contract is frozen; S06 and S08 are done. S07 is done (DEC-WF03-S07-EVENT-LIFECYCLE). S09 remains.

## Design element classification (per reference; frozen by G1–G15)
| Screen | Canonical P0 | Intentional contract | Intentional P0 scope / WF04 / Future |
|---|---|---|---|
| S01 | Header band, table frame, org name, ACTIVE members | Trực thuộc / Loại / Trạng thái columns in the drawn tracks (S01-D1) | "Tạo chapter", summit, SENDER, CSV, ADM sidebar items |
| S02 | Header band, KPI-card and work-card frames, chip + "Làm ngay" | Canonical KPIs + pending-request work item (S02-D3) | Enterprise problem / pilot / data-access content (G1) |
| S03 | Title, filter card, table frame, status chips, "Mở →" | Relationship columns + contracted filter chips (S03-D3) | Email, verification, lock, last login, CSV, account totals (G3) |
| S04 | Name header, membership / leadership history, review actions | Consent summary per G4 | Resend link, lock, fund / problem-owner consents, account log, ADM15 proposal |
| S06 | Header band, card chrome, chips, secondary button | Name / description view + edit; read-only hierarchy card (S06-D3) | Representatives (G7), visibility matrix, verification, publication checklist, archive request, change-parent request (S08), programme links, change history |
| S07 | — (no drawn CRUD) | Event table + form addendum (G2) | Qualifying round, registrants, campaign mail, funnel (WF04 / Future) |
| S08 | Title, tree chips, relationship tables, add form, valid-pair card | PARENT rows + frozen pair rules (S08-D4) | Change-parent request queue, notifications, co-organizer with a programme (WF04) |
| S09 | Hero, parent/children, published events, join CTA | Aggregate counts (G13) | Leaders' emails, partner strip, referral link, capacity / registration chips, summit CTA |
| S05 | — | — | Whole screen FUTURE / WF04 (G12) |

## Related
- [WF03_PRE_IMPLEMENTATION_AUDIT.md](WF03_PRE_IMPLEMENTATION_AUDIT.md) — audit
- [WF03_HAPPY_PATH_PLAN.md](WF03_HAPPY_PATH_PLAN.md) — happy paths
- [P0_STATUS.md](P0_STATUS.md) — status
