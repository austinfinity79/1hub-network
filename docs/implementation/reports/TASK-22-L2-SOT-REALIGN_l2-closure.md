# TASK-22-L2-SOT-REALIGN L2 Closure

**TASK 22-L1-L2-SOT-REALIGN — L2 (WF02 workspace, venture lifecycle, team): GREEN.** Local only: not pushed, not deployed. L1 baseline `5d8cf56` unchanged except the shared dialog defect (DEC-L2R-D12).
- Sources: BA workbook sheet "2. Actor" WF-02 and "3. Biz Rules" (behaviour); L2 flow board and FP1-OWN of the L1 board (screens); see [overview](../l1-l2-realign/overview.md).
- Decisions: [DEC-L2R-D1…D13](../../decisions/DECISION_LOG.md#dec-l2r); superseded records are marked in place, none deleted.
- Evidence: [l2-closure.md](../l1-l2-realign/l2-closure.md) · [l2-regression-gate.md](../l1-l2-realign/l2-regression-gate.md).

## Scope implemented
| Area | Result |
|---|---|
| Workspace | `/me` FP1-OWN "Hồ sơ của tôi"; `/projects` ME7 "Dự án & startup của tôi" (new WF02-S08) with ventures and pending invitations; ME0 invitation row |
| Profile | edited in place on the canonical IndividualProfile (experience, education, basic, contact, expertise); no second model |
| Create | one Venture, PROJECT or STARTUP; name, field, description, stage required on the server; the creator's role is display text and grants nothing |
| Lifecycle | DRAFT on create, never published; `Idempotency-Key`; refresh and back re-read the draft; create and update audited |
| Ownership | derived from the session; client owner, profile, status or permission keys refused |
| Team | Chủ sở hữu / Biên tập / Xem; e-mail invitation → PENDING_CONFIRMATION → accept → ACTIVE; 20 pending; send limits; link invitation drawn and inert |
| Public eligibility | no rule in the sources: every venture DRAFT and team-only; **HUMAN BUSINESS DECISION REQUIRED: PUBLIC ELIGIBILITY RULE** |
| AI | PRJ1 block drawn and inert; manual create complete; nothing written by AI |

## Files changed
| Commit | Content |
|---|---|
| `c9c7cb5` | migration 011, `src/lib/venture/**`, `profile.ts` (education), audit, vocabulary, error and idempotency registries, venture and `/me` API routes, dev invitation outbox, database tests |
| `25fa970` | `src/app/(member)/me/**`, `src/app/(member)/projects/**`, shell (`workspace-shell`, `feedback-pill`), member and workspace nav, routes, screen contracts YAML, L2 references, shared L12 dialog, their unit tests; account home removed |
| `d64a2d9` | `tests/visual/support/workspace.ts`; WF02 specs new or rewritten (S01, S05–S08, T00, UAT A–M, L2 pixel, responsive, runtime); specs of other workflows moved to the L2 rules |
| documents | decision log, API contract amendment A2 (§19), WF02 workflow note, UAT matrix, `l1-l2-realign/`, status, this report |

## Migrations and data
- `db/migrations/011_p0_venture_lifecycle.sql`, additive: `VENTURE_STAGE` vocabulary (Ý tưởng, Prototype, Pilot, Đang bán, Đã mở rộng; fixed ids), `projects.stage_id`, `projects.owner_role_label`, `project_members.permission` (`EDIT` / `VIEW`, existing rows `VIEW`). Local and test database only. **The stage list waits for PO approval before any deploy.**

## Tests and build
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| unit | 254 / 254 |
| database and API | 436 / 436 |
| WF02 specs | 170 / 170 |
| UAT A–M + guards | 16 / 16 |
| regression gate | GREEN by the PO rule of 2026-09-29: WF02 170, security 31, shell routes 36, WF01 77, landing 10, shell 14, WF03 3, WF04 15, WF05 66, About / Library / entry / console 21; 443 browser tests, 0 failed |
| runtime | hydration #418 0, HTTP 5xx 0, broken assets 0, console errors 0 |

## Visual QA
FP1-OWN, L12, ME7, PRJ1, PRJ2, PRJ3 at 1440 × 900 DPR 1, all captures new: every segment under the thresholds, P0 / P1 / P2 = 0, P3 = 0; typography 0 violations. Responsive 1440 / 1024 / 768 / 390: 29 / 29. No baseline image overwritten.

## Deviations and blockers
| Item | Kind | State |
|---|---|---|
| D-V1 public eligibility | human business decision | DRAFT, team-only; no publish action |
| D-T1 link invitation | human business decision | drawn, inert; NOT SUPPORTED BY CONTRACT |
| D-V2 "Hồ sơ n/48 trường" | human business decision | not shown |
| D-E1 invitation e-mail text | PO copy review | short text from the board's sentence |
| D-A1 AI provider | OPTIONAL EXTERNAL CAPABILITY LIMITATION | none configured |
| `VENTURE_STAGE` list | PO approval before deploy | local only |
| Pre-commit review | quality | 1 major (invitation e-mail flood) and 6 minor fixed with tests; 1 note kept by design |
| Blocking gaps for L2 | | 0 |

## Git
- Branch: `main`; start HEAD `5d8cf5609711cd6ebee069051c0299011d92d48e`, compared again before each commit; no concurrent change
- Implementation commits: `c9c7cb5` (feat), `25fa970` (fix), `d64a2d9` (test)
- Report/final commit: the commit containing this report, `docs(wf02): supersede legacy decisions`
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** (the task forbids a push)
- Remote HEAD: `53599925f5aef6abf20127e293611e4f758f898b` (tracking ref), not changed by this task; local `main` is ahead of it
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
L1 + L2 PO REVIEW → freeze the corrected exact SHA → deploy corrected L1 / L2. Not started automatically.

## Related
- [../l1-l2-realign/l2-closure.md](../l1-l2-realign/l2-closure.md) · [../l1-l2-realign/open-decisions.md](../l1-l2-realign/open-decisions.md) · [../WF02_UAT_MATRIX.md](../WF02_UAT_MATRIX.md)
