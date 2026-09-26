# Claude Task Report

## Task
WF03-S08 — ORGANIZATION SETTINGS / RELATIONSHIPS. Process: PROCESS-P0-ACCELERATED-SAFE-V2, focused full preflight → decision freeze → implement.

## Status
**DONE — LOCAL REVIEW.**

## Preflight
| Area | Result |
|---|---|
| Relationship contract | API §8.7 (list / create / close), SCR S08 (`create_relationship`, `close_relationship_preserve_history`), G9, C1 |
| Lifecycle | `organization_relationships.state` (`record_state`: ACTIVE → CLOSED) + `ended_at` represent history. No schema gap |
| RBAC | `org:manage_relationship` exists (HUB_COMMUNITY_LEADER exact org, PLATFORM_ADMIN) |
| Migration | The DB did **not** guarantee one ACTIVE parent → 009 required; current data is consistent |
| Audit | No relationship code existed → minimum 2 new codes |
| New human decisions | 0 |

## Decision freeze
**OPEN-WF03-S08-RELATIONSHIP-CONTRACT → CLOSED** by DEC-WF03-S08-RELATIONSHIP-CONTRACT; implementation decisions DEC-WF03-S08-D1..D4.

| Item | Decision |
|---|---|
| Relationship | PARENT only, stored source = parent → target = child |
| Valid pairs | HUB → CHAPTER and CHAPTER → CLB |
| Delta vs the task list | HUB → CLB excluded, following the higher-precedence Design SOT (ADM21 / BR-FS03-09) |
| Parents per child | One ACTIVE parent, enforced by DB index + transaction; never a silent replace |
| Change parent | Explicit `replaces_relationship_id`: close old + create new in one transaction |
| End | `close` sets CLOSED + `ended_at` (+ optional reason); no DELETE |
| Authority | `org:manage_relationship` on **both** ends, exact scope |

## Scope completed
- **API:**
  - `GET` / `POST /api/v1/ops/organizations/{orgId}/relationships`
  - `POST …/relationships/{relationshipId}/close`
  - `Idempotency-Key` honoured per §2.3
- **Page:** `/ops/org/:orgId/settings` inside OpsShell. It replaces the placeholder.
  - Title and counts, "+ Thêm quan hệ".
  - Tree position.
  - Active table with "Kết thúc" and an inline reason.
  - History.
  - Add / change-parent form fed by server candidates.
  - Valid-pair rules.

## Files changed
- `db/migrations/009_p0_one_active_parent.sql`
- `src/lib/ops/relationships.ts`, `relationship-rules.ts`, `relationships.db-test.ts`, `relationships.capability.db-test.ts`
- `src/lib/audit/audit.ts` (+2 codes)
- `src/app/api/v1/ops/organizations/[orgId]/relationships/{route.ts, [relationshipId]/close/route.ts}`
- `src/app/(ops)/ops/org/[orgId]/settings/{page.tsx, organization-relationships.tsx, relationships.module.css}`
- Tests:
  - `tests/visual/specs/wf03-s08-organization-relationships.spec.ts`
  - `tests/visual/pixel-qa/qa-screens.ts`
  - `src/lib/db/schema.db-test.ts` (+009)
  - `src/lib/ops/ops.db-test.ts` (a second ACTIVE parent is now refused by the DB)
  - `tests/visual/specs/api-contract.spec.ts` (comment)
- Docs: DECISION_LOG, WF03 plan, WF03 pre-implementation audit, P0_STATUS, CLAUDE_LATEST_REPORT

## Migration 009
- A guard aborts with DATA INCONSISTENCY if a child has more than one ACTIVE PARENT; it never repairs.
- One partial unique index, `uq_active_parent_per_child`.

| Check | Result |
|---|---|
| Fresh DB (throwaway): migrate + seed | PASS |
| Upgrade of the dev DB | PASS |
| Rerun | PASS (skipped) |
| Guard on a seeded violation | Aborted and rolled back, as intended |

## Security (14 cases PASS)
| # | Case | Result |
|---|---|---|
| 1 | Guest → /auth; API 401 | PASS |
| 2 | Member → page 404, API 403 | PASS |
| 3 | ACTIVE membership → no authority | PASS |
| 4 | Leadership title → no authority | PASS |
| 5 | `org:manage` without `org:manage_relationship` → 403 on read, create and close (authorizer substitution test) | PASS |
| 6 | Foreign organization → 404 / 403 | PASS |
| 7 | Spoofed ids / headers, and a leader reaching another org → 403, no change | PASS |
| 8 | Unsupported pair / type → 422 | PASS |
| 9 | Second ACTIVE parent → 409 (service and DB) | PASS |
| 10 | Self-parent → 422 | PASS |
| 11 | 2- and 3-cycles → 422 | PASS |
| 12 | Concurrent parents → exactly one ACTIVE; stale change → 409; idempotent replay → first result | PASS |
| 13 | Refused calls write no audit | PASS |
| 14 | DTO / log contain no PII; server log has 0 email / token / cookie lines | PASS |

## Tests
| Gate | Result |
|---|---|
| Format / lint / typecheck / build | PASS |
| Unit | 157 passed |
| DB (full) | 327 passed (+11 S08) |
| S08 Playwright | 8/8 |
| Targeted regression | 94 passed: T00, S01–S04, S06, S08, api-contract, shell-routes, console-health |

## Pixel (1440×900 DPR1)
Full page: CROP_TO_REFERENCE_HEIGHT; only the sidebar continues below.

| Segment | Outside-text drift |
|---|---|
| Header incl. button | 32 px (0.045%, edge AA) |
| Tree card | 0 |
| Active card top | 0 |
| First row | 20 px (raster) |
| History card | 0 |
| Add card top | 2 px |
| Rules card top | 0 |

- Structural / major / component: 0 / 0 / 0.
- Intentional:
  - the request queue, partner / co-organizer / programme rows and the audit-log card are omitted (the cards below move up);
  - the add form is shown idle;
  - typography migration.

## Contract notes (non-blocking)
- The only frozen conflict code is `MEMBERSHIP_INVALID_TRANSITION`, which is reused for 409s.
- Idempotency-Key is optional (provisional leniency), as for the other §2.3 operations.

## Blocking gaps
0.

## Git
- Branch: `main`; start HEAD `e9ff1ec` (checked again before each commit)
- Implementation commit: `2b081a5`
- Report/final commit: the commit containing this report
- Remote: `origin` (github.com:austinfinity79/1hub-network)
- Push status: **NOT RUN** — LOCAL REVIEW MODE; remote HEAD `0b4095f`
- Working tree: clean after the commit, except the untracked `AGENTS.md`

## Recommended next task
WF03-S07 — EVENT MANAGEMENT.
