# Claude Task Report

## Task
WF03-S01 — ORGANIZATION SELECTOR / LIST. Process: PROCESS-P0-ACCELERATED-SAFE-V2, fast path.

## Status
**DONE — LOCAL REVIEW.** Precheck against the WF03 contract, G11, G15, T00 DTO/API, the ADM8 reference, OpsShell and the capability model found no new conflict.

## Scope completed
`/ops/network` renders the organization list inside OpsShell:
- Rows come from every page of `GET /ops/organizations`.
- Columns: Tổ chức, Trực thuộc, Thành viên, Loại, Trạng thái.
- Selecting a row opens `/ops/org/:orgId`.
- States: loading, empty, failed + "Thử lại".

The page repeats the `requireOps()` check.

## Files changed
- `src/app/(ops)/ops/network/{page.tsx, organization-list.tsx, network.module.css}`
- `tests/visual/specs/wf03-s01-organization-list.spec.ts`
- `tests/visual/specs/wf03-t00-ops-foundation.spec.ts` (asserts S01 instead of its placeholder)
- `tests/visual/pixel-qa/qa-screens.ts` (S01 state: PLATFORM_ADMIN persona)
- `db/seed/seed_p0_deterministic.sql` (fixture convergence fix)
- DECISION_LOG

## Decision delta
DEC-WF03-S01-D1..D4:
- **D1:** column mapping and omissions.
- **D2:** selection is the URL; list states.
- **D3:** pixel state and the below-reference rule.
- **D4:** the seed now resets `role_assignments.valid_to`.

## Business / Data / API delta
None. S01 reuses the T00 endpoint and DTO; no new endpoint, entity or capability.

The fixture fix: `authz.db-test` expires the seeded leader and restores it by reseeding, but the old upsert never reset `valid_to`. Targeted runs therefore saw an expired leader. A full DB run hid this, because it ends with a schema reset.

## Migration
None.

## Security
All 10 cases PASS:
- Guest → /auth; member → 404; membership + a "Trưởng chapter" title alone → 404.
- The leader sees exactly Chapter 01 (no child CLB).
- Admin sees HUB / CHAPTER / CLB, never COMPANY / FUND.
- Query / localStorage / header spoofing changes nothing.
- Direct URLs to Chapter 02 / Club 01 / HUB return 404.
- The UI shows no PII or scope data.
- The error state shows no status, code or request id.

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 157 |
| DB (authz + ops + db incl. seed / schema) | 77 passed |
| S01 Playwright | 7/7 |
| Targeted regression | T00 7/7; pixel-qa screens + harness, shell-routes, console-health, authz-session PASS |

## Pixel (1440×900 DPR1)
| Check | Result |
|---|---|
| Header band | 0 outside text |
| Table | 0 outside text |
| Full page (H12) | Below-reference pixels confined to the 216px OpsShell sidebar, which has its own colour (T00-D1) |
| Structural / major / component | 0 / 0 / 0 |
| Intentional | Sidebar family; canonical columns; "Tạo chapter" and the summit notice (P0 scope); copy; typography migration |

Subtitle tuned to 12px so its glyph box (46–56) matches the reference (46–55).

## Regression
T00 and authz PASS. WF01 / WF02 not re-run: no shared primitive or auth/session behaviour changed (the seed fix only restores fixture validity).

## Blocking gaps
0. C1 stays open for S06/S08 only.

## Git
- Branch: `main`; start HEAD `5225420` (checked again before the commit)
- Implementation commit: `204bfb1`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF03-S02 — ORGANIZATION DASHBOARD
