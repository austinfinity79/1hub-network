# WF01 Completion Audit

**Verdict: YELLOW — UAT BLOCKED.** _Update 2026-09-26 (WF01-REMEDIATION-01): **GAP-ROSTER CLOSED** — see [report](reports/WF01-REMEDIATION-01_gap-roster.md). _Update (WF01-REMEDIATION-02): **GAP-ANALYTICS-REG CLOSED** — see [report](reports/WF01-REMEDIATION-02_gap-analytics-registration.md). Remaining: DEFECT-RESUME (P2), ANALYTICS-EXT (P2, other API §10 events), release inputs._ _Update (WF01-REMEDIATION-03): ANALYTICS-EXT **DEFERRED** by DEC-WF01-ANALYTICS-EXT-DEFER; DEFECT-RESUME **BLOCKED** on the S05-skip data-model decision ([report](reports/WF01-REMEDIATION-03_defect-resume.md))._ _Update (WF01-REMEDIATION-03A/03): **DEFECT-RESUME CLOSED** by DEC-WF01-RESUME-D1 (purpose-step persistence + one resolver); **no open WF01 defect**. Final re-audit pending._ All 8 approved WF01 screens and their contracts are implemented and pass in a fresh environment. A **frozen P0 business path is missing**: launch-roster matching (Freeze D2 "PRESEED + PENDING FALLBACK"). The P0 registration metric is also missing.

- Audit date: 2026-09-26. HEAD at audit: `c74e7fc`.
- Mode: LOCAL REVIEW. No push, no SOT or baseline change, no feature code.

## 1. Fresh environment proof — PASS

| Step | Command / evidence | Result |
|---|---|---|
| Clean clone | `git clone . <scratch>/fresh`: no `node_modules`, `.next`, `.env` or `.data` | PASS |
| Install | `pnpm install --frozen-lockfile` | PASS |
| Fresh PostgreSQL | new `postgres:17.6-alpine` container on port 55433 (dev DB 55432 untouched), 0 tables | PASS |
| Migrations | `node scripts/db.mjs migrate` applied 001 → 002 → 003; a second run skipped all three | PASS, idempotent |
| Seed | seed twice; fingerprint over profiles, memberships, legal docs, vocabulary and roles identical (`6500c5f2…`) | PASS, deterministic |
| Gates in clone | format, lint, typecheck; unit 115/115; DB 181/181; build | PASS |
| Full Playwright in clone | app booted on 3985 against the fresh DB | **263 passed**, 24 skipped by design |
| Restart | app stopped and restarted, PostgreSQL container restarted, migrate → 3 skips | PASS |
| Persistence | the saved session cookie still authenticates; `/session`, completion, profile, consents, visibility, audit and analytics identical after restart; repeat completion → 200, **no new rows** | PASS |
| Logs | app logs across both boots (7 lines each) contain no token and no error | PASS |

## 2. Journeys (`tests/visual/specs/wf01-uat-journey.spec.ts`)

UI-driven S01 → S02 → S03 → S05 → S06 → S07 → S08 → `/me`, one journey per scenario; see [WF01_UAT_MATRIX.md](WF01_UAT_MATRIX.md). The core and alternate paths pass: intent skipped, below 80%, resume, completed member, version race, visibility, retry/concurrency.

## 3. Security (P0 0 / P1 0)

| Area | Evidence |
|---|---|
| Magic link | one-time use, expired, used, invalid → S04, blocked → S04, 8 concurrent consumes → 1 session (auth-session, S03, S04, M0 suites; UAT-04) |
| Anti-enumeration | request always 202, same shape (auth-session) |
| Session | HttpOnly cookie, fresh token per consume, logout 204 revokes (UAT-03a/10 re-login) |
| Token hygiene | only the hash stored; the raw token is not in URL, audit, analytics or logs (UAT-01, S03 "leaves no trace", app logs) |
| Guards | every onboarding route sends a guest to `/auth`; every S05–S08 API returns 401 |
| Data exposure | DTOs without contact data or consent metadata (S07); avatar authorisation at the media boundary (UAT-07) |

## 4. Business rules

