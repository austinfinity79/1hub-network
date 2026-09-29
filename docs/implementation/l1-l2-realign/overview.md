# L1 L2 Realign Overview

TASK 22-L1-L2-SOT-REALIGN: WF01 / WF02 business flow and Figma correction. Reopens the CLOSED workflows WF01 and WF02 on new evidence from the PO (CLAUDE.md §14): the BA workbook of 28/09 and the two flow boards of 28/09.

## Source freeze
| Source | File (operator machine) | SHA-256 | Used for |
|---|---|---|---|
| Business SOT | `1hub.network _ BA  (2).xlsx`, sheet `2. Actor` | `f3be3e1afb20d849147c71b9727363d0df22f59ef86c678b2d9b81de527a1d03` | WF-01 rows 43–75, WF-02 rows 77–107; rules in `3. Biz Rules` |
| L1 board | `Luồng 1 · Identity & Onboarding.png`, 16440 × 4596 | `6587ddb282958b37…` | 13 frames |
| L2 board | `Luồng 2 · Member Profile & Network Management.png`, 16440 × 5078 | `305d75ead8e3c053…` | 13 frames |

The prompt's `/mnt/data/…` paths do not exist on this machine; the files above are the newest copies by name and date.

## Priority
| Topic | Order |
|---|---|
| Business logic | workbook `2. Actor` > old decisions > old workflow docs |
| Screen structure | boards > old implementation > old screenshots |
| Workbook against board | no resolution is invented: the conflict is recorded in [open-decisions.md](open-decisions.md) and only that behaviour stops |

## What the boards change
| Group | Frames | State |
|---|---|---|
| Pixel-identical to the repository references | AUTH1, AUTH2, AUTH3, AUTH4, ACC-10, ME0, PRJ1, PRJ2, PRJ3 | design unchanged; behaviour changes only |
| New for WF01 | ACC-05, ACC-06 (empty, AI-filled), ACC-07, ACC-08, ACC-09, FP1-OWN | not implemented |
| New for WF02 | ME7, experience editor dialog, FP1 (public view) | not implemented |
| Outside WF01 / WF02 | ORGP1, DIR1, EV2, NOTI1, EV1, two annotation panels | not in this task |

Details: [frame-inventory.md](frame-inventory.md).

## Superseded by the PO task
| Old rule | New rule |
|---|---|
| Invite-only sign-in (DEC-AUTH-EMAIL-D1) | any valid address may start an account through the verified magic link; provisioned accounts stay valid |
| Onboarding purpose → profile → privacy (WF01-S05…S07) | four stages: basic information, capability and field, ecosystem role, review and finish |
| Venture create without stage and creator role (DEC-L2) | stage and creator role are collected and stored |
| Google control drawn disabled with "Sắp có" (DEC-L1-D9) | drawn as in the board; works only when OAuth is configured |

## Phases
| Phase | Content | Commit |
|---|---|---|
| 0 | source freeze, audit, matrices, decisions | docs |
| 1 | L1 business: open registration, account lifecycle, data model | code + migration |
| 2 | L1 screens: ACC-05…ACC-09, ACC-10 next actions | code |
| 3 | L2 business: stage, creator role, permissions, invitations, list | code + migration |
| 4 | L2 screens: PRJ1–3 deltas, ME7, FP1-OWN, dialogs | code |
| 5 | pixel, responsive, security, protected regression, docs | tests + docs |

No deploy and no push in this task. The PO chose to receive L1 first: this run ends after phase 2 with the L1 tests, pixel audit and protected regression; phases 3 and 4 follow in the next run.

State: L1 closed at `5d8cf56` ([l1-closure.md](l1-closure.md)). L2 (phases 3, 4 and its part of 5): [l2-closure.md](l2-closure.md).

## Related
- [frame-inventory.md](frame-inventory.md) · [l1-delta-matrix.md](l1-delta-matrix.md) · [l2-delta-matrix.md](l2-delta-matrix.md) · [open-decisions.md](open-decisions.md)
- [l1-screen-contracts.md](l1-screen-contracts.md) · [l1-conflict-record.md](l1-conflict-record.md) · [l1-closure.md](l1-closure.md) · [l1-regression-gate.md](l1-regression-gate.md)
- [l2-delta-team.md](l2-delta-team.md) · [l2-screen-contracts.md](l2-screen-contracts.md) · [l2-closure.md](l2-closure.md)
- [../../design-revision/05_BUSINESS_API_DATA_CONFLICT_MATRIX.md](../../design-revision/05_BUSINESS_API_DATA_CONFLICT_MATRIX.md) — the earlier HD register
