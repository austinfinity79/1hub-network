# WF03 UAT Matrix

Automated in `tests/visual/specs/wf03-uat-journey.spec.ts` (Playwright, 1440×900, UI-driven, real magic-link sign-in). Screen-level cases stay in each WF03-S0x spec.

Runs on 2026-09-26:
- the dev DB;
- a fresh PostgreSQL (001→009 + seed), UAT 3/3;
- the same fresh DB after an app + PostgreSQL restart: 3/3, twice back-to-back;
- all 66 WF03 specs on the fresh DB.

## Happy path — UAT-WF03-J1 (one journey)
The journey has one new member, the seeded Chapter 01 leader, the platform admin for the two-sided relationship, and a guest.

| ID | Case | Checked | Result |
|---|---|---|---|
| HC-WF03-01..03 | Operator signs in, enters /ops, sees allowed organizations | Magic link → `/ops/network` lists exactly Chapter 01 | PASS |
| HC-WF03-04/05 | Selects the organization; dashboard | `/ops/org/:id`; pending counter = DB count | PASS |
| HC-WF03-06/07 | Members; reviews PENDING_APPROVAL | The new member's row is PENDING → "Mở" → S04 | PASS |
| HC-WF03-08/09 | Approves; membership ACTIVE | ACTIVE, `ORGANIZATION_VERIFIED`; audit {REQUESTED, APPROVED}; 0 RoleAssignment | PASS |
| HC-WF03-10 | Leadership | ACTIVE "Điều phối UAT3"; one LEADERSHIP_CREATED; member session capabilities [] and /ops 404 | PASS |
| HC-WF03-11/12 | Profile; edits the description | Stored; one ORGANIZATION_UPDATED | PASS |
| HC-WF03-13 | Hierarchy | S06 read-only: parent HUB Network, child Club 01 | PASS |
| HC-WF03-14 | Relationship operation | Admin (both ends in scope) attaches a parentless CLB via S08; ACTIVE PARENT; one CREATED; `parent_id` NULL | PASS |
| HC-WF03-15..17 | Event create / edit / publish | PUBLISHED, `programme_id` NULL, Chapter 01; audit {CREATED, UPDATED, PUBLISHED}; WF04 draft absent | PASS |
| HC-WF03-18..20 | Public page as guest | New event, new child and description shown; members +1, children +1, events +1; no member / leader name, email or state | PASS |

## Authorization matrix — SEC-WF03-01
Actors: guest, member, leader (Chapter 01), admin. Calls:
- 6 own reads (S01, S02, S03, S04, S07, S08);
- 9 foreign / IDOR calls: dashboard, members, membership review, leadership end, profile of Chapter 02 and of the child Club 01, event create, HUB relationships, relationship close;
- 3 event-id calls: foreign PATCH / cancel, WF04 event.

| Actor | Result | Outcome |
|---|---|---|
| Guest | 401 on every call | PASS |
| Member | 403 / 404 on every call | PASS |
| Leader | 200 on own reads; 403 / 404 on every foreign / IDOR call | PASS |
| Admin | 200 on own reads; WF04 event 404 (contract guard) | PASS |

Snapshot of memberships, leadership, organizations, relationships, events and audit count: identical before and after.

## Negative / alternate
| ID | Case | Where | Result |
|---|---|---|---|
| NEG-01 | Guest → /auth on every /ops route; 401 on APIs | T00, S01–S08, SEC-WF03-01 | PASS |
| NEG-02 | Incomplete onboarding follows the resolver | T00 spec | PASS |
| NEG-03 | Membership / leadership alone: no ops access, no capability | J1, S03 / S04 / S06 / S07 / S08 specs | PASS |
| NEG-04 | Spoofed orgId / headers / body ids ignored or 422 | S01–S08 specs | PASS |
| NEG-05 | No child inheritance (Club 01 refused for the Chapter 01 leader) | SEC-WF03-01, S02 / S06 specs | PASS |
| NEG-06 | Invalid membership transition 409; approve vs reject race: one winner | S04 DB + spec | PASS |
| NEG-07 | Relationship type / pair invalid 422; second ACTIVE parent 409 (service + DB); cycles 422 | S08 DB + spec | PASS |
| NEG-08 | Event: foreign mutation 404; WF04 event excluded; invalid transitions 409 | S07 DB + spec, SEC-WF03-01 | PASS |
| NEG-09 | Hidden / unknown organization: identical public 404 | S09 spec | PASS |
| NEG-10 | No person, PII or internal data on the public page, even with PUBLIC discovery | S09 spec, J1 | PASS |
| NEG-11 | Invariants: only known audit codes; no duplicate one-shot audits; ≤ 1 ACTIVE parent; no self-parent; RoleAssignments = seed; ≤ 1 open membership; WF03 events never programme-linked | NEG-WF03 | PASS |

## Related
- [WF03_COMPLETION_AUDIT.md](WF03_COMPLETION_AUDIT.md) — audit and verdict
- [WF03_SCREEN_IMPLEMENTATION_PLAN.md](WF03_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [WF02_UAT_MATRIX.md](WF02_UAT_MATRIX.md) — WF02 precedent
