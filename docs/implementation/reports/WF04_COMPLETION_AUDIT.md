# WF04 Completion Audit

**Verdict: GREEN — WF04 PROTECTED / CLOSED / GREEN** (2026-09-27, base HEAD `40a2a2e`). WF04 Programme / Challenge = DEMO (INTERNAL ALPHA). Process: PROCESS-P0-ACCELERATED-SAFE-V2 §I.

- Implementation: 9/9 plan tasks (T00, S01–S08); 8 executable screens on 9 routes.
- Defects: P0 / P1 = 0; **P2 = 1, fixed** (WF04-P2-01); P3 = 6, recorded.
- UAT: [WF04_UAT_MATRIX.md](../WF04_UAT_MATRIX.md). Human decisions open: none.

## Audits
| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | Inventory / routes | PASS | `/demo/programmes`, `/new`, `/:id`, `setup/{basic,journey,events,registration,team,review}`; every other `/demo/*` and `/programmes*` is 404; guard on every route (guest → /auth, out of scope → 404) |
| 2 | Business invariants | PASS | One Programme aggregate with `PROGRAMME | CHALLENGE` subtype; Bài toán only for CHALLENGE (S03, S07, S08); demo lifecycle DRAFT → PUBLISHED only, atomic and idempotent; registration = applicant types + plain questions, counts read-only; team = display only, the PROGRAMME_ORGANIZER label grants nothing |
| 3 | Happy path | PASS | UAT-WF04-J1 (23 steps), J2 (16), J3 (5) |
| 4 | Negative / alternate | PASS | NEG-WF04 1–20 (closure spec + 114 WF04 screen tests) |
| 5 | Authorization | PASS | SEC-WF04-01: 6 actors × 19 calls with spoofed headers / query; membership, leadership and the label grant nothing |
| 6 | Data invariants | PASS | 16 canonical tables row-exact (programmes, events, organizations, relationships, profiles, projects, project members / domains, memberships, leadership, roles, bootstrap, consents, vocabulary, audit rows + count, analytics count) unchanged across every journey; no `applications` table |
| 7 | Event boundary | PASS | EVT-WF04: demo events live only in the session with `programme_id` = their programme; WF03 standalone events keep `programme_id` NULL; no demo id in `events`, the WF03 ops list, `/api/v1/events/:id`, the ops PATCH route, the S07 ops page or the public page |
| 8 | Navigation | PASS | NAV-WF04 + P0-SHELL matrix 502 rows, 0 dead; S01→S02→S03→S04→S05→S06→S07→S08, S01→S08; back at every step; direct refresh on all routes |
| 9 | Security / privacy | PASS | No email, token, cookie, session key or account / profile id in any WF04 response or the session store; full-run server log: 7 lines, 0 email / token / cookie / session / error lines |
| 10 | Restart | PASS | One browser session kept open across an app + PostgreSQL restart: 14 tables identical (incl. `audit_events`, `user_sessions`); the cookie still resolves the leader; the session draft, the PUBLISHED Challenge and the store survive; the fixture list is identical; reset still restores. Then UAT of WF01–WF04 on the restarted stack (38 passed; the new J3 failed on a test race — see WF04-P3-06 — and passed 3/3 after the fix) and WF04 UAT again |
| 11 | Fresh DB / fixture | PASS | New database: 001→009 applied, rerun skipped 9/9, seed run twice → 9 tables identical; Chapter 01 at `10000000-…-0101` with the leader's HUB_COMMUNITY_LEADER scope; **all 115 WF04 tests pass on it**; its server log is clean. No-seed database: see below. Both dropped afterwards |
| 12 | Pixel | PASS | See below |
| 13 | Cross-workflow | PASS | Full visual suite: 567 passed, 24 skipped (pre-existing opt-in skips), 0 failed — every WF01–WF03 spec and UAT journey, P0-SHELL, shell / console / API contract, WF04 (J3 was added after this run). Unit 223, DB 343. Format, lint, typecheck, build PASS |

## Chapter 01 deployment dependency — guaranteed: YES
| Evidence | Detail |
|---|---|
| Seed | `db/seed/seed_p0_deterministic.sql:72` upserts Chapter 01 at the fixed id `10000000-…-0101` (ON CONFLICT DO UPDATE); the leader persona's scope is role row `80000000-…-0004` |
| Bootstrap | `db:setup` / `db:reset` / `db.mjs seed` apply it; a fresh DB seeded twice is identical |
| Internal Alpha review env | Branch `deploy/vps-foundation` (`2bdce0f`): data = "deterministic NON-production fixtures (`seed_p0_deterministic.sql`)"; review-data command `db.mjs seed`; G9 record "the reseed recreated it"; review checklist C2 opens `/ops/org/…0101` Chapter 01. `release.sh` migrates only, so seeding stays the documented, idempotent review-data step |
| Without it | Fixtures are hidden, never invented: no-seed DB → demo list 200 `items: []`, fixture detail 404, empty-state page, no error, no write |
| Production go-live | Real roster has no Chapter 01 by design → the demo fixtures stay hidden; a go-live input, not an Internal Alpha blocker |

## Pixel (1440×900 DPR1; no approved WF04 bitmap)
| Scope | Result |
|---|---|
| Screen specs T00, S01–S08 | ADM5 / WF02 / WF01 primitive segments: 0 drift outside raster-masked pill corners |
| VIS-WF04 (11 screens) | Typography 519 elements, 0 violations; header band + rule: 0 drift; 768 / 390: 0 overflow |

Structural 0 · Major 0 · Component 0 · Raster: half-pixel pill corners (masked). Intentional-Demo: composed from approved primitives (H1), no WF04 pixel parity claimed. `design-reference/final` untouched.

## Defects
| ID | Class | Item | State |
|---|---|---|---|
| WF04-P2-01 | P2 component | "Đặt lại demo" kept open editors and a pending "Thử lại": the basic form showed the edited name under the restored title, and a retry could write the pre-reset copy back | **Fixed**: the store counts resets; `SetupScreen` re-mounts the step body and drops a retry from before the reset (NEG-19) |
| WF04-P3-01 | P3 harness | A manual probe left a `next-server` on port 3972 (`pkill -f "next start"` misses the child); Playwright reused it, so the S08 report's server-log line came from a server that never bound | Record; S08 line corrected; servers are now stopped by port |
| WF04-P3-02 | P3 doc | `VPS_DEPLOYMENT.md` (deploy branch) still lists "migrated but not seeded", written before the review-data seed | Record (other worktree; not edited) |
| WF04-P3-03 | P3 scope note | S08 shows no "current stage" and no application counts named in the plan's J1 step 8 / J2 (DEC-WF04-S08-D1) | Intentional |
| WF04-P3-04 | P3 UX note | The S02 create form keeps unsaved input across a reset (no stored data shown) | Record |
| WF04-P3-05 | P3 copy | WF04 copy awaits PO review | Record |
| WF04-P3-06 | P3 harness | The new J3 read the S03 stage list before a client-side navigation had rendered | Fixed in the test (waits for the URL and the row) |

Known PO item unchanged: OpsShell desktop-first below 768 px.

## Related
- [../WF04_UAT_MATRIX.md](../WF04_UAT_MATRIX.md) — UAT cases
- [../WF04_SCREEN_IMPLEMENTATION_PLAN.md](../WF04_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [../WF03_COMPLETION_AUDIT.md](../WF03_COMPLETION_AUDIT.md) — WF03 precedent
- [../P0_STATUS.md](../P0_STATUS.md) — status
