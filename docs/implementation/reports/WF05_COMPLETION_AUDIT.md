# WF05 Completion Audit

**Verdict: GREEN — WF05 PROTECTED / CLOSED / GREEN** (2026-09-27, base HEAD `9223071`). WF05 Founder / Project / Startup = DEMO (INTERNAL ALPHA). Process: PROCESS-P0-ACCELERATED-SAFE-V2 §I.

- Implementation: 5/5 plan tasks (T00, S01–S04); 4 executable screens on 4 routes + the read-only demo API. SHA chain: T00 `9484614`, S01 `e5aaa28`, S02 `ad7f764`, S03 `1d1d7da`, S04 `26d67c5` (the task prompt quoted `2d067c5`).
- Defects: P0 / P1 / P2 = 0; P3 = 5, recorded. Hydration #418 gate: **0 reproductions** (see below).
- UAT: [WF05_UAT_MATRIX.md](../WF05_UAT_MATRIX.md), closure spec `eefdfd7`. Human decisions open: none. No product change in this audit.

## Audits
| # | Area | Result | Evidence |
|---|---|---|---|
| 1 | Inventory / routes | PASS | `/demo/projects`, `/:id`, `/:id/applications/:programmeId`, `…/review`; `GET /api/v1/demo/projects[/{id}]` (other methods 405); any other sub-route 404; MemberShell entry "Dự án & Startup · Demo" |
| 2 | Business invariants 1–18 | PASS | See below |
| 3 | Happy path | PASS | HC-WF05-01 PROJECT (13 steps), HC-02 STARTUP (13), HC-03 canonical reuse, HC-04 reset |
| 4 | Negative / alternate | PASS | NEG-WF05 1–29 (closure spec + 56 WF05 screen tests) |
| 5 | Authorization | PASS | SEC-WF05-01: 8 actors × 4 routes + 2 APIs, plain and spoofed (headers + query incl. `role_label=Founder`); relation read by the server only |
| 6 | Application store | PASS | STORE-WF05; T00 store tests; atomic save / submit under a refused browser write |
| 7 | Data invariants | PASS | Every WF05 phase bracketed by row-exact hashes of all 31 tables: journeys, reuse, reset, NEG: **0 tables changed**; SEC / STORE: only `auth_magic_link_requests`, `user_sessions` from their own sign-ins; no `applications` table; audit / analytics writes 0 |
| 8 | Migrations | PASS | Ledger `001`→`009`, byte-identical; no `db/` commit since the WF05 audit (`9536617`); none created |
| 9 | Navigation | PASS | NAV-WF05: 14 visits, 18 links, 0 dead; P0-SHELL matrix 536 rows, 0 dead; back and direct refresh at every step |
| 10 | Security / privacy | PASS | No email, token, cookie, session key, account / profile id in WF05 pages, API responses or the store; store key opaque; nothing in `localStorage`; every server log in this audit: 0 email / token / cookie / session / error lines |
| 11 | Restart | PASS | One browser tab kept across an app + PostgreSQL restart: all 31 tables identical; the cookie still resolves the member; the SUBMITTED application and the store survive byte-identical; 6 routes / APIs 200; S02 "Đã nộp", S03 locked; reset still clears (0 table writes); guest → `/auth`. Then the WF05 suite on the restarted stack: 66 / 66 |
| 12 | Fresh DB | PASS | New database: 001→009 applied, rerun skipped 9/9, seed twice → 31 tables identical; "Demo Startup" (STARTUP, ACTIVE) and Chapter 01 present; **66 / 66 WF05 tests** (incl. the closure spec) on it, server log clean; dropped afterwards |
| 13 | Pixel / responsive | PASS | See below |
| 14 | Copy | PASS | COPY-WF05 on 33 captures: no technical term, no unsupported outcome |
| 15 | Cross-workflow | PASS | Full visual suite — B1 (clean build, fresh server): 658 tests — 632 passed, 24 skipped, 2 failed (HC-01 / 02 on WF05-P3-01, a closure-spec harness issue); B2 after the fix (fresh server): **634 passed, 24 skipped (the pre-existing `PIXEL_QA_SCREENS` opt-in), 0 failed**; 0 #418; server logs 0 lines; unit 237, DB 349; format, lint, typecheck, build PASS |

