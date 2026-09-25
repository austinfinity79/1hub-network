# Claude Task Report

## Task
- Task ID / name: M0-FOUNDATION-COMPLETION-AUDIT
- Scope requested: Final local completion gate for M0. Audit from a clean state, fix only proven defects inside approved M0 behaviour, full regression.
- Status: **DONE**
- Mode: LOCAL REVIEW. Committed locally, not pushed.
- Full report: [M0_FOUNDATION_COMPLETION_REPORT.md](M0_FOUNDATION_COMPLETION_REPORT.md), reproduced below.

**Verdict: GREEN WITH DOCUMENTED LIMITATIONS**

The M0 foundation was proven from a clean clone against a brand-new PostgreSQL container, then re-proven in the working repository. P0 defects: 0. P1 defects: 0. One P2 and one P3 were fixed without inventing any business rule. The remaining items are pre-UAT, deployment-only or design-QA decisions for screens not yet built.

## 1. Baseline
| Item | Value |
|---|---|
| Start HEAD | `3c91480` (M0-T11 report). Unchanged through the audit |
| Single writer | PASS. One foreign untracked file, `AGENTS.md` (created 04:17, after M0-T11, most likely by the Codex app), was left untouched and uncommitted, per CLAUDE.md §13 |
| Migrations | 001, 002, 003 present. sha256 unchanged start to end (`71e6b511…`, `8d9e1c24…`, `af60cf15…`) |
| Seed entrypoint | `scripts/db.mjs` → `seed_p0_deterministic.sql` |
| `design-reference/**` | 67 files hashed before and after the audit: identical |

## 2. Environment
Node 22.23, pnpm 11.23, PostgreSQL 17.6 (`postgres:17.6-alpine`), Playwright Chromium, macOS.
- **Audit DB:** a fresh container `hubnetwork-audit-db` on port 55433, separate from the dev DB on 55432.
- **Audit app port:** 3985.

## 3. Clean install — PASS
- `git clone` of HEAD into an empty directory: no `node_modules`, no `.next`, no `.env`.
- `pnpm install --frozen-lockfile`: success.
- Fonts are served from committed `public/fonts`; the typography specs pass, so nothing depends on local artifacts.
- In the clone: format, lint and typecheck PASS; unit 94/94; DB 118/118; build PASS; Playwright 108/108. The harness baselines resolved without any update flag.

## 4. Fresh PostgreSQL — PASS
- An empty DB (0 tables) took 001 → 002 → 003 in order.
- A second `migrate` skipped all three: repeat-safe.
- After a full reset, the same order applied again.
- The app connected, served `/api/v1/session` and logged in personas.

## 5. Seed — PASS
- Seed applied twice without error.
- A fingerprint over accounts, profiles, organisations, memberships, leadership, role assignments, events and projects (ids, states, timestamps) was **identical** before reset, after reset, and after an extra seed.
- 5 accounts, 1 leadership row, 6 role assignments. No duplicate leadership or RoleAssignment.
- Role codes are only `INDIVIDUAL_USER`, `HUB_MEMBER`, `HUB_COMMUNITY_LEADER`, `PLATFORM_ADMIN`. No `ORG_ADMIN` or `PLATFORM_OPS`.
- **New test:** the retired `seed_dev.sql` cannot become the entrypoint through the runner or any package script.

## 6. Auth / session — PASS
Existing suites cover:
- request, resend (which retires the previous link), consume, expiry and single use;
- session creation, `GET /session`, logout and invalidation;
- the HttpOnly/SameSite cookie, hash-only token storage, no token visible to page JS, and a new session token per consume.

Added in this audit:
- **New test:** 8 concurrent consumes of one link give exactly 1 success, 7 `AUTH_LINK_ALREADY_USED`, and +1 session row.
- **Restart:** a leader session survived both an app restart and a PostgreSQL container restart. Logout afterwards returned 204 and `{authenticated:false}`.

## 7. RBAC — PASS
`authz.db-test` 31/31, plus the browser suite 8/8. They cover:
- the matrix matching the approved document, with no admin shortcut;
- member and membership-only denial, and unauthenticated denial;
- Leader allowed in their own org and denied in another org and at platform scope;
- expired, future and non-ACTIVE assignments ignored;
- forged role and scope ignored, and unknown capabilities denied;
- constraint D3 and no impersonation.

**New test:** probing a nonexistent organisation id returns the same code, message and status as a real foreign organisation, so organisation existence does not leak.

## 8. Idempotency — PASS
`idempotency.db-test` and the browser suite cover:
- execute once, replay, 409 on a changed payload, and operation scoping;
- actor isolation and 8-way concurrency (one execution, locking in PostgreSQL);
- rollback and retry, fingerprint-only storage, no magic-link token, retention purge, and the shape of migration 003.

**Restart:** a COMPLETED key survived an app and DB restart. Replaying it returned the identical `request_id` without re-executing.

## 9. API foundation — PASS
- **Routes:** 6 handlers, all under `/api/v1`, all through `withApi`, which provides the error envelope and request id.
- **Errors:** unexpected errors are normalised and their message never reaches the client.
- **Scope:** no business endpoint exists beyond the auth/session set; this is asserted.
- **P2 found:** `completion_percent` in `GET /session` is a hard-coded `0`, but its comment claimed M0-T09 computed it. See §15.

## 10. Playwright — PASS
112/112, plus 24 screen pixel runs skipped by design. Coverage includes:
- 1440×900 at DPR 1, font stabilisation, and deterministic personas;
- auth and authz browser smoke.

