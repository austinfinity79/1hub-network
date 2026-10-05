# S1-UAT-08A evidence

Evidence and PO acceptance pack for [S1-UAT-08A-about](S1-UAT-08A-about.md) on implementation HEAD `679014a` (clean build `KB2Mey24_OEaf9Q5w_8G`), isolated DB `hubnetwork_s1about`.

## Gates
| Gate | Result |
|---|---|
| format · lint · typecheck · build | PASS |
| Unit | 40 files · 428 / 428 (incl. `about-data.test.ts` 13, A4 included) |
| DB | 50 files · 804 / 804 |
| About browser spec `s1-uat-08a-about` | 10 / 10 (rerun with the A4 assertions) |
| Protected regression | **94 specs · 1237 tests · 1208 PASS · 0 FAIL · 29 SKIP · 0 FLAKY** (20.6 min) |

Skips: opt-in / env-gated only, unchanged (`pixel-qa-screens` 24, `admin-design-01-capture` 2, `admin-prod-08-pixel` 1, `wf06-prod-library` 1, `wf06-prod-qa` 1). No failure to classify.

## Test matrix
| Case | Where | Result |
|---|---|---|
| 34 current-term people, order 1 … 34, excluded rows absent | unit + browser | PASS |
| Titles / flags verbatim; duplicate UAE kept | unit | PASS |
| Portrait only on exact match; placeholder otherwise | unit + browser | PASS — 31 photos, 3 placeholders |
| Org leads only from explicit links; CN / SG / QN empty | unit + browser | PASS |
| 43 activities, workbook order, own image | unit + browser | PASS |
| "Link liên quan (bỏ)" absent (data and page) | unit + browser | PASS |
| Missing location / HUB role → "Chờ cập nhật"; "21/22/2024" as written | unit + browser | PASS |
| Filters: Tất cả 43 · Cuộc thi 11 · Chuỗi sự kiện 3 · Chương trình 0 (Sự kiện = the other 29) | browser | PASS |
| Malformed row / unknown tag never crash | unit | PASS |
| Homepage → `/about` | browser | PASS |
| Console errors on `/about` | browser | 0 |

## Responsive (1440 · 768 · 390)
| Check | Result |
|---|---|
| Horizontal overflow | none at all three widths |
| Activity banner | 16:9 (420 × 236 desktop; full-width 16:9 narrow) |
| Clipped text in cards | none (titles, roles, organiser lines wrap) |
| Observation | at 1440 the S1-UAT-02 "Góp ý" pill can overlay the strip's next arrow at some scroll positions (overlay, outside this task) |

## PO acceptance pack
| Part | Content |
|---|---|
| A — Humans | [display order 1 … 34](S1-UAT-08A-humans.md), excluded rows (2 "Các thế hệ trước" / "Bỏ"), 3 people without portrait |
| A — Humans (title / role) | titles as written; org leads per [org diagram](S1-UAT-08A-about.md#org-diagram); A4 RESOLVED_BY_PO |
| B — Activities | [43 source rows with flags](S1-UAT-08A-activities.md), all 43 rendered (full set, filterable); missing fields "Chờ cập nhật"; omitted link column |
| C — Visual | 1440 · 768 · 390 captures of Humans, org diagram and activities (spec `s1-uat-08a-about` + hand-off set) |
| D — Before / after | same three sections at the three widths: before = `ad5dc06` build, after = `679014a` build |
| Open items for PO | UNRESOLVED_SOURCE_ANOMALY A1 duplicate UAE Chủ tịch · A2 China lead · A3 Singapore lead · A5 naming · A6 row 36 date · A7 missing fields · A8 empty "Chương trình" · A9 spelling · A10 Phạm Thành Long portrait |
Screenshots (before / after, 1440 · 768 · 390) are attached to the task hand-off, not committed.

## Privacy / security
| Check | Result |
|---|---|
| External links | none rendered from the workbook; images served locally (no Drive hotlinking) |
| Server log (final run) | 0 unexpected 5xx; 0 hydration errors; 0 runtime exceptions; 1 expected `ApiError` (a deliberately refused `/dev/login`, 4xx); 0 `token=`, session cookie or hash |
| Browser console | 0 errors on `/about` (asserted after every About test); console-health suite PASS |
| Data | NO_SCHEMA_CHANGE; shared `hubnetwork_p0` still 017 |

## Git
| Field | Value |
|---|---|
| Branch | `feat/s1-uat-08a-about` (worktree `../1hub-network-s1-about`), base `ad5dc06` |
| Implementation commit | `679014a` |
| Report commit | the docs commit after `679014a` |
| Push / merge / deploy | NOT RUN |
| origin/main · production | `edd3d24` · `78f21f2` (untouched) |

## Related
- [S1-UAT-08A-about](S1-UAT-08A-about.md)
- [S1-UAT-08A-humans](S1-UAT-08A-humans.md)
- [S1-UAT-08A-activities](S1-UAT-08A-activities.md)
- [DECISION_LOG DEC-S1H](../../decisions/DECISION_LOG.md#dec-s1h)
