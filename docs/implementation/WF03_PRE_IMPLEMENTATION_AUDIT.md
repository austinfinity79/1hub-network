# WF03 Pre-Implementation Audit

**Update 2026-09-26: G1–G15 FROZEN** as [DEC-WF03-G1..G15](../decisions/DECISION_LOG.md#dec-wf03-g1). Executable scope = 8 screens (S05 → FUTURE / WF04). New conflicts: [C1](../decisions/DECISION_LOG.md#open-wf03-c1) (S06/S08 mapping; **closed 2026-09-26 by [DEC-WF03-C1](../decisions/DECISION_LOG.md#dec-wf03-c1)**: S06 = profile / detail, S08 = relationships; S08 mutation semantics split into [OPEN-WF03-S08-RELATIONSHIP-CONTRACT](../decisions/DECISION_LOG.md#open-wf03-s08-relationship-contract), **closed by [DEC-WF03-S08-RELATIONSHIP-CONTRACT](../decisions/DECISION_LOG.md#dec-wf03-s08-relationship-contract)**: PARENT only, HUB → CHAPTER / CHAPTER → CLB, one ACTIVE parent (migration 009)) and [C2](../decisions/DECISION_LOG.md#open-wf03-c2) (hierarchy fixture). The findings below are the original audit, kept as history.

**Original verdict: HUMAN DECISION REQUIRED (15 — [OPEN-WF03 G1–G15](../decisions/DECISION_LOG.md#open-wf03-g1)).** Audit only: no runtime code, no migration, no seed or design change. HEAD `160b620`, 2026-09-26.

**Sources** (precedence order): CLAUDE.md; Master Spec §WF03 / M3; WF03 contract (`WF03_…_FINAL_v1.0.md`); SCR = `SCREEN_CONTRACTS…yaml` WF03; Data SOT + Freeze D1–D5; Design Pixel SOT §6–§9, screen map, manifest, the 9 `design-reference/final/WF03` bitmaps (element inventory taken at 1440 px); architecture 03 (RBAC) and 06; migrations 001–008 + deterministic seed; API contract §8, §12–§14; approved Matrix (DECISION-AUTHZ-01B); DB gap register (P5, P6, P11, D6, D7).

## 1. Screen inventory
| ID | Name | Route | Mode | Actor | Reads / writes (SCR) | API (§8) | DB | Reference | Readiness |
|---|---|---|---|---|---|---|---|---|---|
| S01 | Network selector | `/ops/network` | Production-internal | Leader, Platform Admin | Organization, MembershipSummary / — | `GET /ops/organizations` | exists | ADM8, 1440×550, strict | **Blocked** G11, G15 |
| S02 | Unit dashboard | `/ops/org/:orgId` | Production-internal | Leader, Admin | OrganizationOpsReadModel / — | `GET …/dashboard` | exists | ORG1, 1440×782, strict | **Blocked** G1, G15 |
| S03 | Member list | `/ops/org/:orgId/members` | Production-internal | Leader, Admin | Membership, IndividualProfile / — | `GET …/members` | exists | ADM17, 1440×893 | **Blocked** G3, G4, G15 |
| S04 | Member detail | `/ops/org/:orgId/members/:profileId` | Production-internal | Leader, Admin | Profile, Membership, Leadership, ConsentSummary / Membership, Leadership | `GET …/members/{id}`, `PATCH …/memberships/{id}`, `POST/PATCH …/leadership` | exists | ADM18, 1440×968 | **Blocked** G3–G6, G14 |
| S05 | Unit programmes | `/ops/org/:orgId/programmes` | Production-internal (read bridge) | Leader, Admin | Programme / — | `GET …/programmes` | partial | ADM5, 1440×550, strict | **Blocked** G12, G15 |
| S06 | Unit profile | `/ops/org/:orgId/profile` | Production-internal | Leader, Admin | Organization, OrganizationProfile / OrganizationProfile | `GET /organizations/{id}`, `PATCH …/profile` | partial | ORGP2, 1440×1839 | **Blocked** G7, G8, G14 |
| S07 | Event management | `/ops/org/:orgId/events` | Production-internal | Leader, Admin | Event, EventRegistration, EventOpsReadModel / Event | `GET/POST …/events`, `GET /events/{id}`, `PATCH/publish/cancel /ops/events/{id}`, `GET …/registrations` | partial | derived crop, 1440×1131 | **Blocked** G2, G10, G14 |
| S08 | Relationships | `/ops/org/:orgId/settings` | Production-internal | Leader, Admin | OrganizationRelationship / same | `GET/POST …/relationships`, `POST …/close` | partial | ADM21, 1440×888 | **Blocked** G9, G14 |
| S09 | Public unit page | `/organizations/:slug` | Production (public) | Guest, member | OrganizationPublicReadModel, EventPublicReadModel / — | `GET /organizations/by-slug/{slug}` | partial | derived crop, 1440×2511 | **Blocked** G13, G8–G10 |

All 9 routes are M0-T03 placeholders today. No `/ops` or `/organizations` API is implemented. `GET /ops/feedback` and `GET /ops/metrics/p0` are internal but map to no WF03 screen (not in this scope). Nothing Demo/Future is added: investor, data room, judging, summit, campaign mail and analytics funnels appear only in the bitmaps (Pixel SOT §9: "DESIGNED ≠ APPROVED TO BUILD").

## 2–3. Organization model and account boundary
| Item | Evidence | Finding |
|---|---|---|
| Types | `org_type` = HUB, CHAPTER, CLB, COMPANY, FUND, PARTNER (001:7); SCHOOL deferred (gap D2) | WF03 operates HUB / CHAPTER / CLB (requestable set `membership-request.ts:19`); the others appear only as relationship targets. No create-organization endpoint → creating a Chapter ("Tạo chapter", S01; "Tạo hồ sơ tổ chức", S08) is out of P0 |
| Columns | `organizations(id, type, parent_id, slug UNIQUE, name, description, logo_asset_id, status publication_status, metadata, …)` | No region, website, contact, founding year, verification or visibility columns (G8) |
| Lifecycle | SOT: DRAFT → PENDING_CONFIRMATION → ACTIVE → VERIFIED_INFO / ARCHIVED + separate `verification_status`; DB: `publication_status` (gap P6, M3) | G8 |
| Hierarchy | `parent_id` (seed: Chapter → HUB, CLB → Chapter) **and** `organization_relationships` PARENT rows (seed d000…01/02), gap D7 | Two sources (G9). BR-FS03-09 pair rules exist only on the S08 bitmap |
| Shared login | SOT §3 "Organization never logs in via shared account"; no org credential column or route exists | **Compliant.** Humans act through their own account plus a scoped RoleAssignment |

## 4–6. Membership, Leadership, Representation
| Concept | Frozen | Exists | Gap |
|---|---|---|---|
| CommunityMembership | `PENDING_APPROVAL → ACTIVE \| REJECTED \| WITHDRAWN → SUSPENDED / ALUMNI` (SOT:190); ACTIVE only after confirmation; unique open `(profile, org)` | `membership_state` enum (002), `uq_open_membership`, member request (WF02-S04), roster preseed (004) | Ops transition table, provenance on confirmation (G5); `source` values SELF_DECLARED / ORGANIZATION_VERIFIED / PRESEED (P11) |
| LeadershipRecord | `ACTIVE → ALUMNI \| REVOKED`; separate from membership; keeps term history | `leadership_state`, `role_label`, `started_at`/`ended_at`, `uq_active_leadership` (004) | Who appoints/closes; RoleAssignment coupling (G6). API field `title` ↔ `role_label` |
| OrganizationRepresentation | `PENDING_CONFIRMATION → ACTIVE → ENDED \| REVOKED \| REJECTED`; separate from Organization | **No table** (D6); `ORGANIZATION_REPRESENTATIVE` inactive (Matrix §A) | G7; the S06 bitmap manages representatives |
| RoleAssignment | Permission-bearing `role + scope + validity` | Profile-anchored (002); P0 roles INDIVIDUAL_USER, HUB_MEMBER, HUB_COMMUNITY_LEADER, PLATFORM_ADMIN | No P0 API mints roles (API §8.3 "client does not mint arbitrary roles") |

## 7–8. RBAC and hierarchy scope
Nine frozen capabilities (Matrix §B): `network:read`, `org:read`, `member:read`, `programme:read`, `org:manage`, `event:manage`, `org:manage_relationship`, `membership:confirm`, `leadership:manage`. Each is granted to HUB_COMMUNITY_LEADER for the exact assigned organization, and to PLATFORM_ADMIN platform-wide. DECISION-AUTHZ-01B: **no wildcard, no inheritance**, so a HUB-scope leader has no authority over child Chapters/CLBs. `authorize`/`can`/`require` are implemented (M0-T09); session `capabilities` / `managed_scopes` are derived.

| Action | Capability | Resource scope | Lifecycle condition |
|---|---|---|---|
| List managed orgs | `network:read` | each org with an active assignment; all for PLATFORM_ADMIN | org exists |
| Dashboard | `org:read` | `orgId` | — |
| Members list / detail | `member:read` | `orgId`; target holds a membership in `orgId` (03 Example B) | — |
| Confirm / transition membership | `membership:confirm` | membership.organization_id = `orgId` | G5 table; 409 `MEMBERSHIP_INVALID_TRANSITION` |
| Leadership create / close | `leadership:manage` | `orgId` | ACTIVE → ALUMNI / REVOKED only (G6) |
| Programmes list | `programme:read` | `orgId` | read only |
| Edit profile | `org:manage` | `orgId` | not ARCHIVED (G8) |
| Event CRUD / publish / cancel | `event:manage` | event.organization_id | G10 |
| Relationships | `org:manage_relationship` | source org (and target, G9) | closed = immutable (API §13) |

No capability is missing for the contracted actions. Representation (G7) and a HUB-wide view (G11) would each need a matrix change.

## 9. Event
Canonical and standalone: `events.programme_id` nullable (001, 06 §66, SOT §11); `event_status` = the SOT six (002); host = `events.organization_id` NOT NULL; `slug` UNIQUE, `location_text`, `metadata`. **Missing:** `timezone`, `registration_enabled` (API §8.6 body), capacity and online/offline (S09), EventRegistration (P5), a member-facing registration flow, and triggers for LIVE / ENDED / ARCHIVED. Programme-linked behaviour (qualifying rounds, summits) is WF04. → G2, G10.

## 10. Admin/ops surfaces — classification (full element list in the plan)
| Function | Class |
|---|---|
| Org list with member counts, member list/detail, membership confirmation, leadership records, org profile text/logo, standalone Event CRUD, org relationships | CANONICAL-P0 (subject to G) |
| Account admin (email verification, lock, resend link, last login, CSV export, account log) | UNSUPPORTED (G3) |
| Representatives, org visibility matrix, verification, archive request, change-parent approval queue | FUTURE / needs decision (G7–G9) |
| Summit, challenge admin, qualifying round, problem statements, pilots, data room, campaign mail, sender email, tracking | WF04 / FUTURE |
| Analytics funnel, landing views, KPI trends | FUTURE (`/ops/metrics/p0` is platform-only) |
| Investor approval, fund contact consent | FUTURE (Data SOT §3C) |
| Notifications to profile managers | FUTURE (no notification centre, H9/H10) |

## 11–12. API and DB
| Area | API | DB |
|---|---|---|
| Orgs / dashboard / members | DEFINED + NOT IMPLEMENTED; `OpsMemberSummaryDTO` and the dashboard DTO have no field list (implementation decision) | EXISTS |
| Membership PATCH / leadership POST+PATCH | DEFINED + NOT IMPLEMENTED | EXISTS |
| Representation | MISSING CONTRACT | MISSING (D6) |
| Role assignment management | MISSING CONTRACT (by design) | EXISTS |
| Org profile PATCH, public by slug | DEFINED + NOT IMPLEMENTED; `OrganizationPublicDTO` undefined | PARTIAL (G8) |
| Events | DEFINED + NOT IMPLEMENTED; registrations endpoint without a registration source | PARTIAL (P5, G10) |
| Relationships | DEFINED + NOT IMPLEMENTED; types "controlled configuration" with no catalogue | PARTIAL (text type, `record_state`, no one-parent constraint) |
| Programme list | DEFINED (read bridge); `relationship` field has no source | PARTIAL (no ProgrammeOrganizationRelationship) |
| Audit | `writeAudit` exists | EXISTS; no WF03 action codes frozen (G14) |

**Migration requirement:** none under the recommended options except an **optional migration 009**: relationship integrity (one ACTIVE PARENT per child, approved type set), if G9(a) is chosen. The alternatives would add P5 (registrations), P6 (org lifecycle / verification), D6 (representation), org region / content columns.

## 13. Provenance
Ops confirmation is the SOT's `ORGANIZATION_VERIFIED` ("an authorized organization confirmed it"). The deterministic seed already stores it for confirmed rows. The confirming person is **not** stored and is never displayed: approver names and "HUB gán" / "Long Thành duyệt" labels on S06, S08 and S09 are bitmap-only (G5, G9, G13).

## 14. Security (mandatory tests)
Organization IDOR (foreign `orgId` / `profileId` / `membershipId` / `eventId` / `relationshipId` → 404, cross-scope → 403 per `SCOPE_FORBIDDEN`); membership request spoofing (no body `state` / `source` / `profile_id`); review by a member, by another org's leader, and by a HUB leader over a child org (no inheritance); cross-Chapter and cross-CLB mutation; capability spoofing (session capabilities are display only); leadership and `role_label` / `title` grant nothing; representation cannot act (G7); lifecycle 409s (REJECTED → ACTIVE, ENDED → PUBLISHED, closed relationship edit); event scope via `event.organization_id`; DTO filtering (no email, phone, session, token, consent content, metadata); PRIVATE discovery honoured in ops reads (G4); public page shows no private person data (G13); logs carry no PII.

## 15. Design mapping summary
Four different shells across the references (G15). **S02 and S07 draw no contracted content** (enterprise problem-owner dashboard; canvas collage of WF04 frames) → G1, G2. S03/S04 draw platform account administration → G3. S05 draws a platform challenge admin list → G12. S06/S08/S09 cite business rules (BR-FS03-06/07/09/10/13/14, FS-02, QĐ-09/13/15) that exist in no repository SOT → bitmap-only until confirmed (G7–G9, G13). Bitmap counters (412 thành viên, 186 registrants, 2.418 views, summit counts) have no data source unless listed canonical. Per-screen classification is in the [plan](WF03_SCREEN_IMPLEMENTATION_PLAN.md).

## 16. Reuse (never rebuild)
IndividualProfile + `projection.ts` (PROFILE_DISCOVERY); `community_memberships` + `requestMembership` + `toSourceType`; `leadership_records`; `role_assignments` + `authz` (`authorize`/`require`, derived session capabilities); vocabulary service; `projects` (read-only relations); session/auth, `requireMember`-style guards, `writeAudit`, idempotency store, error envelope, EditorHeader and table/row patterns from WF02, and the pixel harness incl. DEC-WF02-H12 (S01, S02, S03, S05, S08 are short references).

## Resolved by precedence (not asked)
- Data SOT §14 "schema-ready, not full production workflow" vs the WF03 contract's S07/S08 mutations → the WF03 contract (rank 3) governs scope; how much of it is P0 is G9/G10.
- Freeze D2 "no full approval workflow in the member-facing path" → approval is ops-facing (WF03-S04), consistent with DEC-WF02-H11.
- Event/relationship/org conflicts use the frozen codes (409 `MEMBERSHIP_INVALID_TRANSITION` precedent for lifecycle, 422 `PROFILE_VALIDATION_FAILED`, 403 `SCOPE_FORBIDDEN`) as implementation decisions.
- HUB-scope inheritance → none (DECISION-AUTHZ-01B).

## Related
- [WF03_SCREEN_IMPLEMENTATION_PLAN.md](WF03_SCREEN_IMPLEMENTATION_PLAN.md) — per-screen mapping and order
- [WF03_HAPPY_PATH_PLAN.md](WF03_HAPPY_PATH_PLAN.md) — HC-WF03 flows
- [AUTHORIZATION_CAPABILITY_MATRIX_P0.md](AUTHORIZATION_CAPABILITY_MATRIX_P0.md) — capabilities
- [DB_SCHEMA_GAPS_P0.md](DB_SCHEMA_GAPS_P0.md) — P5, P6, D6, D7
