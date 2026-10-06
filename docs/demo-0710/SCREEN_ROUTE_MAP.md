# Screen route map — 07/10 demo

Part of [DEMO_SOT_v1](DEMO_SOT_v1.md). Frozen by DEMO-SOT-00 (06/10/2026). The semantic screen name is authoritative. DIR numbers are labels only and never rename a domain concept.

## Screens (A)
| # | Semantic screen | Thảo spec ID / name | Figma file (PO pack 06/10) | Route | Demo priority | Production status |
|---|---|---|---|---|---|---|
| DM01 | Homepage v2 (full replacement) | HOME (HOME.10–17) | `1. homepage.png` | `/` | MUST | exists (H1 r2); presentation superseded |
| DM02 | About HUB v2 | ABT1 | `2. about-1.png` | `/about` | MUST | exists (S1-UAT-08A); layout superseded, data reused |
| DM03 | About: HUB popup (HUB Đà Nẵng) | ABT1 map popup | `3. thẻ HUB.png` | `/about`, in-page dialog | MUST | new state |
| DM04 | About: Humans of HUB, HUB Khu vực tab | ABT1 Humans of HUB | `4. ABT1 · trạng thái · … HUB Khu vực ….png` | `/about`, in-page tab | MUST | new state |
| DM05 | About: Humans of HUB, Câu lạc bộ tab | ABT1 Humans of HUB | `5. ABT1 · trạng thái · … Câu lạc bộ.png` | `/about`, in-page tab | MUST | new state |
| DM06 | Chương trình (programme / challenge directory) | DIR0 · Chương trình | `6. DIR2.1 · Chương trình, cuộc thi.png` | `/programmes` (reserved) | REFERENCE | not built |
| DM07 | Sự kiện (event directory) | EV2 v2 · Lịch sự kiện | `9. DIR2.2 - Sự kiện.png` | `/events` (reserved) | REFERENCE | not built |
| DM08 | Sản phẩm (product / startup directory) | DIR2 · Sản phẩm | `7. DIR3 - SẢN PHẨM.png` | `/products` | MUST | built (DEMO-DIR2-01) |
| DM09 | Nhân tài (talent directory) | DIR3 · Nhân tài | `8. DIR4 - NHÂN TÀI.png` | `/talents` (reserved) | REFERENCE / P1 | not built |
| DM10 | Startup profile: Tổng quan | SP1 tab Tổng quan (SP1.24–27) | `10. SP1 hồ sơ sản phẩm.png` | `/products/[slug]` | MUST | built (DEMO-SP1-FOUNDER-01) |
| DM11 | Startup profile: Chỉ số | SP1 tab Chỉ số (SP1.28–29) | **UPDATED** `13. SP Tab chỉ số.png` (PO latest; file pending, see [FIGMA_REFERENCE_MAP](FIGMA_REFERENCE_MAP.md)) | `/products/[slug]/metrics` | SHOULD (read-only) | not built: file missing (DEC-DEMO-SP1-D6) |
| DM12 | Startup profile: Cập nhật | SP1 tab Cập nhật (SP1.30–31) | **UPDATED** `12. Tab cập nhật.png` (PO latest; file pending) | `/products/[slug]/updates` | SHOULD (read-only) | not built: file missing (DEC-DEMO-SP1-D6) |
| DM13 | Founder profile (**PUBLIC VIEW**) | FP1 (other-member view) | `14. NT1 - Nhân tài - Chi tiết hồ sơ cá nhân.png` | `/talents/[handle]` (DEC-DEMO-SP1-D1) | MUST | built (DEMO-SP1-FOUNDER-01; only the demo allow-list renders) |

SP1 mapping is locked by meaning (PO, 06/10): Tổng quan = file 10, Chỉ số = UPDATED file 13, Cập nhật = UPDATED file 12, Founder Profile = file 14. Old file numbering never re-maps a tab.

