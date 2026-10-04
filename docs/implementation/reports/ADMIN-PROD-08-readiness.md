# ADMIN-PROD-08-readiness

**Evidence 6–14: routes / actions, RBAC, accessibility, console, DB, regression, debt, blockers and the production-readiness matrix.** Parent: [ADMIN-PROD-08-closure.md](ADMIN-PROD-08-closure.md).

## 6. Routes / actions
Every Admin route (7 queues / lists + 5 details) loads 200 for PLATFORM_ADMIN; every link on every screen (main + nav) resolves < 400 for admin and Chapter leader; every enabled button is wired to a React handler or is a form submit (no dead CTA); no account-escalation or hard-delete control anywhere; the withdrawn leader account-request route answers 404 / 405 (PROD-07). Every visible action maps to its PROD-03…05 API (PROD-07 parity, unchanged).

## 7. RBAC smoke (protected regression, unchanged decisions)
| Actor | Result |
|---|---|
| PLATFORM_ADMIN | all 7 admin routes and APIs; platform-wide revoke |
| HUB / Chapter / CLB leader | Home · Verification · Access only; other admin routes 404; revoke only on own unit (DEC-ADM-D02); no account escalation (DEC-ADM-D04) |
| member / revoked-capability | 404 on every admin route, 403 / 404 on every admin API |
Source: `admin-prod-07-qa.spec.ts` actor matrices, `admin-prod-03…06`, `*.db-test.ts` — all green in the run below.

## 8–9. Accessibility, console
Keyboard reach, visible focus, labels, button names, one `h1` per screen (PROD-07 a11y spec); confirm focus lands in the form (reason field or Huỷ), required-reason submit disabled until a non-blank reason, disabled buttons are real `disabled` (ADMIN-PROD-08 layout spec). Console errors 0 · hydration errors 0 · unexpected 5xx 0 (every spec asserts it per test).

## 10. DB / migrations
No new migration. `admin-migration.db-test.ts` in the green DB run: FRESH 001 → 017 + seed, UPGRADE (production-shaped data, 017 only, every row kept), RECOVERY (STOP check, documented rollback, lossless re-apply). Fresh `db:reset` before the regression and before each pixel capture.

## 11. Full protected regression (final tree, fresh DB + QA vocabulary)
| SPEC_COUNT | TEST_COUNT | PASS | FAIL | SKIP | FLAKY |
|---|---|---|---|---|---|
| 91 | 1191 | 1162 | 0 | 29 | 0 |

Skips (all opt-in / environment-gated, none hides a failure): `pixel-qa-screens` ×24 (`PIXEL_QA_SCREENS`), `wf06-prod-library` ×1 (`WF06_FEED_DOWN`), `wf06-prod-qa` ×1 (`WF06_QA_FEED=crafted`) — pre-existing; `admin-design-01-capture` ×2 (`ADMIN_DESIGN_CAPTURE`) and `admin-prod-08-pixel` ×1 (`ADMIN_PIXEL_QA`) — run separately on a fresh DB: 3 / 3 passed, 70 MATCH + 12 KNOWN_DEBT, 0 differing pixels. Also: format · lint · typecheck PASS · unit 37 / 367 · DB 47 / 750 · build PASS.

## 12–13. Known debt and blockers
Approved non-blocking (PO, P2 / V2.1): sparse desktop canvas on low-content pages; compact typography / controls; the 390 px OpsShell sidebar. Carried, non-visual: queue filters not kept in the URL; capability codes / grantor ids shown verbatim in the access table; approve is single-step. **P0_BLOCKERS = 0.**

## 14. Production-readiness matrix
| Area | Status | Evidence |
|---|---|---|
| Contract | PASS | DEC-ADM incl. D02 / D04 reconciled; CONTRACT_CONFLICT = 0 (PROD-07) |
| DB | PASS | 017 schema, constraints, no new migration |
| API | PASS | 05 §26–28 endpoints, error envelope, idempotency |
| RBAC | PASS | actor matrices, D02 exact-scope revoke, D04 |
| Frontend | PASS | 12 screens, parity, no dead CTA |
| Functional QA | PASS | PROD-07 + this run |
| Security QA | PASS | IDOR, escalation, concurrency, audit hygiene (PROD-07) |
| Pixel QA | PASS | 70 / 70 MATCH vs approved baseline |
| Responsive | KNOWN_DEBT | 1440 / 1024 PASS, 768 desktop-first, 390 shell debt (approved) |
| Accessibility | PASS | smoke, confirm focus, labels |
| Audit | PASS | every admin mutation audited, no secrets (PROD-07) |
| Migration | PASS | fresh / upgrade / recovery |
| Regression | PASS | 1162 / 0 / 29 classified / 0 flaky |

## Related
- [ADMIN-PROD-08-closure.md](ADMIN-PROD-08-closure.md) · [ADMIN-PROD-08-pixel-responsive.md](ADMIN-PROD-08-pixel-responsive.md) · [ADMIN-PROD-07-qa-summary.md](ADMIN-PROD-07-qa-summary.md)
