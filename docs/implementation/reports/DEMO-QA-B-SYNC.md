# DEMO-QA-B-SYNC

Independent QA (Claude B) of the exact product candidate `f309520` (DEMO-SP1-FOUNDER-01 on DEMO-DIR2-01) with the prepared QA lane `e75778c` cherry-picked. Branch `qa/demo-sync-0710`, worktree `../1hub-network-qa-b`. The tree equals `f309520` plus QA-only files (8 added by the prep, 2 updated here). No product code changed; Claude A's worktree not entered. Not pushed, merged or deployed.

## Environment
Isolated `hubnetwork_demo_qa_b_sync` (created fresh per run: migrate · seed · catalog; the spec applies `demo_0710.sql`), `next start` on :3997 under `nice`, guest browser, 1440 × DPR1 plus 768 / 390. Shared `hubnetwork_p0`: 17 migrations, 0 demo rows, before and after.

## Spec alignment (QA-only)
DEC-DEMO-SP1-D1 narrows DEMO-D2: the founder route is `/talents/[handle]` (`dang-kim-chi`, `ly-gia-bao`, `vo-thanh-ha`, `nguyen-minh-anh`); a profile UUID is 404. The prepared spec and smoke expected `/talents/<uuid>`; both now follow the decision (stricter: UUID → 404, no `de710000-` on any page). Added: CTA matrix test, responsive interaction test, QA-B-04 regression mark.

## Results on `f309520`
| Area | Result |
|---|---|
| Vertical flow (guest): `/` → Sản phẩm → `/products` → Tracely → Đặng Kim Chi → `/talents/dang-kim-chi` ("Đã xác thực danh tính qua 1Hub", `data-demo="DEMO-0710"`) → Giới thiệu → `/about` → logo → `/`; Back / Forward | PASS |
| Direct URL + refresh (`/products`, `/products/tracely`, founder) | PASS (200, clean) |
| Allow-list / 404 (UUID, `not-a-founder`, `pham-quoc-viet`, unknown startup) | PASS |
| Verified state per profile (Kim Chi, Gia Bảo yes; Thanh Hà, Minh Anh no) | PASS |
| CTA / route matrix (5 surfaces: every link < 400, no `#`, visual-only CTAs `/auth` or none, owner-only hidden, `?q=` hand-off, filter region) | PASS |
| Containment 1440 / 768 / 390 × 5 surfaces (overflow, header, dead link, broken image) | PASS 15 / 15 |
| Responsive interactions (filter narrows 3 → 2, card CTA / founder / back / connect not covered, Tổng quan tab, popup via Việt Nam view inside viewport, Esc) | PASS at 1440 / 768 / 390 |
| Privacy (no internal id, `@example.test` address, `tel:` link; no contact card, e-mail or phone on founder) | PASS |
| Console / hydration / 5xx / missing assets (every test) | 0 |
| Spec, final run | 27 / 27 as expected: 25 PASS + 2 expected-fail (QA-B-04 at 768 / 390); two earlier full runs on recreated DBs 21 / 21 |
| HTTP smoke `demo-0710-smoke.mjs` | base 3 / 3 · `--sync` 16 / 16 (statuses, privacy, verified mark) |
| Determinism | `db.mjs demo` twice: 3 / 6 / 6 rows, same profile hash; spec identical on recreated DBs |
| Server log | 0 error, 0 hydration, 0 5xx |

CTA classes: PASS (nav, Sản phẩm, cards, Xem hồ sơ, ← Sản phẩm, founder link, product rows, About map / tabs / popup, Facebook, `/auth` entries) · READ_ONLY_APPROVED (Theo dõi, Đề nghị kết nối, Kết nối, dataroom → `/auth`; Thông tin liên hệ, Xem chỉ số, Xem vị trí tuyển dụng inert; Chỉ số / Cập nhật tabs labels, MISSING_OPTIONAL_SP1_VISUAL_ASSET) · POST_DEMO (Chương trình, Sự kiện, Nhân tài, Tin tức labels) · FAIL none.

## Issues
| ID | Sev | Route | Expected | Observed | Evidence | Recommended A fix |
|---|---|---|---|---|---|---|
| QA-B-04 | P2 | `/about` map, Thế giới view, < 1024 px | every HUB marker opens its popup | HUB Quảng Ninh's marker intercepts HUB Đà Nẵng at 768 and 390 (Việt Nam view works; 1440 works) | Playwright: "QN intercepts pointer events"; probe 768 / 390 topmost = QN | separate overlapping markers below 1024 (offset / cluster) or open the Việt Nam view by default there |
| QA-B-05 | P2 | `/products/tracely` Đội ngũ | a clickable founder row looks clickable | linked rows (Kim Chi, Minh Anh) look like plain rows; only a hover underline, none on touch | `startup.module.css` `a.member:hover strong` only | add a visible cue (chevron / colour) on `a.member` |
| QA-B-06 | P2 | `/products` 390; founder 390 | text fits | search placeholder cut ("…nhà sá"); Chuyên môn "3 năm" wraps to two lines; experience bullets sit on the divider | `tests/visual/actual/demo-qa-sync/390_*.png` | shorter placeholder at < 768; `white-space: nowrap` on years; bottom padding on the bullet list |

Known QA-B issues: QA-B-01 (MEDIUM) **open, unchanged** in `f309520` (`demo` is MUTATING; shared / production refusal applies to DESTRUCTIVE only); it does not affect product verification or the local demo, it is a deploy-safety item. QA-B-02 (HIGH) **open, DEPLOY GATE** (demo target and demo data on that target need a PO decision); it does not block this verification. QA-B-03 (LOW) **CLOSED** by DEC-DEMO-SP1-D1: Product → Tracely → founder → `/talents/dang-kim-chi`; no id in the URL or any page, a UUID is 404.

Info (no action): no footer on DM08 / DM10 / DM13, as the frames draw none; directory shows "Pilot" for PILOT (DM08 label, SOT C9); a demo certificate reads "hết hạn 03/2026" (fixture copy).

## Related
- [DEMO-QA-PREP-B](DEMO-QA-PREP-B.md) · [DEMO_VERTICAL_FLOW_QA](../../demo-0710/qa/DEMO_VERTICAL_FLOW_QA.md)
