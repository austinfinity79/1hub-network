# Demo SOT v1 — 07/10 demo

**Status:** FROZEN for implementation by DEMO-SOT-00 (06/10/2026, branch `feat/sprint1-completion`), amended by DEMO-SOT-00-FIX (PO audit 06/10: SP1 mapping, Founder public view, DEMO-D9 approved). This is documentation only: no runtime code, migration or deploy.

## Authority
| Layer | Source of truth for the demo |
|---|---|
| Presentation | PO pack `hub New Design 7:10` → `design-reference/final/demo-0710/` ([map](FIGMA_REFERENCE_MAP.md)). It supersedes the earlier Homepage / About presentation |
| Screen meaning | semantic names: Chương trình · Sự kiện · Sản phẩm / Startup · Nhân tài. DIR numbers never rename a concept ([route map](SCREEN_ROUTE_MAP.md)) |
| Change list | Thảo, `1hubnetwork_thay-doi-tu-sprint1.docx` (06/10), §A highlighted items |
| Business / data truth | canonical schema and rules (CLAUDE.md §3, Data SOT), catalogue 1 / 13 / 55, S1-UAT-08A About data. Text drawn in a frame is placeholder unless confirmed |

## Review journey
`/` → "Sản phẩm" → `/products` → `/products/tracely` → Đặng Kim Chi → `/talents/<id>`, showing "Đã xác thực danh tính qua 1Hub" (DEMO) → "Giới thiệu" → `/about` → logo → `/`. The whole journey runs as a guest.

