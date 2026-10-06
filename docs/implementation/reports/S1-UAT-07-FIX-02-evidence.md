# S1-UAT-07-FIX-02 evidence

Takeover verification (S1-UAT-07-FIX-02-TAKEOVER) of [S1-UAT-07-FIX-02](S1-UAT-07-FIX-02.md), written by another session on `feat/s1-uat-07-fix02` (worktree `../1hub-network-s1-fix02`). Its two commits are kept as they are; one test commit added.

## Git
| Item | Value |
|---|---|
| Base (candidate) | `9c5b52ba09453e287101c3f57168ff10f6c666fa` (`int/sprint1-candidate-01`); the task prompt's `9c5b52ba894…` is a typo — no such object; the real SHA is the merge-base and an ancestor of HEAD |
| Commit 1 (other session) | `eef061341a06966ac4619adb69d68861780f7558` fix(s1-uat-07): close reject-state UAT gap |
| Commit 2 (other session) | `d529650e65219c5ec4a97d2a41d5d80fb1a83747` test(s1-uat-07): make invite suite order-independent |
| Commit 3 (takeover) | `a6ae7ecd583261863a2d1d2c6c27bcc2d7eb5dcc` test: declined state survives a new sign-in |
| Note | commits 1–2 carry a session trailer line; not rewritten (task forbids rewriting them) |

## Audit of the changes
| File | Change | Class |
|---|---|---|
| `src/lib/venture/team.ts` | owner-only `declined` (latest REJECTED per address, none while pending or ACTIVE); expired decline → 409 | CORRECT (`ended_at` guaranteed by `ck_pm_rejected`) |
| `src/app/(member)/projects/team-view.tsx` | "Đã từ chối · dd/mm" row, no action | CORRECT |
| `invitation-decline.db-test.ts` | owner side, re-invite, wrong account, expired, revoked, accepted, double | CORRECT |
| `team.db-test.ts` | G8: declined only in the owner's `declined`, never in `rows`, `[]` for a member | CORRECT (newer UAT rule) |
| `s1-uat-07-invite.spec.ts` | decline browser test; QA fixture in `beforeAll` | CORRECT; relogin not covered → NEEDS_FIX, fixed in commit 3 |
| API contract A16, DEC-S1I-D7 | additive, no migration | CORRECT |
| `S1-UAT-07-FIX-02.md` | report linked to this file, which did not exist | NEEDS_FIX → this file |
| UNRELATED · AMBIGUOUS | — | 0 · 0 |

## US-02.14 reject flow
| Check | Where | Result |
|---|---|---|
| AC4: decline → REJECTED; owner sees "Đã từ chối" | DB + browser | PASS |
| Owner invites the address again (new pending row, line gone) | DB + browser | PASS |
| No membership on reject; accept after reject → 409 | DB + browser | PASS |
| Refresh · new sign-in (owner and recipient) | browser | PASS |
| Wrong account / owner / malformed id → 404 | DB | PASS |
| Expired → 409 · cancelled (revoked) → 409 · accepted → 409 | DB | PASS |
| Double / concurrent decline → one REJECTED row, one audit event | DB + browser | PASS |
| Member sees no declined data (G8) | DB + browser | PASS |
| Signal | existing audit `VENTURE_TEAM_INVITATION_REJECTED`; no new notification | PASS |

## Order independence
`s1-uat-07-invite.spec.ts` alone and first, after a guarded reset (seed has no "Logistics" item): DB A `hubnetwork_s1fix02_reg` 13 / 13; DB B `hubnetwork_s1fix02_reg2` 13 / 13.

## Gates
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 42 files · 444 / 444 |
| DB (`hubnetwork_s1fix02_dbt`) | 56 files · 856 / 856; targeted venture suites 71 / 71 |
| Targeted e2e (S1-UAT-07, WF02-S05 / S06 / S08, WF02 UAT, PDF-alpha, L2, shell routes) | 10 specs · 145 / 145 |
| L1-L2 UAT | 10 specs · 19 / 19 |
| Protected regression | **97 specs · 1266 tests · 1237 PASS · 0 FAIL · 29 SKIP (opt-in, unchanged) · 0 FLAKY** on `a6ae7ec` (21.2 min, one complete run after a guarded reset of `hubnetwork_s1fix02`; replaces the earlier incomplete run); server log 0 5xx, 0 hydration, 0 secret / token, 1 expected refused `/dev/login` |
| Shared DB | `hubnetwork_p0` ledger 017 before and after; no 020 |

## Related
- [S1-UAT-07-FIX-02](S1-UAT-07-FIX-02.md)
- [S1-CANDIDATE-INT-01](S1-CANDIDATE-INT-01.md)
- [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
