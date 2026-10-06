# S1-UAT-03 evidence

Evidence for [S1-UAT-03-onboarding](S1-UAT-03-onboarding.md) on `a613d80`, isolated DB `hubnetwork_s1uat03`.

## Gates
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 44 files · 454 / 454 (incl. `location.test.ts` 5, `hub-position.test.ts` 5) |
| DB | 57 files · 873 / 873 (incl. `sprint1-onboarding.db-test.ts` 16) |
| S1-UAT-03 browser spec | 10 / 10 (`s1-uat-03-onboarding.spec.ts`, 1440 / 768 / 390 included) |
| L1-L2 UAT | 10 specs · 19 / 19 |
| Protected regression | 108 specs · 1295 tests · 1266 PASS · 0 FAIL · 29 SKIP · 0 FLAKY (visual 98 / 1276 / 1247 / 29 skip; UAT 10 / 19 / 19) |

Final full protected regression on `a613d80`: fresh build, guarded `reset` of `hubnetwork_s1uat03` (001 → 020, seed, catalogue), one server, visual 25.6 min then UAT on the same server. Server log: hydration 0 · 5xx 0 · invite secret 0 · 40-hex tokens 0; the one `ApiError: This account cannot sign in.` is the expected suspended-account negative test. The 29 skips are the existing conditional skips (pixel-qa screens 24, admin captures 3, wf06 2), unchanged from earlier runs. An earlier attempt was discarded: its server stopped mid-run when the session restarted (ECONNREFUSED), not a product failure.

## Data
| Check | Result |
|---|---|
| Catalogue | HUB Tổng 1 · Chapters 13 (FB-11 order) · CLBs 55 = HighSchool 7 · Hà Nội 22 · Đà Nẵng 6 · Hồ Chí Minh 20; 68 PARENT relationships; 10 countries + "Khác"; 34 provinces, 4 pinned |
| Fresh DB | guarded `reset` 001 → 020, fixture seed, catalogue |
| Seed idempotency | state hash equal after reset, after `seed` again and after `catalog` again; DB test: two more runs change no row; no `now()` / random in the file |
| Restart persistence | typed country / place and three positions saved, server stopped and started, read back equal: "Thái Lan / Bangkok", HUB → Chapter → CLB, all PENDING |
| Shared DB | `hubnetwork_p0` ledger 017 before and after; nothing applied there |

## Acceptance
| AC | Where | Result |
|---|---|---|
| US-01.07-AC01…06: required fields, 11 countries in order, Việt Nam 4 pinned + 30 + Khác, Singapore typed, "Khác" needs a name, new country clears | browser + DB + unit | PASS |
| US-01.09: free tags, unknown tag, no duplicate, ≤ 5, no Skills (rechecked); AC08 "Quay lại" keeps stage 2 | browser + DB | PASS |
| US-01.10-AC02 no role → blocked (UI + API); AC04 forged privilege → no effect | browser + DB | PASS |
| US-01.11-AC01/02 13 Chapters; CLB level 4 Chapters, 22 / 20 / 6 / 7; new Chapter clears the CLB | browser + DB | PASS |
| US-01.11-AC03/04 5 positions, Tên Ban / Ghi rõ ≤ 60; "Hiện tại" locked | browser + unit | PASS |
| US-01.11-AC05/06 U8 in order, "Chờ xác minh"; another term saved, overlap refused; ≤ 10 rows; future / end-before-start refused | browser + DB + unit | PASS |
| US-01.11-AC08 "Chủ tịch HUB Network Hà Nội" → no ops screen, ops API 403 / 404, no capability / scope / leadership | browser + DB | PASS |
| US-01.11-AC07 / AC09, US-01.13-AC01 (requests per position, routing, withdrawal) | — | DEPENDENCY_ON_S1_UAT_03B |
| US-01.12-AC01 12 items (typed place counts) · AC03 "Sửa" → back to stage 4 · preview without e-mail / phone | browser + DB | PASS |

## Stale tests updated
| Assumption | Files | Class |
|---|---|---|
| stage 3 passes with no role | DB helper `passStages`, e2e helpers (`ensureRoleMinimum`, UI helper), resume, 7 specs; percents +1 item (wf02-s02, wf01-s07, complete) | STALE_TEST |
| free-text position / period, one claim per unit | roles, complete, wf01-s05 / s07 / s08, wf01-uat-journey, responsive, UAT uc01 / uc03 | STALE_TEST |
| region labels "Hà Nội", fixture-only org lists | library, ops dashboard / hierarchy, wf02-s04, wf03-s01 (pixel capture filters the catalogue), wf05-s02 | STALE_TEST |
| `/ops/network` fixed row height | IA-P2-03 at 390 with real names | REAL_REGRESSION (data-exposed), fixed |

## Related
- [S1-UAT-03-onboarding](S1-UAT-03-onboarding.md)
- [DECISION_LOG DEC-S1O](../../decisions/DECISION_LOG.md#dec-s1o)
