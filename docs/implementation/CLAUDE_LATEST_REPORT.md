# Claude Task Report

## Task
S1-UAT-03 — Sprint 1 onboarding corrections: US-01.07 location (FB-06, FB-07), FB-09 / FB-10 recheck, US-01.10 role minimum, US-01.11 HUB position declarations (FB-11, FB-12, FB-13), US-01.12 review. Reports: [task](reports/S1-UAT-03-onboarding.md) · [evidence](reports/S1-UAT-03-evidence.md).

## Verdict
**PASS_WITH_EVIDENCE — READY FOR CHATGPT/PO REVIEW.** S1-UAT-03B (requests per position, routing, withdrawal) not implemented, not started. Not pushed, not merged, not deployed. STOP.

## Scope implemented
One location rule for stage 1, /me and the profile editor (11 countries, Việt Nam list + "Khác", typed place ≤ 60, new country clears the province); stage 3 needs a role; HUB positions with level, catalogue unit (CLB under its Chapter), five positions (+ Tên Ban / Ghi rõ), MM/YYYY term or current, 1–10 rows, overlap guard, ordered HUB → Chapter → CLB, "Chờ xác minh", nothing granted; review lists them in order; "Sửa" returns to the review; stage 2 "Quay lại" saves. Canonical catalogue from Appendix E. Decisions [DEC-S1O](../decisions/DECISION_LOG.md#dec-s1o); contract amendment A17.

## Files changed
New: `db/seed/catalog_sprint1.sql`, `src/lib/profile/location.ts`, `src/lib/onboarding/hub-position.ts`, their unit tests, `sprint1-onboarding.db-test.ts`, `s1-uat-03-onboarding.spec.ts`, 2 reports. Changed: `db.mjs` (+ `catalog`), `db-target.mjs`, profile / roles / state / complete / vocabulary domain, stage 1–4 pages and forms, /me dialog, profile editor, `/ops/network` CSS, `verification.ts` (bound kept at 200); tests (DB helper and 7 suites, `db-target` unit test, e2e helpers, 14 specs, UAT uc01 / uc03); DECISION_LOG, API contract, P0_STATUS, readiness docs.

## Migrations / data
No migration. Catalogue data step `node scripts/db.mjs catalog` (idempotent; `seed` runs it). Applied to `hubnetwork_s1uat03` only; shared `hubnetwork_p0` untouched (017).

## Tests / build
format, lint, typecheck, build PASS · unit 44 / 454 · DB 57 / 873 · S1-UAT-03 spec 10 / 10 · UAT L1-L2 19 / 19 · full protected regression 108 specs / 1295 tests / 1266 PASS / 0 FAIL / 29 SKIP / 0 FLAKY · seed idempotent · restart persistence PASS.

## Visual QA
1440 / 768 / 390: stage 1 typed location, stage 3 with ten rows, stage 4 — no overflow, CTAs inside. ACC-08 pixel PASS with the declaration rows recorded INTENTIONAL-BUSINESS (head and foot compared).

## Readiness
READY 96 · IMPLEMENTATION_PENDING 46 · BUSINESS 0 · LEGAL 11 · PO content 2 · ENV 4 · OOS 1 = 160.

## Deviations / blockers
None blocking. PO review: ACC-08 row layout (UAT fields); catalogue delivered as a data step (live placeholder units untouched, not offered); completion still files one membership request per unit until S1-UAT-03B; `/ops/network` rows grow with long names.

## Git
- Branch: `feat/sprint1-completion` (worktree `../1hub-network-sprint1-completion`); start HEAD `392d99e`, unchanged by others
- Implementation commit: `a613d80`
- Report/final commit: the docs commit after it
- Remote: `origin`
- Push status: NOT RUN (task: no push)
- Remote HEAD: origin/main `edd3d24` (unchanged); candidate `int/sprint1-candidate-01` `d497da2` (untouched)
- Working tree: clean after the report commit

## Recommended next task
ChatGPT / PO review of S1-UAT-03. S1-UAT-03B not started.
