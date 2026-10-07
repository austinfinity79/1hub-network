# Presentation data — final walkthrough

The exact records, routes, states and links the final walkthrough uses. Visible text must read as production content: no "demo", "test", "sample", "mẫu", "fake", "placeholder" or "Dữ liệu minh hoạ" label on any screen shown. Checked live on `57c1f14` (scan of visible text and image alt on every journey page).

## Records
| Kind | Record | Route | State on live | Visible wording check | Status |
|---|---|---|---|---|---|
| Product | Tracely | `/products/tracely` (+ `/metrics`, `/updates`) | STARTUP · ACTIVE · PUBLIC, Pilot · Logistics; fictional demo venture (DEMO-D4, seed `db/seed/demo_0710.sql`) | clean (0 hit on all three tabs) | READY |
| Founder | Đặng Kim Chi | `/talents/dang-kim-chi` | Fictional profile on the DEC-DEMO-SP1-D1 allow-list; not a real person; chip "Đã xác thực danh tính qua 1Hub" (DEMO-D10) | clean | READY — chip wording pending PD-VER |
| Co-founder (shown, not opened) | Nguyễn Minh Anh | `/talents/nguyen-minh-anh` | Fictional, allow-list | clean | READY |
| Product list | 92 catalogue + 3 demo ventures = 95 | `/products` | v2 content pack, 7 approved logos | clean | READY |
| Homepage programmes | APEC Innovation Challenge · VPBank Innovation Challenge · Cuộc thi Khởi nghiệp cùng Kawai · Agritech Innovation Challenge | `/` (cards, not clickable) | Verbatim from the refreshed workbook (PUBLIC-CONTENT-PUBLISH-01); status "Sắp công bố"; no dates | clean | READY (homepage only) |
| Programme directory | — none approved — | `/programmes` | Only "Chương trình ươm tạo (demo)" — "Chương trình mẫu cho Internal Alpha…" (PUBLISHED fixture) | **3 hits** | NOT READY → PROGRAMME-PRESENTATION-DATA-01 |
| About partner wall | — none approved — | `/about` › partners | Placeholder names ("Doanh nghiệp A", "Tập đoàn C", "Đại học A"…) under the label "Dữ liệu minh hoạ" | **placeholder** | NOT READY → ABOUT-PARTNERS-PRESENTATION-01 |
| About activities | 43 real activity photos | `/about` › activities | Titles include real event names "Demo Day VentureX 2025", "HUB Challenge Demo Day 2024" | proper names, not placeholders | READY |
| Event | — | — | No P0 surface | n/a | OUT OF SCOPE (PD-EVT) |

The programme directory must not be filled with invented records: PROGRAMME-PRESENTATION-DATA-01 needs the PO to supply, for each programme to publish, an approved name, type, host organisation, period and status, or to approve hiding the internal fixture from the public directory.

## External links
| Step | Target | URL | App behaviour | Remote behaviour | Status |
|---|---|---|---|---|---|
| 17 | APEC Innovation Challenge | **not provided** | Row on About is a plain label with an → arrow | — | NOT READY → APEC-LINK-01 |
| 19 | iHUB Ventures deck | `https://deck.ihub.ventures/` | New tab, noopener, 1hub tab kept | Redirects to `/login` (approved e-mail sign-in) | NOT READY → FINAL-ACCESS-PREP-01 |
| 20 | Vietnam's National Ventures | `https://vnv.ihub.ventures/` | New tab, noopener, 1hub tab kept | Redirects to `/access` (authorised e-mail) | NOT READY → FINAL-ACCESS-PREP-01 |

## Pitch names to confirm (original section D)
Product "Tracely" · founder "Đặng Kim Chi" · programmes: per PROGRAMME-PRESENTATION-DATA-01 · event: none (PD-EVT) · APEC URL: APEC-LINK-01.

## Related
- [RUNBOOK_SOT](RUNBOOK_SOT.md) · [ACCOUNTS](ACCOUNTS.md) · [PRECHECK](PRECHECK.md) · [FINAL_ACCEPTANCE_REPORT](FINAL_ACCEPTANCE_REPORT.md)