| Rule | Status |
|---|---|
| Account 1:1 profile | PASS: the journeys assert `profiles = 1` at every step; the UNIQUE `account_id` holds |
| Profile PATCH / vocabulary / max 5 / archived / avatar id | PASS (S06 DB and Playwright suites) |
| Completion | PASS: 10 groups, HEADLINE third, no NETWORK_CONTEXT; one service; `/session` = `/me/profile` = `/me/profile/completion`; client percent refused or ignored; 80% is a KPI only (UAT-08) |
| Consent | PASS: two records, current version chosen by the server, stale → 409 and reload (UAT-06), idempotent, history kept |
| Visibility | PASS: PROFILE_DISCOVERY NETWORK_ONLY/PRIVATE, avatar access follows it, guest denied (UAT-07) |
| Lifecycle | PASS: DRAFT through S05–S07; ACTIVE plus timestamp once at S08; failure atomic; repeat 200 with no new rows (UAT-09, restart proof) |
| Audit | PASS: `CONSENT_ACCEPTED` ×2, `PROFILE_VISIBILITY_CHANGED`, `PROFILE_ACTIVATED` ×1; actor, resource and request_id present; no token or content. Insert-only by code (no update/delete path) |
| **Launch roster (Freeze D2)** | **CLOSED by WF01-REMEDIATION-01** (`pnpm roster:import`, sign-in reconcile, migration 004). Original finding: GAP-ROSTER. `membership_bootstrap` is never read: no importer (template CSV only), no matching at account creation, no ACTIVE membership or leadership attached. Unmatched users stay safe (nothing is auto-activated) |
| **P0 funnel analytics** | **Registration CLOSED by WF01-REMEDIATION-02** (`account_created` once per new account). Still not emitted (ANALYTICS-EXT, P2): `account_authenticated`, `onboarding_started`, `consent_accepted`, `visibility_changed`, `membership_bootstrapped`, `membership_requested`, `profile_saved`, `feedback_submitted`. Original finding: GAP-ANALYTICS-REG. `onboarding_completed` (once) and `profile_completion_changed` (real changes only) PASS through the single writer. `account_created`, `account_authenticated`, `onboarding_started`, `consent_accepted`, `visibility_changed`, `membership_*` are not written; registration is a Data SOT minimum |
| Resume rule (WF01 state rules) | **DEFECT-RESUME:** sign-in for an incomplete account always lands on S05 (`consume` answers `next_step: PURPOSE`), not the first incomplete step. Data is kept and continuing completes (UAT-03a) |

## 5. Pixel regression (1440×900 DPR1, fresh clone) — PASS

Outside-text diff, unchanged from the dev run. Structural 0 / Major 0 / Component 0.

| Screen | Segments |
|---|---|
| S01 | 0/0/0/0/1 |
| S02 | 0/0/0/14/3 |
| S03 | 71 / 247 / 97 |
| S04 | 1; 1/3 (GENERIC = DESIGN-GAP-GENERIC, PO review) |
| S05 | 193/245 |
| S06 | 6/503 |
| S07 | 26/75 |
| S08 | all 0 |

Every other difference is a documented intentional class. Baselines are untouched.

## 6. Defects

| ID | Sev | Finding | Class |
|---|---|---|---|
| GAP-ROSTER | ~~P1~~ | **CLOSED** (WF01-REMEDIATION-01): importer, email match at sign-in, ACTIVE membership, leadership only with evidence, duplicate- and concurrency-safe | — (real roster data remains an operational input) |
| GAP-ANALYTICS-REG | ~~P1~~ | **CLOSED** (WF01-REMEDIATION-02): `account_created` once per new account, same transaction as the insert | — |
| ANALYTICS-EXT | — | **DEFERRED** by DEC-WF01-ANALYTICS-EXT-DEFER (added later through the same writer) | not blocking WF01 |
| DEFECT-RESUME | ~~P2~~ | **CLOSED** (DEC-WF01-RESUME-D1, migration 005, one resolver) | — |
| COPY-REVIEW | P3 | Unapproved runtime copy (see §7) | Non-blocking polish, except legal |

## 7. Copy / content review

| Group | Strings |
|---|---|
| A. Polish | S05–S08 pending, retry and loading messages; region placeholder; "Vào 1hub.network"; S08 neutral lede and panel sentence |
| B. Business-semantic | S06 validation messages; S07 acknowledgement sentence; S08 "missing requirements" copy; S07 omitted clauses ("Google tìm thấy", "người chưa đăng nhập…") |
| C. Legal | **PRODUCTION_LEGAL_CONTENT_REQUIRED**: real Terms and Privacy text and versions (separate from copy polish) |
| D. Errors | S06 invalid/inactive/failed; S07 stale/failed; S04 BLOCKED body wording; S08 failure |

## 8. Release dependencies

| Item | Class |
|---|---|
| Approved WF01 screens | IMPLEMENTATION BLOCKER: **none** (8/8) |
| Real production roster data (importer done) | GO-LIVE BLOCKER (operational input) |
| PRODUCTION_LEGAL_CONTENT_REQUIRED | UAT BLOCKER (real documents) and GO-LIVE BLOCKER |
| Production REGION/DOMAIN/SKILL taxonomy data | GO-LIVE BLOCKER (config data; UAT may use fixtures) |
| ANALYTICS-EXT (remaining API §10 events) | GO-LIVE decision (P2) |
| DEFECT-RESUME | CLOSED |
| `/me` placeholder (WF02-S01); Project CTA (WF02-S05); Chapter (WF02-S04 / network); Challenge (WF04 demo) | DEFERRED / WF02+; WF01 completes safely without them |
| Copy review (A, D) | NON-BLOCKING POLISH |
| Copy review (B) | Before UAT sign-off |

## Related

- [WF01_UAT_MATRIX.md](WF01_UAT_MATRIX.md) — UAT scenarios
- [DECISION_LOG.md](../decisions/DECISION_LOG.md) — decision records
- [P0_STATUS.md](P0_STATUS.md) — overall P0 state
