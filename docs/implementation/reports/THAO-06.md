# THAO-06

Startup Profile v2 — the frozen M3 production slice on the PO decisions of 07/10.

- Milestone: THAO-M3 · branch `feat/thao-m3-startup-profile` · worktree `../1hub-network-thao-m3` · base `e7bf6ef`
- Decisions: [DEC-THAO-SP](../../decisions/DECISION_LOG.md#dec-thao-sp) D1–D10 (committed first, `80b9f12`)
- Migration 021 (additive), applied only to the isolated `hubnetwork_s1uat03`; not merged, not deployed.

## Scope
| Part | Route / API | Rule |
|---|---|---|
| Tổng quan team (D1) | `/products/[slug]` | guest: real ventures show a sign-in hint, no name / id / count; member: owner + ACTIVE members through PROFILE_DISCOVERY (PRIVATE left out); demo allow-list unchanged |
| Chỉ số (D2) | `/products/[slug]/metrics` · `GET/POST /startups/{slug}/metrics` · `PATCH …/metrics/{metric}` | fixed `VENTURE_METRIC` catalogue (5 items, admin relabel / reorder / archive); PUBLIC / PRIVATE per metric, new = PRIVATE; quarterly, append-only (trigger), MANUAL; no future quarter |
| Cập nhật (D3) | `/products/[slug]/updates` · `GET/POST …/updates` · `PATCH/DELETE …/updates/{id}` | manual plain text ≤ 2000; edit; soft delete; visibility = the venture's |
| Follow (D4) | `GET/PUT/DELETE …/follow` | startup only; signed-in ACTIVE account; idempotent; own state only — no count, no list, no notification |
| Frame (D10) | all three tabs | DM10 / SP1 language: tabs are links, header card, inert Connect (D5) |

Write permission everywhere: owner or EDIT member; guest / inactive 401, not on the team 403, not visible 404, archived 409, invalid 422 (`METRIC_VALIDATION_FAILED`, `UPDATE_VALIDATION_FAILED`). Every write is audited with ids only (no metric value, no update text). API contract: Amendment A18.

## Deferred (not implemented)
Connect (D5), Recruitment (D6), Investor / GP / LP + Dataroom (D7), real ID verification (D8; "Đã xác thực…" stays DEMO-only), narrative / website fields (D9), automatic updates, notifications.

## Schema (021)
| Object | Note |
|---|---|
| `VENTURE_METRIC` type + 5 items | ids `26000000-…`; a DO-block refuses fewer than 5 |
| `venture_metrics` | (venture, metric) → visibility PUBLIC / PRIVATE |
| `venture_metric_values` | quarter, value ≥ 0 (2 dp), source MANUAL; UPDATE refused |
| `venture_updates` | body 1–2000, `deleted_at` / `deleted_by_account_id` |
| `venture_follows` | (account, venture) primary key |

Documented rollback refuses while M3 data exists; exercised by the 019 recovery test.

## Fixes found on the way
| Issue | Fix |
|---|---|
| Catalogue ids `24000000-…` collided with the Sprint 1 REGION seed (silently skipped) | `26000000-…` + a count check in 021 |
| A guest write answered 403 | 401 before any venture lookup |
| Editor value input 2 px off the selects | border-box, height 40 |

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build · unit | PASS · PASS · PASS · PASS · 466 / 466 |
| DB tests (incl. 10 new startup tests) | 883 / 883 |
| thao-06-startup-profile + updated SP1 / DIR2 / vertical-flow specs | 65 / 65 |
| Full regression (107 specs, 1401 tests) | 1372 PASS · 29 SKIP (opt-in) · 0 FAIL · 0 FLAKY; first run found 2 stale assertions (below), fixed, then the whole suite rerun |
| UAT L1–L2 | 19 / 19 |
| Server log | hydration 0 · 5xx 0 · secrets 0 |

Updated stale assertions (tabs and "Xem chỉ số" became links per D10, Follow live per D4): demo-sp1-founder-01, demo-dir2-01, demo-qa-vertical-flow; schema / 019-migration DB tests know migration 021.

Screenshots: `tests/visual/actual/thao-06-*.png` (guest and owner × overview / metrics / updates × 1440 / 1280 / 1024 / 768 / 390, plus both editors).

## Known debt
- No admin removal of venture updates: no post-moderation primitive exists (D3).
- An unpublished (PRIVATE / DRAFT) venture has no public page, so its team manages metrics and updates by API only.
- The 5-item starter catalogue is product content: PO to confirm labels.
- ~~The "Theo dõi" on `/products` cards stayed inert~~ — closed by [THAO-M3-QA-01](THAO-M3-QA-01.md) (wired to Follow v1).
- DM11 / DM12 pixel baselines still wait for the UPDATED files; built in the DM10 language (D10).

## Related
- [THAO-05](THAO-05.md) · [SCREEN_ROUTE_MAP](../../demo-0710/SCREEN_ROUTE_MAP.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md)
