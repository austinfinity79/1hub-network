# TASK-24.4 L5 Startup Closure

**TASK 24.4 — L5 STARTUP JOURNEY: GREEN (local, not pushed, not deployed).** A founder applies to a PUBLISHED programme from the member area and the application lives on the server: SUB0 quick team (L37) → SUB1 form (L38–L41) → SUB2 review (L42) → SUB3 submitted (L43). It reuses the canonical account, IndividualProfile, Venture and Programme; the Application stores only the programme's answers and, once submitted, a snapshot. Inventory [../task-24/l5-startup-inventory.md](../task-24/l5-startup-inventory.md), contract [../task-24/l5-startup-contract.md](../task-24/l5-startup-contract.md), decisions [DEC-L5-D1…D6](../../decisions/DECISION_LOG.md#dec-l5-d1).

## Checkpoint (PO freeze of 29/09)
| Item | State |
|---|---|
| Decisions recorded | [DEC-2909](../../decisions/DECISION_LOG.md#dec-2909): L2-H1…H5, L3-H1…H2, L4-H1…H2 CLOSED; [DEC-L5-D1…D6](../../decisions/DECISION_LOG.md#dec-l5-d1): HD-A8, migration 013, HD-A10, HD-A11 (HD-A12 / A13 defaults) |
| 24.4 scope | the founder journey only; no operator administration, judging, scoring, programme configuration, campaign e-mail, applicant administration or dashboard |
| Files changed before the pause | none |
| Conflicts | none |

## Lifecycle and permissions
| Rule | Where |
|---|---|
| DRAFT → SUBMITTED only; SUBMITTED final (409 on save / submit; DB trigger refuses any UPDATE) | service + migration 013 |
| One active application per (venture, programme): partial unique index; a second start → 409 `APPLICATION_EXISTS` with its id | service + index |
| Owner only: anyone else, malformed or unknown id → the same 404; a member of the team → 403 on create, 404 on the application | `ownRow`, `assertEligible` |
| A foreign venture cannot be attached (404); a foreign application cannot be read, saved or submitted (404); body fields other than the contracted ones → 422 | service |
| Double submit / double start: `Idempotency-Key` per visit (`application.create`, `application.submit`, amendment A4) and a row lock | API routes |
| Audit `APPLICATION_DRAFT_CREATED`, `APPLICATION_SUBMITTED`: ids and statuses, never answers | `audit.ts` |

## Files
| Class | Files |
|---|---|
| Migration / seed | `db/migrations/013_p0_applications.sql` (new, additive); `db/seed/seed_p0_deterministic.sql` (programme `d4000000-…01` and its form) |
| Service / API | `src/lib/application/*` (new); `src/app/api/v1/applications/**`, `src/app/api/v1/me/applications/route.ts` (new) |
| Screens | `src/components/application/*`, `src/app/(member)/programmes/[programmeId]/apply/`, `src/app/(member)/projects/[id]/applications/[programmeId]/{,review,submitted}` (new) |
| SHARED | `src/lib/api/{error-codes,idempotency}.ts`, `src/lib/audit/audit.ts`, `docs/architecture/05_API_CONTRACT_P0_v1.0.md` §21 A4, `DECISION_LOG.md` |
| WF05 (FLOW-LOCAL) | S01 / S02 read server applications and link to L5; S03 / S04 paths redirect (HD-A10); the browser store, its harness, S03 / S04 screens and specs removed; notice copy says applications are real |
| Tests | `tests/visual/specs/l5-startup-journey.spec.ts` (new); WF05 T00 / S01 / S02 / UAT rewritten; WF04 and release invariants accept the two approved tables; `application.db-test.ts` (new); idempotency / schema / contract counts |
| Baselines | `design-reference/final/revision/L5/L37…L43__*__SOURCE.png` (crops of the PO board, not captures) |

## Tests
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| Unit (vitest) · DB (vitest db) | 252 / 252 · 462 / 462 |
| L5 spec: journey, entry routing, ownership / IDOR, responsive ×4, pixel ×6 | 13 / 13 |
| WF05 FULL: T00, S01, S02, UAT (HC-01…04, SEC, NEG, SERVER, NAV, VIS) | 38 / 38 |
| Smoke L1 / L2 UAT (`tests/uat`) | 19 / 19 |
| Smoke L1–L4 + release: WF01 / WF02 / WF03 / WF04 UAT, Library, WF04 T00 / S05 / S07 / S08, landing, shell, REL (data, 9-identity matrix, responsive) | 184 / 184 (REL-SEC first failed on its own expectation: the review route of a venture without an application redirects to the form; the matrix now checks the form route itself; rerun of the release file 7 / 7) |

## Pixel (1440×900 DPR1, production build; outside-text < 1.5 %, beyond ±2 px < 2 %)
| Frame | Segments | Worst outside · beyond |
|---|---|---|
| L37 SUB0 | header, intro, name, domain, summary, note + action | 0.62 % · 0.92 % |
| L38 SUB1 01 | rule, pill, stepper, answer box, progress, autosave, action | 1.27 % · 0.35 % |
| L40 SUB1 03 | rule, pill, team card, invite | 0.26 % · 0.33 % |
| L41 SUB1 04 | rule, pill, stepper, actions | 1.35 % · 0.45 % |
| L42 SUB2 | title, rule, pill, heading, answer card, venture, submit ends | 0.45 % · 0.80 % |
| L43 SUB3 | hero, primary action, "Trong lúc chờ" | 0.19 % · 0.63 % |

P0 / P1 / P2 = 0. Responsive 1440 / 1024 / 768 / 390: no overflow, every control inside, actions reachable, on SUB0, SUB1 01 / 03 / 04, SUB2, SUB3 and the choice.

## Intentional deviations
| Deviation | Source |
|---|---|
| Programme questions instead of the Problem's S1–S6; no uploads, milestone table, support checklist, commitments, completion %, code, e-mail, timeline, deadline | HD-A8, DEC-L5-D6 |
| "Cách giải" skipped when no question sits on step 2 | DEC-L5-D1 |
| SUB0 asks "Loại hồ sơ" (both types accepted) and "Giai đoạn" (canonical venture) | HD-A11, DEC-L5-D5 |
| SUB3 "Về Dự án & startup của tôi" → `/projects`; submitted answers below the frame | DEC-L5-D4 |
| L44 / L45 public startup profile | FUTURE |

## Related
- [TASK-24.3_l4-challenge-closure.md](TASK-24.3_l4-challenge-closure.md) · [WF05_COMPLETION_AUDIT.md](WF05_COMPLETION_AUDIT.md)
