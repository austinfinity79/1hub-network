# L1 Closure

TASK 22-L1-L2-SOT-REALIGN, L1 only: the evidence for closing the WF01 part ([DEC-L1R](../../decisions/DECISION_LOG.md#dec-l1r)). Local run of 2026-09-29: production build on port 3972, PostgreSQL from `.env.example`. Not pushed, not deployed. L2 has not started.

## Checkpoint
| Item | Value |
|---|---|
| Start HEAD | `5fcbae1`, compared again before each commit; no concurrent change |
| Business, data, auth | `5fcbae1` feat(wf01): open sign-up and four-stage onboarding data |
| Screens | `d0ca155` fix(wf01): align onboarding UI with latest SOT |
| Tests | `551b8e6` test(wf01): update onboarding UAT and regression |
| Documents | the commit that contains this file |

## Flow as built
| Stage | Frame | Screen | Route |
|---|---|---|---|
| entry | ACC-05 | WF01-S09 | `/onboarding` |
| 1 BASIC | ACC-06 | WF01-S06 | `/onboarding/profile` |
| 2 CAPABILITY | ACC-07 | WF01-S10 | `/onboarding/capability` |
| 3 ROLE | ACC-08 | WF01-S05 | `/onboarding/purpose` |
| 4 REVIEW | ACC-09 | WF01-S07 | `/onboarding/privacy` |
| complete | ACC-10 | WF01-S08 | `/onboarding/complete` |

The task text shortens the flow to "BASIC → CAPABILITY → ROLE + REVIEW → COMPLETE". The workbook and the board draw ROLE and REVIEW as stage 3 and stage 4, two screens, and that is what is built.

## Pixel QA
1440 × 900, DPR 1, full page, against `design-reference/final/revision/L1`. Rule per segment: difference outside text < 1.5 %, difference beyond a ±2 px shift < 2 %. Every capture is new; no evidence of the earlier L1 screens is reused.

| Frame | Segments | Worst outside text | Worst beyond ±2 px | Typography | P0 | P1 | P2 | P3 |
|---|---|---|---|---|---|---|---|---|
| ACC-05 | 6 | 0.09 % | 0.33 % | 29 checked, 0 violations | 0 | 0 | 0 | 0 |
| ACC-06 | 10 | 0.68 % | 0.70 % | 51 checked, 0 violations | 0 | 0 | 0 | 0 |
| ACC-07 | 10 | 0.21 % | 0.78 % | 64 checked, 0 violations | 0 | 0 | 0 | 0 |
| ACC-08 | 7 | 0.41 % | 1.20 % | 34 checked, 0 violations | 0 | 0 | 0 | 0 |
| ACC-09 | 9 | 0.62 % | 0.78 % | 67 checked, 0 violations | 0 | 0 | 0 | 1 |
| ACC-10 | 6 | 0.25 % | 0.98 % | 17 checked, 0 violations | 0 | 0 | 0 | 0 |

| Recorded difference | Class |
|---|---|
| No "AI" mark, banner or suggested value; the AI-filled rows of the board keep their plain height | intentional, scope (D-A1) |
| The dark confirmation of ACC-09 carries the consent sentence, not the AI sentence | intentional, business (D-L1) |
| Completion percent and missing list are the server's (frozen ten groups) | intentional, business (D-C1) |
| P3: the preview's role chips follow the order of ACC-08, as the board's own review row does; the board's card draws "Founder" before "Innovator" | intentional, business |

## Responsive
`wf01-onboarding-responsive.spec.ts`, 28 / 28: six screens and the experience dialog at 1440, 1024, 768 and 390 px. No page overflow, every action reachable and not covered by the "Góp ý" pill, text not clipped.

## Security
| Check | Evidence | Result |
|---|---|---|
| New address creates the account only when its link is used | `wf01-email-magic-link` C, C2, C3; UAT A | PASS |
| One account, one profile under concurrent writes | UAT E; `complete.db-test`, `onboarding.db-test` | PASS |
| Expired, used, malformed link | UAT H; `wf01-s03`, `wf01-s04` | PASS |
| Cookie HttpOnly, Secure, SameSite; token removed from the URL | UAT A; `auth-session` | PASS |
| Role and scope spoofing by header, query or body | UAT F; `internal-alpha-release` REL-SEC matrix | PASS |
| Declared role or HUB claim gives no capability, leadership, role assignment or managed scope | UAT F; `wf01-s05` F; `roles.db-test` | PASS |
| Another account's declaration, profile or avatar | `wf01-s05` IDOR; UAT G | PASS |
| Visibility filters what others read | UAT G | PASS |

Privilege regressions: 0.

## Gates
| Gate | Result |
|---|---|
| format, lint, typecheck | PASS |
| unit | 258 / 258 |
| database and API | 406 / 406 |
| production build | PASS |
| WF01 visual and functional specs | 188 / 188 |
| UAT matrix | 14 / 14 (A–H and UAT-05, 06, 08, 11, 12, 13) |
| regression gate | GREEN: [l1-regression-gate.md](l1-regression-gate.md) |
| runtime on the onboarding journey | hydration #418 0, responses ≥ 400 0, failed requests 0, console errors 0 (204 responses, 34 assets) |

## Open after L1
| ID | Item | Kind |
|---|---|---|
| D-H1 | who verifies a HUB position, and how | human business decision |
| D-S1 | final specialisation list (eight board items in the local database) | human business decision; PO approval before any deploy |
| D-G1 | Google OAuth client | external configuration blocker |
| D-A1 | AI provider and data-processing terms | external, optional capability |

## Related
- [overview.md](overview.md) · [l1-screen-contracts.md](l1-screen-contracts.md) · [l1-conflict-record.md](l1-conflict-record.md) · [l1-regression-gate.md](l1-regression-gate.md) · [open-decisions.md](open-decisions.md)
- [../WF01_UAT_MATRIX.md](../WF01_UAT_MATRIX.md) · [../reports/TASK-22-L1-SOT-REALIGN_l1-closure.md](../reports/TASK-22-L1-SOT-REALIGN_l1-closure.md)