## DIR numbering conflict
| Concept | Thảo | Figma | Frozen route |
|---|---|---|---|
| Chương trình | DIR0 | DIR2.1 | `/programmes` |
| Bài toán | DIR1 | — | none in demo (`/library` keeps problems) |
| Sản phẩm | DIR2 | DIR3 | `/products` |
| Nhân tài | DIR3 | DIR4 | `/talents` |
| Sự kiện | EV2 | DIR2.2 | `/events` |

## Navigation (Thảo §A, Figma header and footer)
| Item | Target in demo | Rule |
|---|---|---|
| Logo | `/` | functional |
| Giới thiệu ▾ | `/about` | functional (the open menu is not drawn, see I) |
| Chương trình ▾ → 2.1 / 2.2 | `/programmes` / `/events` once built; until then plain labels | no dead link (DEC-AIG-D1 pattern) |
| Sản phẩm | `/products` | functional; current-state underline |
| Nhân tài | `/talents` once built; until then plain label | as above |
| Tin tức | plain label | Thảo: "chưa hiện ra gì" |
| VI \| EN | inert | EN content is not supplied |
| Đăng nhập / Tạo tài khoản | `/auth` | functional (existing entry) |
| Footer: Giới thiệu, iHUB Ventures ↗, VNV ↗, 1Hub ↗ / Chương trình, Sản phẩm, Nhân tài, Tin tức | same targets as the header; external links from the [ecosystem list](DEMO_SOT_v1.md#sot-conflicts) once confirmed | an unconfirmed external URL renders as a plain label |

## Guest / auth (D)
| Step | Guest | Signed-in |
|---|---|---|
| `/`, `/about`, `/products` | full view | full view, signed-in header |
| `/products/[slug]` (+ metrics / updates) | full view of PUBLIC + ACTIVE startups | same |
| `/talents/[handle]` | demo allow-list only; any other handle or id → 404 | same |
| Journey | the whole review journey runs as guest; no login is needed | — |

Figma draws DM10–DM13 signed in. The guest header is the one drawn on DM01/DM02/DM08.

## Calls to action (E)
| Screen | Functional | Visual-only / read-only (no write, no fake success) |
|---|---|---|
| DM01 | nav, search scope Sản phẩm → `/products?q=`, Tất cả → `/library?q=`, "Xem tất cả sản phẩm", product rows → `/products/[slug]`, "Tham gia cộng đồng HUB Network" → `/auth` | video pause, Chương trình / Nhân tài search scope, "Tổ chức chương trình", "Gọi vốn", programme cards and filters, news, "Nhận bản tin" |
| DM02–05 | map point → popup, popup close, Humans tabs, "Tham gia HUB Network" → `/auth`, Facebook → `https://www.facebook.com/1hubnetwork`, "Xem chi tiết HUB Chapter" → `/organizations/[slug]` | "Kết nối hợp tác", "Xem thêm", "Tìm thành viên", "Xem thành viên …" (until `/talents`), timeline drag, partner logos, "Xem lịch sự kiện" (until `/events`) |
| DM08 | search and filters over demo data, "Xem hồ sơ" | "Theo dõi" (guest → `/auth`), "Góp ý" keeps S1-UAT-02 behaviour |
| DM10–12 | tabs, "← Sản phẩm", "Xem chỉ số", team member → founder when allow-listed, website ↗ | "Theo dõi", "Đề nghị kết nối", "Hồ sơ đầy đủ & dataroom", "Yêu cầu xem", "Xem vị trí tuyển dụng", quarter picker, update filters (guest → `/auth` for the first three) |
| DM13 | product rows → `/products/[slug]` | "Kết nối", "Theo dõi", "Thông tin liên hệ", "Xem tất cả …"; "+ Tạo sản phẩm" is owner-only and hidden |

## Related
- [DEMO_SOT_v1](DEMO_SOT_v1.md) · [FIGMA_REFERENCE_MAP](FIGMA_REFERENCE_MAP.md) · [DEMO_DATA_CONTRACT](DEMO_DATA_CONTRACT.md)
- [SUPERSESSION_MATRIX](SUPERSESSION_MATRIX.md) · [OUT_OF_SCOPE_POST_DEMO](OUT_OF_SCOPE_POST_DEMO.md)
