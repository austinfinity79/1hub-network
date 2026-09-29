# PO Decision Freeze

TASK 22-L1-L2-PO-DECISION-FREEZE: the PO's Internal Alpha decisions of 2026-09-29 applied to L1 / L2 ([DEC-PDF](../../decisions/DECISION_LOG.md#dec-pdf)). Local run on the final production build (port 3972). Start HEAD `6686468`. Not pushed, not deployed, L5 not started.

## Decisions as built
| ID | Decision | Built | Evidence |
|---|---|---|---|
| D-V1 | public eligibility | `projects.visibility` (PRIVATE default, DRAFT never PUBLIC); `POST /ventures/{id}/publish`, owner only, five fields checked on the server; editor "Hiển thị" with "Công khai"; ME7 chip | `venture.db-test` D1 (6), `pdf-alpha-decisions` D1 (2), `schema.db-test` |
| D-T1 | invite by link | DEFERRED; e-mail invitation unchanged; PRJ2 link row inert with "Tính năng giai đoạn sau" | `pdf-alpha-decisions` D2, UAT G, H |
| D-V2 | "48 fields" | no rule, no count; completion stays the frozen groups | completion tests unchanged and green |
| D-E1 | invitation e-mail | approved subject, sentence with the inviter, "Xem lời mời"; no level, token or id | `invitations.db-test` D4 (3), UAT G, `wf02-s05`, `wf02-s06` |
| VENTURE_STAGE | stages | IDEA, MVP, PILOT, SELLING, GROWTH on the ids of 011; `stage.code` in the DTO | `schema.db-test`, `venture.db-test` stage codes, `wf02-s05`, UAT E |
| D-S1 | specialisation | the eight items frozen, controlled ids | `schema.db-test` D6A |
| D-H1 | HUB verifier | `hub_declaration`; review needs `membership:confirm` platform-wide; leader 403, note on the detail, no buttons in the list | `review.db-test` D6B (2), `complete.db-test`, `pdf-alpha-decisions` D6B |

## Interpretations recorded
| Point | Reading | Why |
|---|---|---|
| Publishing and status | "Công khai" makes a DRAFT ACTIVE and PUBLIC together | "DRAFT remains absent from public"; a database check keeps DRAFT private |
| Public read path | none exists; PUBLIC grants no read yet | the contract has no public venture endpoint; building one was not asked |
| "owner/editor with permission" | the owner alone invites | DEC-L2R-D7 gives no member the invite right; the PO asked to keep existing security |
| "HUB internal ops" | acts through a Platform Admin assignment | the P0 catalogue has no such role; no role or capability was invented |
| Which requests need the Platform Admin | the ones filed from the ACC-08 declaration | ordinary join requests (`/me/roles`) stay the unit's (DEC-WF03-G5, WF03 protected) |
| E-mail without a role | the sentence ends at the venture | the template has no fallback text; nothing was invented |

## Gates
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| unit | 254 / 254 |
| database and API | 448 / 448 (12 more than L2: publication and stage codes 6, e-mail copy 1 more (3 rewritten), declarations 2, schema 3; DTO shapes updated) |
| decision spec (`pdf-alpha-decisions`) | 4 / 4 |
| WF01 impacted (ACC-08, ACC-10, ACC-07, UAT, e-mailed link, runtime) | 62 / 62 |
| WF02 (13 specs, UAT A–M, L2 pixel, responsive, runtime) | 170 / 170 |
| security and RBAC (session, authorization, release matrix, referrer; WF03 members, review, UAT) | 49 / 49 |
| smoke: landing, shell, shell routes, WF04, WF05, Library / About, console | 10, 14, 36, 15, 40, 13, 4 |
| runtime (WF02 owner + invitee, WF01 onboarding) | hydration #418 0, responses ≥ 400 0, failed requests 0, console errors 0 |

417 browser tests, 0 failed on the final build. The first run had 2 failures: the WF02-S05 DTO key list (now with `visibility`) and IA-P2-03 at 390 px, where a declaration row's narrow "Mở →" widened that row's person column past the visible frame. The pending table now keeps an action column at least the width of the two buttons (165 px, identical for the other rows); the affected specs (release matrix, WF03 S03 / S04 / UAT with the L26 pixel, WF02-S05, decisions) passed again on the rebuilt server, 45 / 45. A full global run was not required: no shared auth, session or RBAC code changed (the matrix and `authorize` are untouched; D6B asks for the existing capability at platform scope).

## Related
- [open-decisions.md](open-decisions.md) · [l2-closure.md](l2-closure.md) · [l1-closure.md](l1-closure.md) · [overview.md](overview.md)
- [../reports/TASK-22-L1-L2-PO-DECISION-FREEZE.md](../reports/TASK-22-L1-L2-PO-DECISION-FREEZE.md)
