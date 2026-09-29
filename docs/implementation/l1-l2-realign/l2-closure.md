# L2 Closure

TASK 22-L1-L2-SOT-REALIGN, L2: evidence for closing the WF02 part ([DEC-L2R](../../decisions/DECISION_LOG.md#dec-l2r)). Local run of 2026-09-29, production build on port 3972, PostgreSQL from `.env.example`. L1 baseline `5d8cf56` is unchanged except for the shared dialog defect DEC-L2R-D12. Not pushed, not deployed.

## Checkpoint
| Item | Value |
|---|---|
| Start HEAD | `5d8cf56`, compared again before each commit |
| Business, data, API | `c9c7cb5` feat(wf02): align project startup lifecycle with latest SOT |
| Screens | `25fa970` fix(wf02): align member workspace UI with latest Figma |
| Tests | `d64a2d9` test(wf02): update UAT and security regression |
| Documents | the commit that contains this file |

## What was built
| Area | Result | Decision |
|---|---|---|
| Workspace | `/me` FP1-OWN (profile, experience, education, specialisation, skills, completion, own ventures); `/projects` ME7 (ventures, pending invitations, empty state); ME0 invitation row | D1, D2 |
| Profile | edited in place on the canonical IndividualProfile; education writable; no second profile model | D3 |
| Create | one Venture, `type` PROJECT or STARTUP; name, field, description, stage required on the server; creator role optional display text | D4, D5, D6 |
| Lifecycle | DRAFT on create, never published; `Idempotency-Key` on create; refresh and back re-read the stored draft; create and update audited | D9 |
| Team | e-mail invitation → PENDING_CONFIRMATION → accept → ACTIVE; levels Chủ sở hữu / Biên tập / Xem; link invitation drawn, inert | D7, D8 |
| Migration | `011_p0_venture_lifecycle.sql`, additive: `VENTURE_STAGE` vocabulary, `projects.stage_id`, `projects.owner_role_label`, `project_members.permission` | D5, D6, D7 |

## Pixel QA
1440 × 900, DPR 1, against `design-reference/final/revision/L2`. Per segment: difference outside text < 1.5 %, beyond a ±2 px shift < 2 %. All captures are new; no earlier WF02 evidence is reused.

| Frame | Screen | Segments | Worst outside text | Worst beyond ±2 px | Typography | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|---|---|---|---|
| FP1-OWN | WF02-S01 `/me` | 11 | 1.24 % | 1.77 % | 74, 0 violations | 0 | 0 | 0 | 0 |
| L12 | dialog on `/me` | 2 | 0.93 % | 0.39 % | 78, 0 violations | 0 | 0 | 0 | 0 |
| ME7 | WF02-S08 `/projects` | 5 | 0.67 % | 1.68 % | 44, 0 violations | 0 | 0 | 0 | 0 |
| PRJ1 | WF02-S05 step 1 | 7 | 0.88 % | 1.56 % | 43, 0 violations | 0 | 0 | 0 | 0 |
| PRJ2 | WF02-S05 step 2 | 9 | 1.38 % | 0.93 % | 35, 0 violations | 0 | 0 | 0 | 0 |
| PRJ3 | WF02-S05 step 3 | 3 | 0.62 % | 0.91 % | 14, 0 violations | 0 | 0 | 0 | 0 |

Every intentional difference is listed in its report (`tests/visual/reports/pixel-qa/WF02-*.revision.json`): scope (D-P1, D-A1, D-T1, D-V2, L5 annotations), business (D-V1, D-C1, fixed type), privacy (a pending row shows the address only).

## Responsive
`wf02-l2-responsive.spec.ts`, 29 / 29: FP1-OWN, ME7, PRJ1, PRJ2, PRJ3, the editor and the team page at 1440, 1024, 768 and 390, plus the dialog at 390. No page overflow; every action reachable; the team table scrolls inside its frame (IA-P2-03).

## Security
| Check | Evidence | Result |
|---|---|---|
| Owner from the session; client owner, profile, status or permission keys refused | UAT B, K; `venture.db-test` | PASS |
| IDOR: another member reads or changes nothing of the venture, team or invitations | UAT J; `wf02-s05`, `s06`, `s08`; REL-SEC matrix | PASS |
| Role spoof by header, query or body | UAT K; `wf02-s06`; REL-SEC matrix | PASS |
| Privilege escalation: creator role and levels grant no platform right; Biên tập cannot invite, change levels or remove | UAT F, I; `wf02-s06`; `team.db-test` | PASS |
| DRAFT never public | UAT M | PASS |
| Pending invitations shown to the invited address only | UAT L; `wf02-s08` | PASS |
| Invitation e-mail: no token, escaped HTML; send limits; pending cap under concurrency | UAT G; `invitations.db-test` | PASS |

Privilege regressions: 0.

## Gates
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| unit | 254 / 254 |
| database and API | 436 / 436 |
| WF02 (13 specs: S01–S08, T00, UAT, L2 pixel, responsive, runtime) | 170 / 170 |
| UAT matrix A–M + guards | 16 / 16 |
| regression gate | GREEN: [l2-regression-gate.md](l2-regression-gate.md) |
| runtime on the owner and invitee journeys | hydration #418 0, responses ≥ 400 0, failed requests 0, console errors 0 (12 routes, 370 responses, 31 assets) |

## Open after L2
| ID | Item | Kind |
|---|---|---|
| D-V1 | when a venture is public | **HUMAN BUSINESS DECISION REQUIRED: PUBLIC ELIGIBILITY RULE** |
| D-T1 | link invitation rules | human business decision |
| D-V2 | the 48 fields of the completion count | human business decision |
| D-E1 | invitation e-mail text | PO copy review |
| D-A1 | AI provider | OPTIONAL EXTERNAL CAPABILITY LIMITATION |
| D-S1, D-H1 | specialisation list, HUB verification (from L1) | human business decisions |
| VENTURE_STAGE | the five stage items | PO approval before any deploy |

## Related
- [overview.md](overview.md) · [l2-delta-matrix.md](l2-delta-matrix.md) · [l2-delta-team.md](l2-delta-team.md) · [l2-screen-contracts.md](l2-screen-contracts.md) · [l2-regression-gate.md](l2-regression-gate.md) · [open-decisions.md](open-decisions.md)
- [../WF02_UAT_MATRIX.md](../WF02_UAT_MATRIX.md) · [../reports/TASK-22-L2-SOT-REALIGN_l2-closure.md](../reports/TASK-22-L2-SOT-REALIGN_l2-closure.md)
