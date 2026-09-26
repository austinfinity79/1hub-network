# WF03 Happy Path Plan

**Decisions frozen (DEC-WF03-G1..G15).** Executable scope = 8 screens (S05 FUTURE / WF04). Deterministic flows supported by the frozen SOT, on the seed: HUB Network → Chapter 01 (leader `leader@example.test`, HUB_COMMUNITY_LEADER on Chapter 01), Chapter 02 (no members), Club 01 under Chapter 01, `ops@example.test` PLATFORM_ADMIN, `pending@example.test` with a PENDING_APPROVAL request to Chapter 01, events b000…01 (PUBLISHED, standalone) and …02 (DRAFT, programme-linked). A **(G)** reference names the frozen decision the flow implements; **(C1)** marks a flow still waiting for OPEN-WF03-C1.

## Happy paths
| ID | Flow | Actor | Screens | Checks |
|---|---|---|---|---|
| HC-WF03-01 | Operator views the managed network | Leader; Platform Admin | S01 | Leader sees only Chapter 01 (no inheritance); admin sees HUB / Chapter / CLB per contract; counts match canonical rows **(G11)** |
| HC-WF03-02 | Chapter operator opens own unit | Leader | S02 | Every counter equals its named SQL query; pending requests = 1 **(G1)** |
| HC-WF03-03 | Operator lists and finds members | Leader | S03 | Chapter 01 relationships only; safe projection; no email / PII; PRIVATE honoured **(G3, G4)** |
| HC-WF03-04 | Membership request review: approve | Leader | S04 → WF02-S04 | PENDING → ACTIVE, `ORGANIZATION_VERIFIED`, `MEMBERSHIP_APPROVED`; the member's `/me/roles` shows ACTIVE **(G5, G14)** |
| HC-WF03-05 | Membership request review: reject | Leader | S04 | PENDING → REJECTED, `MEMBERSHIP_REJECTED`; REJECTED → ACTIVE is 409 **(G5, G14)** |
| HC-WF03-06 | Record leadership | Leader | S04 | LeadershipRecord ACTIVE with title, `LEADERSHIP_CREATED`; **no** RoleAssignment, capability or scope **(G6)** |
| HC-WF03-07 | Close leadership, history kept | Leader | S04 | ACTIVE → ALUMNI / REVOKED with `ended_at`, `LEADERSHIP_ENDED`; row kept **(G6, G14)** |
| ~~HC-WF03-08~~ | View unit programmes | — | S05 | **FUTURE / WF04 (G12)** — not in the executable scope |
| HC-WF03-09 | Edit unit profile | Leader | S06 → S09 | Canonical, design-approved fields saved, `ORGANIZATION_UPDATED`; public page reflects it **(G8, C1)** |
| HC-WF03-10 | Standalone Event lifecycle | Leader | S07 → S09 | Create DRAFT (`programme_id` NULL) → edit → publish → visible on S09 → cancel; `EVENT_*` audit; no registration **(G2, G10, G14)** |
| HC-WF03-11 | Relationship with history | Leader / Admin | S08 | Per C1; one ACTIVE PARENT per child; no `parent_id` writes **(G9, C1)** |
| HC-WF03-12 | Public unit page and join | Guest; member | S09 → WF01 / WF02-S04 | Public-safe projection only; guest join → /auth; signed-in member → PENDING_APPROVAL request **(G13)** |
| HC-WF03-13 | Member sees the relationship outcome | Member | WF02-S01 / S04 | After HC-04 the member's network shows ACTIVE; nothing else changes |

## Alternate / negative (mandatory)
| ID | Case |
|---|---|
| NEG-01 | Guest → every `/ops` route → /auth; APIs 401 |
| NEG-02 | Member without an assignment → `/ops/*` denied; APIs 403 / 404 |
| NEG-03 | Chapter 01 leader on Chapter 02 or Club 01 (child) → denied (no inheritance) |
| NEG-04 | HUB-scope leader on a child Chapter → denied |
| NEG-05 | Forged `orgId` / `membershipId` / `eventId` / `relationshipId` across orgs → 404 |
| NEG-06 | Body spoofing (`state`, `source`, `profile_id` on request; `organization_id` on event) → 422 |
| NEG-07 | Leadership title "Admin" / "Chủ tịch" grants no capability, role or scope (G6) |
| NEG-08 | Invalid transitions → 409 (REJECTED → ACTIVE, CANCELLED → PUBLISHED, edit closed relationship) |
| NEG-09 | PRIVATE discovery member: ops reads omit discovery fields **(G4)** |
| NEG-10 | Public page: unpublished org → 404; no person email / phone anywhere |
| NEG-11 | Concurrent approve / reject of one request → one transition, one audit |
| NEG-12 | Server logs and audit payloads: no email / token / cookie / DTO (G14) |
| NEG-13 | PLATFORM_ADMIN gets no PII bypass in ops reads (G4) |
| NEG-14 | `/ops/org/:orgId/programmes` stays a placeholder; no programme API (G12) |

## Related
- [WF03_PRE_IMPLEMENTATION_AUDIT.md](WF03_PRE_IMPLEMENTATION_AUDIT.md) — audit
- [WF03_SCREEN_IMPLEMENTATION_PLAN.md](WF03_SCREEN_IMPLEMENTATION_PLAN.md) — plan
