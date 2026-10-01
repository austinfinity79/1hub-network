# P3-INTERACTION-UX-CLEANUP

**P3 INTERACTION UX CLEANUP — PRE-UAT SAFE BATCH.** PO decisions D1–D7 of 01/10 ([DEC-P3UX](../../decisions/DECISION_LOG.md#dec-p3ux)) on the findings of the [interaction action registry](INTERACTION_ACTION_REGISTRY.md). No new route, destination, behaviour or business rule. Local commit on `be5c0cc`; not pushed, not deployed.

## Result
| Classification | Before | After |
|---|---:|---:|
| PASS | 1215 | 1219 |
| NO_ACTION | 93 | 0 |
| WRONG_ACTION | 0 | 0 |
| WRONG_ROUTE | 0 | 0 |
| MISLEADING_UI | 3 | 3 |
| MISSING_BUSINESS_DECISION | 8 | 4 |
| INTENTIONAL_NON_CLICKABLE | 13 | 18 |
| DEFERRED | 19 | 107 |
| BROKEN | 0 | 0 |

NO_ACTION reaches 0 on evidence, not by relabelling: every former NO_ACTION item was re-measured on the affected screens (opacity 0.55, cursor default, not focusable, click → nothing), or became plain text. Total unchanged (1 351).

## Changes
| Decision | Change |
|---|---|
| D1 | member shell `.productNav [aria-disabled]` and workspace shell `.navItem[aria-disabled]`: opacity 0.55 (the disabled pattern of the UI primitives); labels kept, no href, not focusable |
| D2 | shared `Cta` inert variant: opacity 0.55; new `soon` prop draws a visible "Sắp có" (the "Dữ liệu minh hoạ" pill); "Sắp có" on "Xem deck", "Yêu cầu truy cập", both door "Khám phá mạng lưới", closing "Triển khai chương trình"; footer e-mail as text |
| D3 | About through the same `Cta`; "Sắp có" on "Kết nối hợp tác" ×2 and "Khám phá các câu lạc bộ"; e-mail as text |
| D4 | Library keyword chip: `.chipStatic` (cursor default); no remove action |
| D5 | **not implemented** — see blockers |
| D6 | `not-found.tsx`: "Về trang chủ" → `/` (`ui-button` primary) |
| D7 | closing "Khám phá cơ hội" unchanged; "Triển khai chương trình" disabled + "Sắp có", still a missing decision |

## Tests
| Gate | Result |
|---|---|
| format, lint, typecheck | PASS |
| unit | 33 files / 259 tests PASS |
| build | PASS |
| interaction spec | 14/14 (5 new: member headers, homepage + About CTAs, Library chip, 404 keyboard + Back, mobile 390) |
| affected specs | 210/210 (landing, Library, shell navigation and routes, WF02 S01 / S03 / S04 / S07 / S08 / T00, WF05 S01 / S02, auth entry, L6, console health) |
| protected smoke | L1, L2, L3, L5 journeys and UAT L1–L2 19/19 PASS on a freshly reset local DB |
| responsive / release | release-rc-responsive, internal-alpha-release, L1 / L2 responsive PASS |
| re-audit | 18 affected page states re-inventoried and probed; WRONG_* 0, BROKEN 0 |
| runtime | hydration 0, console errors 0, 5xx 0, broken links / assets 0 |

One run showed `wf03-uat-journey` NEG-WF03 failing on a duplicated `MEMBERSHIP_APPROVED` for seed membership `…0003`: both events come from the two audit runs (30/09 and 01/10) clicking "Duyệt" on the local DB after a fixture reset it to pending. After `db:reset` (local only) the spec passes; no code involved.

Pixel: no baseline changed; the landing report records the disabled look and the "Sắp có" pills as intentional; all thresholds pass.

## Blockers / deviations
- **D5 stopped:** BD-01 says `mode=signup` "changes copy only", but no sign-up copy is approved — AUTH1 ("Đăng nhập & đăng ký") has one frame with "Đăng nhập" / "Gửi liên kết đăng nhập" only. Needed: the sign-up heading and button copy (and whether `/login` becomes an alias), or approval of "Đăng nhập" for both intents.
- The `/me` header items (DEFERRED) dim with the same shared rule.
- Footer "Chương trình" / "Sự kiện" stay plain labels at full strength (DEC-AIG-D1), unchanged.

## Remaining MISSING_BUSINESS_DECISION
| Element | Screens | Decision needed |
|---|---|---|
| "Triển khai chương trình" | `/` closing and footer (guest, member) — 4 | destination (programme creation is WF04 demo only; BD-06 / HD-A4) |

## Related
- [INTERACTION_ACTION_REGISTRY.md](INTERACTION_ACTION_REGISTRY.md) · [../CLAUDE_LATEST_REPORT.md](../CLAUDE_LATEST_REPORT.md) · [ALPHA-INTERACTION-GAP-FIX.md](ALPHA-INTERACTION-GAP-FIX.md)
