# THAO-M3-QA-01

Startup Profile v2 — final milestone QA and main freeze for THAO-M3.

- Branch `feat/thao-m3-startup-profile`; candidate in the contract `f93fd65` is not an object — the reported THAO-06 head is `f93fd85` (one-character transcription); verified unchanged before QA.
- Decisions: [DEC-THAO-SP](../../decisions/DECISION_LOG.md#dec-thao-sp) D1–D10; deferred scope (D5–D8, automatic updates, notifications, D9) absent.

## P1 CTA gate — `/products` card "Theo dõi"
| Before | After |
|---|---|
| Signed-in member: an inert span drawn as a button (aria-disabled), a dead CTA | Follow v1 (D4): the same `FollowButton` as the startup page; "Theo dõi" / "Đang theo dõi", `aria-pressed`, persists across reload and the startup page |
| Guest: link to `/auth` | unchanged |

Server reads only the viewer's own followed slugs (`followedSlugs`, published startups only); no count, no list. Discovery card style gains a `following` state; DM08 guest view unchanged.

## Migration 021 QA (throwaway `hubnetwork_m3qa_mig`, dropped after)
| Check | Result |
|---|---|
| Clean apply 001→021 + seed | PASS |
| Documented rollback with no M3 data → 020 ledger, tables gone | PASS |
| Re-apply applies 021 only; re-run is a no-op | PASS |
| Additive: only `schema_migrations` +1, `vocabulary_types` +1, `vocabulary_items` +5 (VENTURE_METRIC) | PASS |
| Append-only trigger refuses UPDATE | PASS |
| Rollback refused while M3 data exists, nothing lost | PASS |

No shared or production database touched; `hubnetwork_s1uat03` only for tests.

## Verification
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| unit · DB | 466 / 466 · 883 / 883 |
| thao-06 (incl. card Follow × 5 widths) + demo-dir2-01 | 31 / 31 |
| Full regression (107 specs, 1407 tests) | 1378 PASS · 29 SKIP (opt-in) · 0 FAIL · 0 FLAKY |
| UAT L1–L2 | 19 / 19 |
| Server log | hydration 0 · 5xx 0 · secrets 0 |

Privacy / RBAC (thao-06 spec): guest team leak 0, PRIVATE metric leak 0, unauthorised writes 401 / 403, venture mismatch 403 / 404, query manipulation ignored, follower count / list never exposed.

## Notes
- The founder page's "Theo dõi" (a person, DM13) stays inert by D4 (startup-only Follow): not focusable, aria-disabled.

## Related
- [THAO-06](THAO-06.md) · [CLAUDE_LATEST_REPORT](../CLAUDE_LATEST_REPORT.md) · [P0_STATUS](../P0_STATUS.md)
