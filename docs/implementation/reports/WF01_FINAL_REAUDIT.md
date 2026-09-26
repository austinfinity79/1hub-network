# WF01 Final Reaudit

**Verdict: GREEN WITH DOCUMENTED LIMITATIONS. WF01 formal status: CLOSED** (approved local Production scope). The limitations are external production inputs only.

- Date: 2026-09-26. HEAD audited: `215fca8`. Mode: LOCAL REVIEW; verification only, no code or business-logic change.
- Environment: clean `git clone`, `pnpm install --frozen-lockfile`, a new `postgres:17.6-alpine` on 55433 (the dev DB untouched), app on 3985.

## 1. Evidence
| Area | Result |
|---|---|
| Fresh install | PASS: no `node_modules`, `.next`, `.env` or `.data` in the clone; frozen-lockfile install |
| Fresh DB | PASS: 0 tables → migrate 001→005; the rerun skipped all 5; seed twice with an identical fingerprint (`d89d710d…`, covering profiles incl. the purpose step, memberships, legal documents, vocabulary, bootstrap) |
| Static gates (clone) | format, lint, typecheck PASS; unit **120/120**; DB **205/205**; build PASS |
| Full Playwright (clone, fresh DB) | **264 passed**, 24 skipped by design (env-gated screen runs). Covers S01–S08 functional, security, auth/session, RBAC, idempotency, WF01 UAT, pixel QA |
| Happy path | UAT-01: one UI journey S01→S02→S03→S05→S06→S07→S08→`/me`; 1 account, 1 profile, DRAFT until S08 then ACTIVE, 2 consent records, correct audit/analytics, token never stored raw |
| Resume matrix | Sign-in `next_step`, `GET /me/onboarding` and `/session` agree: new→PURPOSE, skipped (intent NULL)→PROFILE, S06 done→PRIVACY, S07 done→COMPLETE, completed→DONE (`/me`). **Identical after app and PostgreSQL restart** |
| Roster | Invalid file refused (exit 1, 5 row errors, nothing written); dry run writes nothing; import 6 new + 1 duplicate collapsed; seed `pending` → CONFLICT (not overwritten); re-import no-op. Sign-in: member → 2× ACTIVE membership; Chapter/CLB leader → membership + leadership; unknown → nothing (no profile); RoleAssignment 0. **Identical after restart**. UAT-11 PASS |
| Analytics | `account_created → profile_completion_changed(0→20) → (20→30) → onboarding_completed`; a no-change PATCH and a repeated complete add nothing; no personal content. **Identical after restart and re-login**. UAT-12/13 PASS. ANALYTICS-EXT APPROVED P0 DEFERRED (not a blocker) |
| Security | P0 0 / P1 0: one-time, expired, used and invalid links; concurrent consume; blocked account; anti-enumeration; HttpOnly session; logout revokes; hash-only tokens; guests get 307 → `/auth` on all four onboarding routes; app logs (14 lines, both boots) contain no email, token or error |
| Profile / completion | 10 groups, HEADLINE third, no NETWORK_CONTEXT; one service behind `/session`, `/me/profile`, `/me/profile/completion`; 80% is a KPI only (UAT-08) |
| Consent / visibility | Two records against current documents; stale → 409 and reload (UAT-06); idempotent; PROFILE_DISCOVERY NETWORK_ONLY/PRIVATE; avatar access follows it; guest denied (UAT-07) |
| Lifecycle | DRAFT through S05–S07; ACTIVE plus a server timestamp once at S08; retries unchanged (UAT-09); failure atomic |
| `/me` handoff | 200 for a completed user (WF02-S01 placeholder). **WF02 dependency, not a WF01 defect**: WF01 exits safely |

## 2. Pixel (1440×900 DPR1, clone)
**Structural 0 / Major 0 / Component 0.** Raster noise and intentional classes are documented per screen. Baselines are untouched; the DOM typography contract is asserted in every screen spec.

| Screen | Outside-text diff |
|---|---|
| S01 | 0/0/0/0/1 |
| S02 | 0/0/0/14/3 |
| S03 | 71 / 247 / 97 |
| S04 | 1; 1/3 (GENERIC = DESIGN-GAP-GENERIC, PO review) |
| S05 | 193/245 |
| S06 | 6/503 |
| S07 | 26/75 |
| S08 | all 0 |

## 3. UAT
- Automated: 14 scenarios, all PASS; **0 expected-fail markers** (`grep test.fail(` → 0).
- Manual only: real mailbox (no email delivery in P0), production legal content, PO copy/content sign-off.

## 4. Defects
| Severity | Items |
|---|---|
| P0 / P1 / P2 | **none** |
| P3 | Copy review (unapproved runtime strings; see the audit's §7). Seed demo avatar ids point to no stored file (fixture only). S04 GENERIC needs PO visual review |

## 5. External / release dependencies (not implementation defects; mechanisms ready)
| Item | Mechanism | Class |
|---|---|---|
| PRODUCTION_LEGAL_CONTENT_REQUIRED | `legal_documents` rows plus `LEGAL_CONTENT_DIR` | UAT blocker for UAT-M1 (real documents) and GO-LIVE blocker |
| REAL_PRODUCTION_ROSTER_DATA | `pnpm roster:import` | GO-LIVE blocker / operational input |
| PRODUCTION_REGION_DOMAIN_SKILL_TAXONOMY | `vocabulary_items` (data-driven) | GO-LIVE blocker / operational input |

## Related
- [WF01_COMPLETION_AUDIT.md](../WF01_COMPLETION_AUDIT.md) — audit history
- [WF01_UAT_MATRIX.md](../WF01_UAT_MATRIX.md) — UAT matrix
- [P0_STATUS.md](../P0_STATUS.md) — overall P0 state