**New spec `console-health`:** 25 frozen routes × guest/member/leader, plus 3 dev harnesses: 0 console errors, 0 page errors, no status ≥ 400.

**Production-mode gating:** with `ENABLE_DEV_ROUTES` unset, `/dev/typography`, `/dev/primitives`, `/dev/pixel-qa` and `POST /dev/login` all return 404.

## 11. Pixel QA — PASS
Unit 33/33 and Playwright 15/15 cover:
- manifest load, 24/24 references resolved, and rejection of duplicates, missing references and traversal;
- capture, diff, identical and mismatch detection, the typography DOM assertion and full page;
- design-baseline write refusal and harness/design baseline separation.

No product pixel pass is claimed.

## 12. Security / static audit — PASS
| Check | Result |
|---|---|
| Committed secrets | None. Only `.env.example`, holding the known local-only dev password (see OPS-GH01) |
| Raw tokens logged | None. There is no `console.*` in non-test `src/` |
| Unsafe auth data returned | None. DTOs are asserted field by field |
| Client-trusted roles/scopes | None. Proven by forged-input tests |
| Protected mutation without authz | None exist yet. All mutations are unauthenticated auth endpoints by definition |
| SQL injection | Every query is parameterised; no `${}` inside SQL in non-test `src/` |
| Pixel QA traversal / design write path | Refused, and tested |
| Unbounded queries | All foundation SELECTs are keyed single-row lookups |
| Error detail leakage | None. Internal faults map to a generic envelope |

## 13. Restart / persistence — PASS
- App and DB restarted; no migration re-ran (three `skip`s).
- The session and the COMPLETED idempotency key persisted, as designed.
- Reset cleared sessions and keys, and the fixtures were restored identically.

## 14. Regression (working repository, generated output deleted first) — PASS
| Gate | Result |
|---|---|
| Format | PASS for the repository. The only warning is the foreign untracked `AGENTS.md` |
| Lint / Typecheck | PASS |
| Unit | 94 / 94 |
| DB integration | 121 / 121 (118 + 3 new) |
| Permission matrix (`authz.db-test`) | 31 / 31 |
| Build | PASS |
| Playwright | 112 / 112 (108 + 4 new) |
| Pixel QA | 33 unit + 15 browser |

## 15. Defects fixed during the audit
| ID | Class | Finding | Fix |
|---|---|---|---|
| D1 | P2 | `GET /session` returns `completion_percent: 0` for every session, and its comment said M0-T09 computed it, so a placeholder read as a real server-derived value | Comment corrected to state plainly that it is a placeholder. The ten-group calculation was **not** built: it is Profile-domain WF01/WF02 scope and depends on the B1 group-3 ruling. It must be implemented before any screen shows completion (WF01-S06/S08, WF02-S01) |
| D2 | P3 | `api-contract` test title said "no session store exists yet", which has been false since M0-T08 | Title and comment corrected; assertion unchanged |

Tests added: concurrent consume, nonexistent-org probe, seed entrypoint, and console health.

## 16. Remaining deferred items (pre-UAT / deployment)
| Item | Status |
|---|---|
| CSRF mechanism | Pre-UAT. SameSite=lax is the only mitigation |
| Session TTL (30 days), SameSite (`lax`) | Provisional, pre-UAT |
| Idempotency retention (24 h), conflict code (`UNCONTRACTED_…` 409), lenient missing header | Provisional technical values, not business rules |
| **Rate limiting on auth endpoints** | **Newly recorded.** Required by System Arch §9; not built; SOT gives no thresholds. `AUTH_RATE_LIMITED`/429 exist in the error catalogue only |
| **Magic-link email delivery** | **Newly recorded.** The token is deliberately dropped at the endpoint; no email provider or outbox exists (System Arch §3.5). Local flows use `/dev/login`. Deployment work |
| **Server-side logging of internal errors** | **Newly recorded.** `withApi` normalises unexpected errors but does not log them (System Arch §9: central logs). Deployment/observability |
| Gap P8 visibility group codes; untyped `role_code`/`scope_type`; droppable `role_assignments.account_id` | Unchanged |

## 17. Design decisions carried forward
Both are classified **DESIGN-QA DECISION BEFORE AFFECTED SCREEN**. The runner refuses these screens until a decision is made.

- **G1 state-board:** WF01-S03 and WF01-S04 have no per-state regions.
- **G2 short full-page:** 9 screens have `__full.png` shorter than 900px. WF03-S03 and WF03-S08 are marked `long-page` but are shorter than 900.

## 18. Readiness for WF01
**YES.** WF01-S01, S02 and S05–S08 are `READY_FOR_SCREEN_IMPLEMENTATION`. Two items need attention before or during WF01:
- D1: completion must be implemented before S06/S08 display it.
- G1: needs a decision before S03/S04 reach their pixel gate.

## Git
- Branch: `main`
- Start HEAD: `3c91480`. Re-checked before commit: unchanged
- Implementation commit: `0b446eb` fix(m0-audit): harden foundation proofs found by the completion audit
- Report/final commit: the commit containing this report
- Remote: `origin` → `austinfinity79/1hub-network`
- Push status: **NOT RUN** — LOCAL REVIEW MODE
- Remote HEAD: `2390ce2`, deliberately behind local
- Working tree: clean after commit except the foreign untracked `AGENTS.md`, which was deliberately not committed (CLAUDE.md §13)
- Secrets: none committed

## Recommended next task
WF01 IMPLEMENTATION — screen by screen, from WF01-S01.

## Related
- [M0_FOUNDATION_COMPLETION_REPORT.md](M0_FOUNDATION_COMPLETION_REPORT.md) — full audit
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