## Decisions
| ID | Decision |
|---|---|
| DEMO-D1 | 13 authoritative screens / states, DM01–DM13. MUST: DM01–DM05, DM08, DM10, DM13. SHOULD (read-only): DM11 Chỉ số, DM12 Cập nhật (UPDATED PO frames, files pending). REFERENCE: DM06, DM07, DM09 |
| DEMO-D2 | Routes (A): `/`, `/about` (popup and tabs are in-page states), `/products`, `/products/[slug]`, `/products/[slug]/metrics`, `/products/[slug]/updates`, `/talents/[profileId]`. Reserved: `/programmes`, `/events`, `/talents`. No existing route changes |
| DEMO-D3 | Reuse (B): projects / project_members / individual_profiles / catalogue / library canonical source; presentation content in a read-only code fixture; **no migration** ([data contract](DEMO_DATA_CONTRACT.md)) |
| DEMO-D4 | Demo data (C): 3 startups (Tracely, AgriTrace, Kho Lạnh Miền Tây) and 6 fictional profiles, prefix `de710000-`, separate data step `db.mjs demo` |
| DEMO-D5 | Guest / auth (D): every demo screen is public; the founder route renders the demo allow-list only, and any other id is 404 |
| DEMO-D6 | CTA (E): no dead link, no `href="#"`, no fake success. An unbuilt target is a plain label, and a production workflow is visual-only (guest → `/auth`) |
| DEMO-D7 | Responsive (G): pixel QA at 1440 × DPR1 full-page; containment and pointer QA at 768 and 390 (no frames exist) |
| DEMO-D8 | Pixel (H): per-block method of DEC-H1-D5. Data-driven text is INTENTIONAL-DATA. Placeholder content in a frame ("Doanh nghiệp A", "Họ tên — chờ cập nhật") is omitted, following DEC-H1-D2 |
| DEMO-D9 | **APPROVED (PO, 06/10).** Space Grotesk on the new demo / public surfaces where it matches the frame (DM01–DM13 and the shared public header / footer); this extends DEC-HD-12. No global retheme: admin, member and ops workspaces keep their faces. Mono labels stay IBM Plex Mono 500 (DEC-H1-D4) |
| DEMO-D10 | Identity verification on the Founder Profile is **DEMO STATE ONLY**: the task's "Đã xác thực danh tính qua 1Hub" (replacing the drawn chip "Hồ sơ đã xác thực định danh") comes from a fixture flag on allow-listed demo profiles; no verification exists, nothing is stored |
| DEMO-D11 | Ecosystem: DM02 draws 7 rows (1Hub, APEC Innovation Challenge, iHUB Incubator, AI - Cofounder, Builder Camp, iHUB Ventures, Vietnam's National Ventures). The demo renders that **visual** list; the business list stays OPEN (C1). External links only where the PO gives a URL |
| DEMO-D12 | Exclusions (J): [OUT_OF_SCOPE_POST_DEMO](OUT_OF_SCOPE_POST_DEMO.md). Superseded items (F): [SUPERSESSION_MATRIX](SUPERSESSION_MATRIX.md) |
| DEMO-D13 | Founder demo mode is **PUBLIC VIEW** (DM13). Owner-only controls in the frame ("+ Tạo sản phẩm", privacy-setting labels) are not rendered and are never acceptance evidence |
| DEMO-D14 | SP1 tabs are locked by meaning: Tổng quan (DM10, file 10), Chỉ số (DM11, UPDATED file 13), Cập nhật (DM12, UPDATED file 12) |

## SOT conflicts
| ID | Conflict | Demo handling |
|---|---|---|
| C1 | SOT_CONTENT_CONFLICT. Ecosystem count: feedback "5 nhánh", Thảo's table 6 (without "Danh mục đầu tư"), DM02 draws 7 (adds APEC Innovation Challenge) | visual list per DEMO-D11; PO decides the business list. **Not a blocker** |
| C2 | Thảo's ecosystem links: Builder Camp → `ihub.ventures`, iHUB Ventures → `deck.ihub.ventures`, iHUB Incubator none, APEC none | links rendered as given, flagged for PO check; no URL invented |
| C3 | DIR numbering: Thảo DIR0/2/3 vs Figma DIR2.1/3/4 | semantic mapping ([route map](SCREEN_ROUTE_MAP.md)) |
| C4 | Counts: "60+ cộng đồng và CLB" / "Hơn 60 câu lạc bộ" vs 55 catalogue CLBs; popup "7 CLB trực thuộc" for Đà Nẵng vs 6; "11 HUB khu vực" = 13 chapters minus HighSchool and Business (consistent) | canonical counts (55; Đà Nẵng 6) are used, so **not a blocker**; marketing stats only from S1-UAT-08A copy |
| C5 | Tab label "HUB Khu vực" (DM04, Thảo) vs "HUB Chapter" (DM05) | "HUB Khu vực" (Thảo + DM04) |
| C6 | Homepage: Thảo asks for 3 sections (Chương trình · Sản phẩm · Nhân tài); DM01 draws 2 (no Nhân tài). Marquee: Thảo "Mobifone Open Challenge" vs DM01 "MBBank Open Challenge" | DM01 as drawn (presentation SOT) |
| C7 | Tracely team: DM10 "Nguyễn An CEO / Lê Minh Tú CTO" vs DM13 / DM09 "Đặng Kim Chi CEO / Nguyễn Minh Anh" | DM13 team (journey anchor), INTENTIONAL-DATA |
| C8 | DM13 "Chuyên môn" (expertise with years, "Chính / Phụ") vs FB-10 "no Skills anywhere" (S1-UAT-03) | fixture text only, no Skills vocabulary or field; PO to confirm |
| C9 | Stage labels: DM08 "MVP / Tăng trưởng" vs VENTURE_STAGE "Prototype / Đã mở rộng" | canonical labels; demo startups avoid both |
| C10 | DM13 shows a fictional founder as "Phó Chủ tịch Chapter Đà Nẵng" (a real unit); DM03 / DM04 show named boards and CLBs that differ from the catalogue | badge is fixture text only; boards / CLBs come from S1-UAT-08A and the catalogue, never from frame names |
| C11 | Space Grotesk outside the DEC-HD-12 scope | RESOLVED by DEMO-D9 (approved) |

## Missing inputs
1. **SP1 updated files:** the UPDATED file 13 (Chỉ số) and file 12 (Cập nhật) are not yet on the workstation; DM11 / DM12 baselines wait for them.
2. **Breakpoints:** there are no 768 or 390 frames for any screen.
3. **Homepage hero:** no hero video or poster.
4. **About map:** no map asset or HUB coordinates. The Vietnam view must include Hoàng Sa and Trường Sa.
5. **Partner logos and URLs:** not supplied.
6. **About content:** the final ecosystem list (C1), CLB chủ nhiệm and Ban chuyên môn names, and the HUB popup member / event / project counts.
7. **Unopened states:** the dropdowns, empty / loading / error states, the recruitment overlay are not drawn (DM13 is handled by DEMO-D13).
8. **EN copy.**

## Blockers
| Blocks | Item |
|---|---|
| DEMO-HOME-ABOUT-01 | none: DEMO-D9 approved; the hero, map and partners use the fallbacks above, flagged for PO review |
| DEMO-PRODUCT-01 / DEMO-FOUNDER-01 | none; C7 / C8 / C10 confirmation is advisory |
| DEMO-SP-TABS-01 | the UPDATED SP1 files 12 / 13 (DM12 / DM11 baselines) |

## Implementation order (one task at a time, STOP between)
DEMO-HOME-ABOUT-01 (shared header / footer, DM01, DM02–DM05) → DEMO-PRODUCT-01 (data step, DM08, DM10) → DEMO-FOUNDER-01 (DM13) → DEMO-SP-TABS-01 (DM11, DM12) → DEMO-JOURNEY-QA-01 (journey smoke, regression).

## Related
- [SCREEN_ROUTE_MAP](SCREEN_ROUTE_MAP.md) · [FIGMA_REFERENCE_MAP](FIGMA_REFERENCE_MAP.md) · [DEMO_DATA_CONTRACT](DEMO_DATA_CONTRACT.md)
- [SUPERSESSION_MATRIX](SUPERSESSION_MATRIX.md) · [OUT_OF_SCOPE_POST_DEMO](OUT_OF_SCOPE_POST_DEMO.md)
- [DECISION_LOG DEC-DEMO](../decisions/DECISION_LOG.md#dec-demo)
