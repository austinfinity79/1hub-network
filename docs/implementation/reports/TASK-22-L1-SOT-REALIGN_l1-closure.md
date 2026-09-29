# TASK-22-L1-SOT-REALIGN L1 Closure

**TASK 22-L1-L2-SOT-REALIGN — L1 (WF01 business flow + Figma correction): GREEN.** Local only: not pushed, not deployed. L2 not started.
- Sources: BA workbook sheet "2. Actor" WF-01 (behaviour), L1 flow board of 28/09 (screens); see [overview](../l1-l2-realign/overview.md).
- Decisions: [DEC-L1R-D1…D8](../../decisions/DECISION_LOG.md#dec-l1r); superseded records are marked in place, none deleted.
- Evidence: [l1-closure.md](../l1-l2-realign/l1-closure.md).

## Scope implemented
| Area | Result |
|---|---|
| Sign-up | any valid address receives the one-time link; the account row is written when the link is used; the answer is the same for known and unknown addresses |
| Token and session | hash only, 15 minutes, single use, rate limits 10 per address and 30 per IP per 15 minutes, HttpOnly Secure SameSite cookie: unchanged |
| Flow | ACC-05 intro → ACC-06 basic → ACC-07 capability → ACC-08 role → ACC-09 review → ACC-10 → `/me`; the server resolver decides the step and every stage resumes after refresh or a new sign-in |
| ACC-06 | full name, display name, country, province required; current role, introduction, avatar, private phone optional |
| ACC-07 | fields, specialisations (at most five), skills and countries from the controlled vocabulary, experience with months, links |
| ACC-08 | six self-declared roles; HUB unit, position, period kept as a draft "Chờ xác minh" |
| ACC-09 | review of the three stages, network card preview with the declared roles as descriptive chips, server completion, visibility switch, one required confirmation that records two versioned consents |
| ACC-10 | shows to completed accounts only; next actions only for routes that exist |
| Google | control drawn as the board draws it; pressing it signs nobody in and explains that Google sign-in is not enabled |
| AI | blocks drawn, inert; no suggestion, mark or generated value; the manual path is complete |

## Files changed
| Commit | Content |
|---|---|
| `5fcbae1` | migration 010, auth request, resolver, profile, roles, completion, membership filing, API routes, database tests |
| `d0ca155` | `src/app/(onboarding)/onboarding/**`, `src/components/shell/onboarding-shell.*`, `src/components/onboarding/inert.tsx`, `src/lib/onboarding/guard.ts`, `roles.ts` (`listPendingClaims`), `src/lib/auth/account.ts`, `src/lib/routes.ts` and its test, AUTH1 focus ring, screen contracts YAML, references ACC-05…ACC-09 |
| `551b8e6` | `tests/visual/support/onboarding.ts`, ten WF01 specs new or rewritten, QA vocabulary fixture, specs of other workflows moved to the new onboarding helpers and the new resolver entry |
| documents | decision log, API contract amendment A1 (§18), WF01 workflow note, superseded notes on the four S05–S08 contracts, UAT matrix, `l1-l2-realign/`, status, this report |

## Migrations and data
- `db/migrations/010_p0_onboarding_four_stage.sql`, additive, already in `5fcbae1`. No further migration. Local and test database only.
- Reference rows with fixed ids: `COUNTRY` Việt Nam; `SPECIALIZATION` Vận hành, Công nghệ, Tài chính, Luật, Design, Marketing, Product, Business Development. The screens read them from the vocabulary; no list is typed into the client. **Not to be deployed before the PO approves the list (D-S1).**

## Tests and build
| Gate | Result |
|---|---|
| format, lint, typecheck, production build | PASS |
| unit | 258 / 258 |
| database and API | 406 / 406 |
| WF01 specs | 188 / 188 |
| UAT | 14 / 14 |
| regression gate | GREEN by the PO rule of 2026-09-29: WF01 188, auth and security 46, landing 10, shell 14, WF02 102, WF03 69, WF04 115, WF05 66, About and Library 13, foundation 82; 0 product failures |
| runtime | hydration #418 0, HTTP 5xx 0, broken assets 0, console errors 0 |

## Visual QA
ACC-05, ACC-06, ACC-07, ACC-08, ACC-09, ACC-10 at 1440 × 900 DPR 1: every segment under the thresholds, P0 / P1 / P2 = 0, P3 = 1 (order of two role chips in the ACC-09 preview, recorded). Typography 0 violations. Responsive 1440 / 1024 / 768 / 390: 28 / 28. No baseline image was overwritten.

## Deviations and blockers
| Item | Kind | State |
|---|---|---|
| ROLE and REVIEW are two screens, not one | source reading | the workbook and the board number them stage 3 and stage 4 |
| D-H1 HUB verification authority | human business decision | no approval flow was invented; the claim is a pending, self-declared membership request and the stated position is confirmed by nothing |
| D-S1 specialisation list | human business decision | eight board items, local only |
| D-G1 Google OAuth client | external configuration blocker | no client id, secret or redirect URI exists |
| D-A1 AI provider | external, optional capability | none configured |
| Pre-commit review | quality | no security finding; 2 major data-loss defects (typed skill, browser Back) and 4 minor ones reproduced by tests and fixed before the commit |
| Blocking gaps for L1 | | 0 |

## Git
- Branch: `main`; start HEAD `5fcbae187b126978bcc77eabdc4565a1f13660af`, compared again before each commit
- Implementation commits: `5fcbae1`, `d0ca155`, `551b8e6`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** (the task forbids a push)
- Remote HEAD: `53599925f5aef6abf20127e293611e4f758f898b` (tracking ref), not changed by this task; local `main` is ahead of it
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
TASK 22-L1-L2-SOT-REALIGN — L2 implementation, after the PO's review of L1. Not started automatically.

## Related
- [../l1-l2-realign/l1-closure.md](../l1-l2-realign/l1-closure.md) · [../l1-l2-realign/open-decisions.md](../l1-l2-realign/open-decisions.md) · [../WF01_UAT_MATRIX.md](../WF01_UAT_MATRIX.md)