## Business invariants
| # | Invariant | Evidence |
|---|---|---|
| 1 / 17 | One canonical venture; the application references its id | HP-13: 1 `projects` row per venture, store = ids + answers; CR: a WF02 rename shows on S01–S04, store byte-identical |
| 2 / 3 | Founder = the canonical owner; team = `project_members` | No founder table among the 31; an ACTIVE member labelled "Founder" gets `MEMBER` / `NOT_OWNER`; S02 team from WF02 |
| 4 / 18 | Programmes from the WF04 source, never mutated | T00 read model over the frozen fixtures; `programmes` / `events` unchanged in every bracket; the list is identical after reset |
| 5 / 6 | PUBLISHED only; DRAFT cannot be applied to | S01 8–11 (an ops-published C1 stays hidden); C1 → 404 on S03 / S04 |
| 7 / 8 | PROJECT → TEAM, STARTUP → STARTUP; INDIVIDUAL future | HC-01 TEAM, HC-02 STARTUP; the applicant type derives from the venture type only; no individual path |
| 9 / 10 | DRAFT → SUBMITTED only; SUBMITTED final | Store API has `saveDraft` / `submitApplication` only; S03 locked, S04 read only, a stale form's save refused |
| 11 | One application per (venture, programme) | Key `venture:programme`; duplicate start / save, double submit: one entry |
| 12 / 13 / 14 | Owner only; ACTIVE member and ARCHIVED cannot apply / submit | SEC-WF05-01; NEG lifecycle; S04 archived-after-load refusal |
| 15 / 16 | Every answer valid before submit; incomplete DRAFT allowed | HP-06; S04 7–9; NEG 25 / 26 |

## Hydration #418 gate
The S04 closure run 1 (334 tests) had one React #418 on the ACTIVE member's first S04 load after an onboarding redirect. Its trace is gone (output directory cleared by later runs); the root cause of that single event is **not identified**.

| Check | Runs | #418 |
|---|---|---|
| A. Affected case, clean `.next` build, fresh server | 25 | 0 |
| A'. Same, under 6 parallel read-load loops (pages + API) | 25 | 0 |
| B1. Full visual suite, clean `.next` build, fresh server (658 tests incl. the affected case; 632 passed, 24 opt-in skips, 2 failed on WF05-P3-01) | 1 | 0 |
| B2. Full visual suite again, fresh server, final closure spec (634 passed, 24 skipped, 0 failed) | 1 | 0 |
| Also: closure spec on the dev DB (2 × 10), WF05 suite + closure spec on the restarted stack (66) and on two fresh DBs (2 × 66) | 218 | 0 |

Every spec fails on any console error or page error (`afterEach`); every server log was scanned. Ruled out in the S04 render path: time, randomness, storage or viewport inputs in the server render (session store and readiness use server snapshots; the review starts in its loading state on both sides). Verdict: **PASS — not reproduced**; recorded as OBS-WF05-01 for the protected regression to keep watching. A recurrence reopens it as a closure defect.

## Pixel (1440×900 DPR1; no approved WF05 bitmap)
| Scope | Result |
|---|---|
| Screen specs S01–S04 | 84 WF02-S01 shell + ADM5 primitive segments; typography 794 elements, 0 violations; max drift 0.00008 (S01 populated shell header, 7 px: WF05-P3-03 class) |
| VIS-WF05 (11 states × 3 widths) | Typography 442 elements, 0 violations; 33 segments, max 0.00025 (WF05-P3-03); 768 / 390: 0 overflow, key action reachable |

Structural 0 · Major 0 · Component 0 · Raster 2 (WF05-P3-03: shell header beside the member name, both far under the 0.002 gate). Intentional-Demo: composed from approved primitives (G1), no WF05 pixel parity claimed. `design-reference/final` untouched.

## Defects
| ID | Class | Item | State |
|---|---|---|---|
| OBS-WF05-01 | Observation | One #418 in the S04 run 1; 0 in 50 dedicated repeats and every run since | Watch in protected regression |
| WF05-P3-01 | P3 harness | The closure spec's onboarding picked an expertise chip by label, but the form shows 7 chips first and the vocabulary differs per database ("Logistics" is a dev-DB QA item; the fresh seed has 2 domains): HC-01 / 02 failed on the first fresh DB and in full run B1. `wf02-uat-journey` picks "Logistics" too (protected, not edited; dev-DB dependent) | Fixed in the WF05 spec (the first chip shown); HC-01 / 02 then passed on the dev DB and a second fresh DB |
| WF05-P3-02 | P3 UX note | Load-failed / not-found states keep an empty header title (S02–S04, same pattern) | Record |
| WF05-P3-03 | P3 raster | The shell bell sits left of the member name, so the name moves it vs WF02-S01 (22 px VIS s01-empty; 7 px S01 populated) | Record |
| WF05-P3-04 | P3 cosmetic | At 390 the shared WF04 demo notice keeps "Đặt lại demo" beside a narrow text column | Record (protected WF04 frame) |
| WF05-P3-05 | P3 copy | WF05 copy awaits PO review | Record |

## Related
- [../WF05_UAT_MATRIX.md](../WF05_UAT_MATRIX.md) — UAT cases
- [../WF05_SCREEN_IMPLEMENTATION_PLAN.md](../WF05_SCREEN_IMPLEMENTATION_PLAN.md) — plan
- [WF04_COMPLETION_AUDIT.md](WF04_COMPLETION_AUDIT.md) — WF04 precedent
- [../P0_STATUS.md](../P0_STATUS.md) — status
