# WF03 Screen Implementation Plan

**Status: NOT STARTED — HUMAN DECISION REQUIRED** ([OPEN-WF03 G1–G15](../decisions/DECISION_LOG.md#open-wf03-g1)). Derived from the [pre-implementation audit](WF03_PRE_IMPLEMENTATION_AUDIT.md). Each row states what it would build **if** the recommended option is approved.

## Order (by dependency)
| # | Task | Route | Depends on | Build if recommended options pass | State |
|---|---|---|---|---|---|
| 0 | WF03-T00 ops foundation | shell + `/ops/*` guard | G15 | One ops shell (WF03 links only); server guard: session → `require(capability, ORGANIZATION orgId)`; ops org read model (org, ACTIVE members, ACTIVE leaders, published events); `GET /ops/organizations` | BLOCKED |
| 1 | S01 Network selector | `/ops/network` | 0, G11 | Orgs with `network:read` (all HUB/CHAPTER/CLB for PLATFORM_ADMIN): name, type, active leaders, ACTIVE members, published events in the next 30 days | BLOCKED |
| 2 | S02 Unit dashboard | `/ops/org/:orgId` | 0, G1 | API §8.2 summary (4 metrics) + one canonical work item: pending membership requests | BLOCKED |
| 3 | S03 Member list | `…/members` | 0, G3, G4 | Org-scoped memberships (all states) + leadership; search by name; status filter | BLOCKED |
| 4 | S05 Unit programmes | `…/programmes` | 0, G12 | Read-only list of programmes with `organization_id = orgId` | BLOCKED |
| 5 | S04 Member detail + mutations | `…/members/:profileId` | 3, G5, G6, G14 | Detail, membership transitions, leadership create/close, audit | BLOCKED |
| 6 | S09 Public page | `/organizations/:slug` | 0, G8, G9, G10, G13 | Public projection + join CTA (reuses `POST /me/membership-requests`) | BLOCKED |
| 7 | S06 Unit profile | `…/profile` | 6, G7, G8, G14 | Edit canonical org fields; logo via the media pipeline | BLOCKED |
| 8 | S07 Events | `…/events` | 0, G2, G10, G14 | Standalone Event list / create / edit / publish / cancel | BLOCKED |
| 9 | S08 Relationships | `…/settings` | 0, G9, G14 (+ migration 009 if G9a) | Relationship list / create / close with history | BLOCKED |
| 10 | WF03 completion audit + UAT | — | 1–9 | As for WF02 | — |

Reads before mutations; the public page before profile editing (so the edit preview has a target); events and relationships last, because they carry the most open semantics.

## Design element classification (per reference)
| Screen | CANONICAL-P0 (if approved) | INTERNAL / contract addendum | WF04 | FUTURE / UNSUPPORTED |
|---|---|---|---|---|
| S01 | Chapter name, member count, events-in-30-days count, the table frame | Leader column = active leadership holders (no "head" field) | "Summit đang chạy", summit-lock notice | "Tạo chapter" (no API), SENDER / sender email, ADM sidebar items (ADM1–14 except 8), CSV / export lock |
| S02 | KPI-card frame, work-list frame | 4 §8.2 metrics, pending-request work item | bài toán, giải pháp, vòng trong, pilot, nghiệm thu | capability chips, data-access requests, NDA |
| S03 | Table frame, name, org, status chip, search | status = membership state; "Vai trò HUB" = leadership title | — | email column, email verification / lock chips, last login, CSV, account counts 12.480 |
| S04 | Header name, membership/leadership history | consent summary (PROFILE_DISCOVERY level, legal acceptance dates) | Chapter-founding proposal (ADM15) | resend verification, lock account, "Quỹ liên hệ" / "Đơn vị đặt bài toán liên hệ" consents, account log |
| S05 | List frame, programme name / status | — | "Tạo challenge", đơn vị chủ trì, bài toán, giai đoạn, chapter hưởng ứng, publish rule | — |
| S06 | Header (name, type, parent), description / logo edit | publish-condition card (G8) | "Programme liên quan", co-organizer rows | representatives card (G7), org visibility matrix, verification, archive request, change history, "Yêu cầu đổi chapter cha" |
| S07 | — (no event CRUD drawn) | Event list + form (G2) | qualifying round, push to national round, summit approval | analytics funnel, landing views, registrants list, campaign mail, sender/tracking |
| S08 | Tree breadcrumb, active / ended relationship tables, add form | valid parent–child pairs (G9) | "Đồng tổ chức" with a programme | change-parent request queue, verification, notifications, "Tạo hồ sơ tổ chức" |
| S09 | Hero (name, type, parent, description, logo), child CLB cards, upcoming published events, join CTA | aggregate member count (G13) | summit CTA, "Nộp bài không qua chapter", rounds | leaders' emails, partner strip, referral link, capacity / registration chips, "3 ngày làm việc" SLA |

## Related
- [WF03_PRE_IMPLEMENTATION_AUDIT.md](WF03_PRE_IMPLEMENTATION_AUDIT.md) — audit
- [WF03_HAPPY_PATH_PLAN.md](WF03_HAPPY_PATH_PLAN.md) — happy paths
- [P0_STATUS.md](P0_STATUS.md) — status
