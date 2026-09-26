# WF03 Happy Path Plan

Deterministic flows supported by the frozen SOT, on the seed: HUB Network → Chapter 01 (leader `leader@example.test`, HUB_COMMUNITY_LEADER on Chapter 01), Chapter 02 (no members), Club 01 under Chapter 01, `ops@example.test` PLATFORM_ADMIN, `pending@example.test` with a PENDING_APPROVAL request to Chapter 01, events b000…01 (PUBLISHED, standalone) and …02 (DRAFT, programme-linked). A flow marked **(G)** depends on the listed decision.

## Happy paths
| ID | Flow | Actor | Screens | Checks |
|---|---|---|---|---|
| HC-WF03-01 | Operator views the managed network | Leader; Platform Admin | S01 | Leader sees only Chapter 01; admin sees all HUB / Chapter / CLB; counts match canonical ACTIVE rows **(G11)** |
| HC-WF03-02 | Chapter operator opens own unit | Leader | S02 | §8.2 metrics equal SQL counts; pending requests = 1 **(G1)** |
| HC-WF03-03 | Operator lists and finds members | Leader | S03 | ACTIVE + PENDING rows of Chapter 01 only; no email / PII **(G3, G4)** |
| HC-WF03-04 | Membership request review: approve | Leader | S04 → WF02-S04 | PENDING → ACTIVE, `ORGANIZATION_VERIFIED`, audit; the member's `/me/roles` shows ACTIVE **(G5, G14)** |
| HC-WF03-05 | Membership request review: reject | Leader | S04 | PENDING → REJECTED; no second open row; REJECTED → ACTIVE is 409 **(G5)** |
| HC-WF03-06 | Record leadership | Leader | S04 | LeadershipRecord ACTIVE with title; **no** RoleAssignment, capabilities unchanged **(G6)** |
| HC-WF03-07 | Close leadership, history kept | Leader | S04 | ACTIVE → ALUMNI / REVOKED with `ended_at`; row kept **(G6)** |
| HC-WF03-08 | View unit programmes | Leader | S05 | Read-only; no create **(G12)** |
| HC-WF03-09 | Edit unit profile | Leader | S06 → S09 | Description / logo saved; public page reflects it **(G8)** |
| HC-WF03-10 | Standalone Event lifecycle | Leader | S07 → S09 | Create DRAFT (`programme_id` NULL) → edit → publish → visible on S09 → cancel **(G2, G10)** |
| HC-WF03-11 | Relationship with history | Leader / Admin | S08 | Create → close; closed row immutable, still listed **(G9)** |
| HC-WF03-12 | Public unit page and join | Guest; member | S09 → WF01 / WF02-S04 | Guest sees public data only; "Xin vào" → /auth; signed-in member → PENDING_APPROVAL request **(G13)** |
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
| NEG-07 | Leadership title "Admin" / `role_label` grants no capability |
| NEG-08 | Invalid transitions → 409 (REJECTED → ACTIVE, CANCELLED → PUBLISHED, edit closed relationship) |
| NEG-09 | PRIVATE discovery member: ops reads omit discovery fields **(G4)** |
| NEG-10 | Public page: unpublished org → 404; no person email / phone anywhere |
| NEG-11 | Concurrent approve / reject of one request → one transition, one audit |
| NEG-12 | Server logs: no email / token / cookie |

## Related
- [WF03_PRE_IMPLEMENTATION_AUDIT.md](WF03_PRE_IMPLEMENTATION_AUDIT.md) — audit
- [WF03_SCREEN_IMPLEMENTATION_PLAN.md](WF03_SCREEN_IMPLEMENTATION_PLAN.md) — plan
